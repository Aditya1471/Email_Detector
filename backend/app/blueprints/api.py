from flask import Blueprint, request, jsonify, g
from urllib.parse import urlparse
from datetime import datetime, timedelta
from sqlalchemy import func

from backend.app.database import db
from backend.app.models.user import User
from backend.app.models.email import ScannedEmail, EmailAnalysisDetails
from backend.app.models.rules import CustomRule
from backend.app.models.intelligence import ThreatIntel
from backend.app.utils.security import login_required, log_audit_action
from backend.app.utils.validators import validate_manual_scan_payload

api_bp = Blueprint('api', __name__)

@api_bp.route('/manual', methods=['POST'])
@login_required
def manual_scan():
    """Submit text content, headers or links for immediate threat scanning."""
    data = request.get_json()
    errors = validate_manual_scan_payload(data)
    if errors:
        return jsonify({
            'status': 'error',
            'error_code': 'VALIDATION_FAILED',
            'message': 'Invalid input parameters.',
            'errors': errors
        }), 400

    sender = data.get('sender').strip().lower()
    subject = data.get('subject', '').strip()
    body_text = data.get('body_text', '')
    links = data.get('links', [])

    # Extract sender domain
    sender_domain = sender.split('@')[-1] if '@' in sender else ''
    
    reasons = []
    risk_score = 0.0
    classification = 'safe'
    
    # 1. Evaluate custom whitelists (Bypass checks if matches)
    whitelisted = CustomRule.query.filter(
        (CustomRule.user_id == g.current_user.id) | (CustomRule.user_id.is_(None)),
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
        # 2. Evaluate custom blacklists
        blacklisted = CustomRule.query.filter(
            (CustomRule.user_id == g.current_user.id) | (CustomRule.user_id.is_(None)),
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
        
        # 3. Evaluate threat intelligence database indicators (Check links)
        for url in links:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            
            # Lookup domain in ThreatIntel database
            threat = ThreatIntel.query.filter_by(
                threat_type='domain',
                threat_value=domain
            ).first()
            
            if threat:
                risk_score = max(risk_score, float(threat.risk_score))
                classification = 'phishing'
                reasons.append(f"URL domain '{domain}' found in Threat Intelligence database.")

        # 4. Fallback baseline heuristic (To be integrated with real ML model in Sprint 3)
        if risk_score == 0.0:
            urgency_keywords = ['verify', 'suspended', 'restrict', 'bank', 'payment', 'password', 'urgent', 'action required']
            matched_keywords = [kw for kw in urgency_keywords if kw in body_text.lower() or kw in subject.lower()]
            
            if matched_keywords:
                risk_score = 45.0 + (len(matched_keywords) * 10)
                risk_score = min(risk_score, 85.0)  # Caps heuristic risk score at 85%
                classification = 'suspect'
                reasons.append(f"Suspicious linguistic patterns found: {', '.join(matched_keywords)}")

    # Assign classification based on risk threshold
    if risk_score >= 80.0:
        classification = 'phishing'
    elif risk_score >= 40.0:
        classification = 'suspect'
    else:
        classification = 'safe'

    # Save Scan Result in database
    # Construct a unique mock message_id for manual scans
    message_id = f"manual_{datetime.utcnow().timestamp()}_{g.current_user.id}"
    
    email = ScannedEmail(
        user_id=g.current_user.id,
        message_id=message_id,
        sender=sender,
        recipient=g.current_user.email,
        subject=subject,
        received_date=datetime.utcnow(),
        body_text=body_text,
        risk_score=risk_score,
        classification=classification
    )

    try:
        db.session.add(email)
        db.session.commit()

        # Save details
        details = EmailAnalysisDetails(
            scanned_email_id=email.id,
            domain_reputation_score=100.0 - risk_score if classification == 'phishing' else 90.0,
            spf_alignment=not blacklisted, # alignment indicators
            dkim_alignment=not blacklisted,
            dmarc_alignment=not blacklisted,
            url_analysis={'links_found': len(links), 'links_scanned': links},
            attachment_analysis={'files_scanned': 0},
            nlp_entities={'urgency': len(reasons) > 0},
            explain_reason="; ".join(reasons) if reasons else "No risk indicator matches found. Content appears legitimate."
        )
        db.session.add(details)
        db.session.commit()
        
        log_audit_action(action=f"Manual email scan executed. Score: {risk_score}%, Class: {classification}")
        
        return jsonify({
            'id': email.id,
            'message_id': message_id,
            'risk_score': risk_score,
            'classification': classification,
            'reasons': reasons if reasons else ["No major security threats matched during heuristics scans."]
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'error_code': 'DATABASE_ERROR',
            'message': f"Failed to save scan evaluation: {str(e)}"
        }), 500


@api_bp.route('/history', methods=['GET'])
@login_required
def get_history():
    """Retrieve historical scan results with search filters."""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 15, type=int)
    classification = request.args.get('classification')
    
    query = ScannedEmail.query.filter_by(user_id=g.current_user.id)
    
    if classification:
        query = query.filter_by(classification=classification)
        
    paginated = query.order_by(ScannedEmail.scan_date.desc()).paginate(page=page, per_page=limit, error_out=False)
    
    return jsonify({
        'status': 'success',
        'data': [email.to_dict() for email in paginated.items],
        'pagination': {
            'page': page,
            'limit': limit,
            'total_records': paginated.total,
            'total_pages': paginated.pages
        }
    }), 200


@api_bp.route('/history/<int:email_id>', methods=['GET'])
@login_required
def get_email_details(email_id):
    """Retrieve in-depth indicators and analytics for a specific scanned email."""
    email = ScannedEmail.query.filter_by(id=email_id, user_id=g.current_user.id).first()
    if not email:
        return jsonify({
            'status': 'error',
            'error_code': 'RESOURCE_NOT_FOUND',
            'message': 'The scanned email record does not exist.'
        }), 404

    # Fetch corresponding analysis details record
    details = EmailAnalysisDetails.query.filter_by(scanned_email_id=email.id).first()
    
    response_data = email.to_dict()
    response_data['analysis_details'] = details.to_dict() if details else None
    
    return jsonify({
        'status': 'success',
        'data': response_data
    }), 200


@api_bp.route('/dashboard/stats', methods=['GET'])
@login_required
def get_dashboard_stats():
    """Calculate aggregate stats, trends, and risk distributions for dashboards."""
    user_id = g.current_user.id
    
    # 1. Query general counters
    total_scans = ScannedEmail.query.filter_by(user_id=user_id).count()
    phishing_count = ScannedEmail.query.filter_by(user_id=user_id, classification='phishing').count()
    suspect_count = ScannedEmail.query.filter_by(user_id=user_id, classification='suspect').count()
    safe_count = ScannedEmail.query.filter_by(user_id=user_id, classification='safe').count()

    # 2. Query weekly trend (Last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    trends = db.session.query(
        func.date(ScannedEmail.scan_date).label('scan_day'),
        func.sum(db.case((ScannedEmail.classification == 'safe', 1), else_=0)).label('safe'),
        func.sum(db.case((ScannedEmail.classification == 'phishing', 1), else_=0)).label('phishing'),
        func.sum(db.case((ScannedEmail.classification == 'suspect', 1), else_=0)).label('suspect')
    ).filter(
        ScannedEmail.user_id == user_id,
        ScannedEmail.scan_date >= seven_days_ago
    ).group_by(
        func.date(ScannedEmail.scan_date)
    ).order_by(
        func.date(ScannedEmail.scan_date).asc()
    ).all()

    # Construct clean structures for ChartJS integration
    labels = []
    safe_trend = []
    phishing_trend = []
    suspect_trend = []

    for row in trends:
        # Convert date to string format (e.g. "Mon" or "YYYY-MM-DD")
        labels.append(row.scan_day.strftime('%a') if isinstance(row.scan_day, datetime) else str(row.scan_day))
        safe_trend.append(int(row.safe or 0))
        phishing_trend.append(int(row.phishing or 0))
        suspect_trend.append(int(row.suspect or 0))

    return jsonify({
        'status': 'success',
        'summary': {
            'total_scans': total_scans,
            'phishing_detected': phishing_count,
            'suspect_flagged': suspect_count,
            'safe_emails': safe_count
        },
        'weekly_trends': {
            'labels': labels,
            'safe': safe_trend,
            'phishing': phishing_trend,
            'suspect': suspect_trend
        }
    }), 200
