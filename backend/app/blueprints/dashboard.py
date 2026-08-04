from flask import Blueprint, jsonify

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/stats', methods=['GET'])
def get_dashboard_stats():
    """Retrieve aggregate statistics calculations for threat dials."""
    return jsonify({
        'status': 'success',
        'stats': {
            'total_scanned': 0,
            'phishing_count': 0,
            'safe_count': 0,
            'suspect_count': 0
        }
    }), 200

@dashboard_bp.route('/trends', methods=['GET'])
def get_threat_trends():
    """Retrieve chronological weekly scan counts."""
    return jsonify({
        'status': 'success',
        'trends': []
    }), 200
