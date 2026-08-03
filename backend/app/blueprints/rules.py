from flask import Blueprint, request, jsonify, g
from backend.app.database import db
from backend.app.models.rules import CustomRule
from backend.app.utils.security import login_required, log_audit_action
from backend.app.utils.validators import validate_rule_payload

rules_bp = Blueprint('rules', __name__)

@rules_bp.route('', methods=['GET'])
@login_required
def get_rules():
    """Retrieve Whitelist/Blacklist custom rules matching current session."""
    user_id = g.current_user.id
    # Fetch user-specific rules and system-wide global rules (where user_id is NULL)
    rules = CustomRule.query.filter(
        (CustomRule.user_id == user_id) | (CustomRule.user_id.is_(None))
    ).all()
    
    return jsonify([rule.to_dict() for rule in rules]), 200


@rules_bp.route('', methods=['POST'])
@login_required
def create_rule():
    """Insert a new whitelist or blacklist evaluation pattern."""
    data = request.get_json()
    errors = validate_rule_payload(data)
    if errors:
        return jsonify({
            'status': 'error',
            'error_code': 'VALIDATION_FAILED',
            'message': 'Invalid input parameters.',
            'errors': errors
        }), 400

    user_id = g.current_user.id
    
    # Check if duplicate rule exists
    existing = CustomRule.query.filter_by(
        user_id=user_id,
        type=data['type'],
        pattern=data['pattern'].strip().lower(),
        classification=data['classification']
    ).first()

    if existing:
        return jsonify({
            'status': 'error',
            'error_code': 'DUPLICATE_RULE',
            'message': 'This rule pattern is already registered.'
        }), 409

    rule = CustomRule(
        user_id=user_id,
        type=data['type'],
        pattern=data['pattern'].strip().lower(),
        classification=data['classification'],
        active=data.get('active', True)
    )

    try:
        db.session.add(rule)
        db.session.commit()
        
        log_audit_action(action=f"Created custom rule ID {rule.id} ({rule.classification} for {rule.type}: {rule.pattern})")
        
        return jsonify({
            'status': 'success',
            'message': 'Custom rule created successfully.',
            'rule': rule.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'error_code': 'DATABASE_ERROR',
            'message': f"Failed to save rule: {str(e)}"
        }), 500


@rules_bp.route('/<int:rule_id>', methods=['DELETE'])
@login_required
def delete_rule(rule_id):
    """Delete or deactivate custom bypass rules."""
    user_id = g.current_user.id
    rule = CustomRule.query.filter_by(id=rule_id, user_id=user_id).first()
    
    if not rule:
        return jsonify({
            'status': 'error',
            'error_code': 'RESOURCE_NOT_FOUND',
            'message': 'The rule does not exist or you do not have permission to delete it.'
        }), 404

    try:
        db.session.delete(rule)
        db.session.commit()
        
        log_audit_action(action=f"Deleted custom rule ID {rule_id} ({rule.pattern})")
        
        return jsonify({
            'status': 'success',
            'message': 'Custom rule deleted successfully.'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'error_code': 'DATABASE_ERROR',
            'message': f"Failed to delete rule: {str(e)}"
        }), 500
