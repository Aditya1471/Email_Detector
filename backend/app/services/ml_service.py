import os
import joblib
import numpy as np
from urllib.parse import urlparse
from datetime import datetime

from backend.app.database import db
from backend.app.models.email import ScannedEmail, EmailAnalysisDetails
from backend.app.models.rules import CustomRule
from backend.app.models.intelligence import ThreatIntel
from backend.app.services.dns_service import evaluate_domain_email_auth
from backend.app.services.url_service import analyze_extracted_urls
from ml_model.scripts.preprocess import EmailTextPreprocessor

# Global cache for ML models
_vectorizer = None
_classifier = None
_preprocessor = EmailTextPreprocessor()

def load_ml_resources():
    """Load joblib vectorizer and classifier from ml_model/ directory."""
    global _vectorizer, _classifier
    if _vectorizer is None or _classifier is None:
        try:
            # Model directory path relative to this file
            current_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
            model_dir = os.path.join(project_root, 'ml_model')
            
            vectorizer_path = os.path.join(model_dir, 'vectorizer.joblib')
            classifier_path = os.path.join(model_dir, 'classifier.joblib')
            
            if os.path.exists(vectorizer_path) and os.path.exists(classifier_path):
                _vectorizer = joblib.load(vectorizer_path)
                _classifier = joblib.load(classifier_path)
                print("[ML Service] Serialized vectorizer & classifier loaded successfully.")
            else:
                print(f"[ML Service Warning] Model files not found. Paths checked: {vectorizer_path}")
        except Exception as e:
            print(f"[ML Service Warning] Failed to load ML resources: {str(e)}")


def scan_and_save_email(user_id, email_data, message_id=None):
    """
    Core AI threat analysis pipeline.
    Combines DNS authentication, URL WHOIS/spelling checks, and NLP ML predictions.
    """
    # Ensure models are loaded
    load_ml_resources()

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

    # Prevent duplicate scans
    existing = ScannedEmail.query.filter_by(message_id=message_id).first()
    if existing:
        return existing.to_dict()

    sender_domain = sender.split('@')[-1] if '@' in sender else ''
    reasons = []
    
    # --------------------------------------------------
    # Step 1: Run DNS Authentication Validation
    # --------------------------------------------------
    dns_res = evaluate_domain_email_auth(sender)
    
    # --------------------------------------------------
    # Step 2: Run URL Indicators Analysis
    # --------------------------------------------------
    url_res = analyze_extracted_urls(links)
    if url_res['reasons']:
        reasons.extend(url_res['reasons'])

    # Threat Intelligence database check for link domains
    threat_risk_score = 0.0
    for url in links:
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower().split(':')[0]
            threat = ThreatIntel.query.filter_by(
                threat_type='domain',
                threat_value=domain
            ).first()
            if threat:
                threat_risk_score = max(threat_risk_score, float(threat.risk_score))
                reasons.append(f"URL domain '{domain}' found in Threat Intelligence database.")
        except Exception:
            continue

    # --------------------------------------------------
    # Step 3: Run Text ML Classifier Prediction
    # --------------------------------------------------
    ml_risk_score = 0.0
    ml_predicted_phish = False
    
    # Check if we have active models loaded
    if _vectorizer is not None and _classifier is not None:
        try:
            # Preprocess text
            cleaned_text = _preprocessor.clean_text(body_text)
            
            # Vectorize
            tfidf_vec = _vectorizer.transform([cleaned_text]).toarray()
            
            # Engineer meta-features
            urgency_words = ['verify', 'suspended', 'restrict', 'bank', 'payment', 'password', 'urgent', 'action required']
            has_urgency = 1 if any(w in body_text.lower() or w in subject.lower() for w in urgency_words) else 0
            
            url_count = len(links)
            
            # Combine vectors (must match training dimensions: TF-IDF + 2 meta features)
            meta_vec = np.array([[url_count, has_urgency]])
            combined_vec = np.hstack((tfidf_vec, meta_vec))
            
            # Make prediction probability
            probs = _classifier.predict_proba(combined_vec)[0]
            ml_risk_score = float(probs[1]) * 100.0 # Probability of Phishing class
            ml_predicted_phish = ml_risk_score >= 50.0
            
        except Exception as e:
            print(f"[ML Service Error] Inference failed: {str(e)}")
            ml_risk_score = 45.0 if has_urgency else 0.0
    else:
        # Fallback to heuristics if model is not loaded
        urgency_words = ['verify', 'suspended', 'restrict', 'bank', 'payment', 'password', 'urgent', 'action required']
        has_urgency = 1 if any(w in body_text.lower() or w in subject.lower() for w in urgency_words) else 0
        ml_risk_score = 45.0 if has_urgency else 10.0

    # --------------------------------------------------
    # Step 4: Calculate Sender Trust & Overall Risk Score
    # --------------------------------------------------
    # Baseline score derived from ML and Threat Intel DB
    risk_score = max(ml_risk_score, threat_risk_score)
    
    # If ML predicted phishing, record as reason
    if ml_predicted_phish:
        reasons.append(f"ML Classifier predicted phishing patterns (Score: {ml_risk_score:.1f}%).")

    # Escalate score based on DNS flaws (e.g. spoofing risk)
    if not dns_res['spf_alignment'] or not dns_res['dmarc_alignment']:
        risk_score = max(risk_score, 50.0) # Elevate to suspect
        # If SPF failed and ML also flagged it, escalate to high risk
        if ml_predicted_phish:
            risk_score = max(risk_score, 85.0)
        reasons.extend(dns_res['reasons'])

    # Escalate score based on URL typosquatting or newly registered domains
    if url_res['has_typosquatting']:
        risk_score = max(risk_score, 90.0)
    elif url_res['new_domain_detected']:
        risk_score = max(risk_score, 75.0)

    # --------------------------------------------------
    # Step 5: Override via Whitelists & Blacklists
    # --------------------------------------------------
    # Custom Whitelist Bypass
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
        reasons = [f"Bypassed: Sender matched custom whitelist: {whitelisted.pattern}"]
    else:
        # Custom Blacklist Enforcement
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
            reasons = [f"Blocked: Sender matched custom blacklist: {blacklisted.pattern}"]
        else:
            # Map dynamic classification
            if risk_score >= 80.0:
                classification = 'phishing'
            elif risk_score >= 40.0:
                classification = 'suspect'
            else:
                classification = 'safe'

    # --------------------------------------------------
    # Step 6: Persist Scans & Details to Database
    # --------------------------------------------------
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

        # Save details
        details = EmailAnalysisDetails(
            scanned_email_id=scanned_email.id,
            domain_reputation_score=100.0 - risk_score if classification == 'phishing' else 95.0,
            spf_alignment=dns_res['spf_alignment'],
            dkim_alignment=True, # default placeholder DKIM alignment
            dmarc_alignment=dns_res['dmarc_alignment'],
            url_analysis=url_res,
            attachment_analysis={'files_scanned': 0},
            nlp_entities={'urgency': has_urgency if 'has_urgency' in locals() else False},
            explain_reason="; ".join(reasons) if reasons else "No threat signatures identified. Email content appears benign."
        )
        db.session.add(details)
        db.session.commit()
        
        return scanned_email.to_dict()
        
    except Exception as e:
        db.session.rollback()
        raise RuntimeError(f"Database write failure in scan pipeline: {str(e)}")
