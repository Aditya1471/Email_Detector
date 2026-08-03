from flask import Blueprint, request, jsonify
from backend.app.database import db
from backend.app.models.intelligence import ThreatIntel
from backend.app.utils.security import login_required, admin_required, log_audit_action
from backend.app.utils.validators import validate_intel_payload

intel_bp = Blueprint('intelligence', __name__)

@intel_bp.route('', methods=['GET'])
@login_required
def get_threats():
    """Retrieve paginated threat intelligence indicators."""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    threat_type = request.args.get('threat_type')

    query = ThreatIntel.query
    if threat_type:
        query = query.filter_by(threat_type=threat_type)

    paginated = query.paginate(page=page, per_page=limit, error_out=False)
    
    return jsonify({
        'status': 'success',
        'data': [intel.to_dict() for intel in paginated.items],
        'pagination': {
            'page': page,
            'limit': limit,
            'total_records': paginated.total,
            'total_pages': paginated.pages
        }
    }), 200


@intel_bp.route('', methods=['POST'])
@admin_required
def add_threat():
    """Insert a new indicators of compromise (IOC) block rule. Requires Admin role."""
    data = request.get_json()
    errors = validate_intel_payload(data)
    if errors:
        return jsonify({
            'status': 'error',
            'error_code': 'VALIDATION_FAILED',
            'message': 'Invalid input parameters.',
            'errors': errors
        }), 400

    threat_value = data['threat_value'].strip().lower()
    threat_type = data['threat_type']
    
    # Check duplicate
    existing = ThreatIntel.query.filter_by(
        threat_type=threat_type,
        threat_value=threat_value
    ).first()

    if existing:
        return jsonify({
            'status': 'error',
            'error_code': 'DUPLICATE_THREAT_INDICATOR',
            'message': 'This threat intelligence indicator is already registered.'
        }), 409

    threat = ThreatIntel(
        threat_type=threat_type,
        threat_value=threat_value,
        risk_score=data.get('risk_score', 100),
        source=data.get('source', 'Admin Manual Input')
    )

    try:
        db.session.add(threat)
        db.session.commit()
        
        log_audit_action(action=f"Added threat IOC: {threat_type} -> {threat_value} (Risk: {threat.risk_score})")
        
        return jsonify({
            'status': 'success',
            'message': 'Threat intelligence indicator added successfully.',
            'threat': threat.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'error_code': 'DATABASE_ERROR',
            'message': f"Failed to save threat indicator: {str(e)}"
        }), 500
