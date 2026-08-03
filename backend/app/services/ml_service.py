import re
from urllib.parse import urlparse
from datetime import datetime

from backend.app.database import db
from backend.app.models.email import ScannedEmail, EmailAnalysisDetails
from backend.app.models.rules import CustomRule
from backend.app.models.intelligence import ThreatIntel

def scan_and_save_email(user_id, email_data, message_id=None):
    """
    Unified analysis pipeline for manually submitted or background fetched emails.
    Performs custom rule checks, threat intelligence lookup, and records results.
    """
    sender = email_data.get('sender', '').strip().lower()
    subject = email_data.get('subject', '').strip()
    body_text = email_data.get('body_text', '')
    links = email_data.get('links', [])
    received_date = email_data.get('received_date') or datetime.utcnow()
    recipient = email_data.get('recipient', '').strip().lower()
    thread_id = email_data.get('thread_id')

    # Resolve message ID
    if not message_id:
        message_id = email_data.get('message_id') or f"manual_{datetime.utcnow().timestamp()}_{user_id}"

    # Check duplicate database records
    existing = ScannedEmail.query.filter_by(message_id=message_id).first()
    if existing:
        return existing.to_dict()

    # Extract sender domain
    sender_domain = sender.split('@')[-1] if '@' in sender else ''
    
    reasons = []
    risk_score = 0.0
    classification = 'safe'
    
    # 1. Custom Whitelist Check
    whitelisted = CustomRule.query.filter(
        (CustomRule.user_id == user_id) | (CustomRule.user_id.is_(None)),
        CustomRule.active == True,
        CustomRule.classification == 'whitelist',
        (
            ((CustomRule.type == 'sender') & (CustomRule.pattern == sender)) |
            ((CustomRule.type == 'domain') & (CustomRule.pattern == sender_domain))
        )
    ).first()

    if whitelisted:
        risk_score = 0.0
        classification = 'safe'
        reasons.append(f"Sender matched custom whitelist rule: {whitelisted.pattern}")
    else:
        # 2. Custom Blacklist Check
        blacklisted = CustomRule.query.filter(
            (CustomRule.user_id == user_id) | (CustomRule.user_id.is_(None)),
            CustomRule.active == True,
            CustomRule.classification == 'blacklist',
            (
                ((CustomRule.type == 'sender') & (CustomRule.pattern == sender)) |
                ((CustomRule.type == 'domain') & (CustomRule.pattern == sender_domain))
            )
        ).first()

        if blacklisted:
            risk_score = 100.0
            classification = 'phishing'
            reasons.append(f"Sender matched custom blacklist rule: {blacklisted.pattern}")
        
        # 3. Threat Intelligence Blocklist Lookup (links checks)
        for url in links:
            try:
                parsed = urlparse(url)
                domain = parsed.netloc.lower()
                # Remove common port values if present
                domain = domain.split(':')[0]
                
                threat = ThreatIntel.query.filter_by(
                    threat_type='domain',
                    threat_value=domain
                ).first()
                
                if threat:
                    risk_score = max(risk_score, float(threat.risk_score))
                    classification = 'phishing'
                    reasons.append(f"URL domain '{domain}' found in Threat Intelligence database.")
            except Exception:
                continue

        # 4. Content Urgency Heuristics (Fallback to be enhanced in Sprint 3 with ML model)
        if risk_score == 0.0:
            urgency_keywords = ['verify', 'suspended', 'restrict', 'bank', 'payment', 'password', 'urgent', 'action required']
            matched_keywords = [kw for kw in urgency_keywords if kw in body_text.lower() or kw in subject.lower()]
            
            if matched_keywords:
                risk_score = 45.0 + (len(matched_keywords) * 10)
                risk_score = min(risk_score, 85.0)  # cap heuristic score
                classification = 'suspect'
                reasons.append(f"Suspicious linguistic patterns: {', '.join(matched_keywords)}")

    # Final Classification mapping
    if risk_score >= 80.0:
        classification = 'phishing'
    elif risk_score >= 40.0:
        classification = 'suspect'
    else:
        classification = 'safe'

    # Save Scanned Email Summary
    scanned_email = ScannedEmail(
        user_id=user_id,
        message_id=message_id,
        thread_id=thread_id,
        sender=sender,
        recipient=recipient,
        subject=subject,
        received_date=received_date,
        body_text=body_text,
        risk_score=risk_score,
        classification=classification
    )

    try:
        db.session.add(scanned_email)
        db.session.commit()

        # Save Deep Analysis Details
        details = EmailAnalysisDetails(
            scanned_email_id=scanned_email.id,
            domain_reputation_score=100.0 - risk_score if classification == 'phishing' else 90.0,
            spf_alignment=not blacklisted if blacklisted else True,
            dkim_alignment=not blacklisted if blacklisted else True,
            dmarc_alignment=not blacklisted if blacklisted else True,
            url_analysis={'links_found': len(links), 'links_scanned': links},
            attachment_analysis={'files_scanned': 0},
            nlp_entities={'urgency': len(reasons) > 0},
            explain_reason="; ".join(reasons) if reasons else "No risk indicator matches found. Content appears legitimate."
        )
        db.session.add(details)
        db.session.commit()
        
        return scanned_email.to_dict()
    except Exception as e:
        db.session.rollback()
        raise RuntimeError(f"Database transaction failure during email analysis persistence: {str(e)}")
