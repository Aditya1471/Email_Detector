import io
import csv
from datetime import datetime
from flask import Blueprint, request, jsonify, make_response, g
from backend.app.database import db
from backend.app.utils.security import login_required

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/export', methods=['POST'])
@login_required
def export_report_logs():
    """Export scanned threats spreadsheet report containing forensic records details."""
    data = request.get_json() or {}
    export_format = data.get('format', 'csv').lower().strip()
    
    user_id = g.current_user['id']
    emails = db.emails.find({'user_id': user_id})
    
    if export_format == 'csv':
        # Generate CSV spreadsheet natively in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header row
        writer.writerow(['Email ID', 'Sender', 'Subject', 'Phishing Risk Score (%)', 'Verdict', 'Scanned Date', 'Flagged Reasons'])
        
        for email in emails:
            writer.writerow([
                email.get('id', str(email.get('_id', ''))),
                email.get('sender', ''),
                email.get('subject', ''),
                email.get('risk_score', 0.0),
                email.get('classification', '').upper(),
                email.get('scanned_at', ''),
                '; '.join(email.get('reasons', []))
            ])
            
        response = make_response(output.getvalue())
        response.headers["Content-Disposition"] = f"attachment; filename=phishguard_audit_report_{datetime.now().strftime('%Y%m%d')}.csv"
        response.headers["Content-type"] = "text/csv"
        return response
        
    elif export_format == 'json':
        # Return structured JSON log
        export_list = []
        for email in emails:
            email_id = email.get('id', str(email.get('_id', '')))
            export_list.append({
                'email_id': email_id,
                'sender': email.get('sender', ''),
                'subject': email.get('subject', ''),
                'risk_score': email.get('risk_score', 0.0),
                'classification': email.get('classification', ''),
                'scanned_at': email.get('scanned_at', ''),
                'reasons': email.get('reasons', [])
            })
        return jsonify({
            'status': 'success',
            'report': export_list
        }), 200
        
    else:
        return jsonify({
            'status': 'error',
            'message': f"Export format '{export_format}' is not supported. Choose 'csv' or 'json'."
        }), 400
