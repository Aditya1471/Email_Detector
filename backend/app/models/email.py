from datetime import datetime
from backend.app.database import db

class MonitoredInbox(db.Model):
    """Monitored Inbox configurations matching email addresses for periodic scans."""
    __tablename__ = 'monitored_inboxes'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'email_address', name='uq_user_inbox'),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    email_address = db.Column(db.String(255), nullable=False)
    watch_expiration = db.Column(db.String(255), nullable=True)
    last_history_id = db.Column(db.String(100), nullable=True)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Serialize MonitoredInbox object model details into standard dictionary format."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'email_address': self.email_address,
            'watch_expiration': self.watch_expiration,
            'last_history_id': self.last_history_id,
            'active': self.active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ScannedEmail(db.Model):
    """Scanned emails database representation carrying threat classifications."""
    __tablename__ = 'scanned_emails'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    message_id = db.Column(db.String(255), nullable=False, unique=True, index=True)
    thread_id = db.Column(db.String(255), nullable=True)
    sender = db.Column(db.String(255), nullable=False, index=True)
    recipient = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(512), nullable=True)
    received_date = db.Column(db.DateTime, nullable=True)
    body_text = db.Column(db.Text, nullable=True)
    risk_score = db.Column(db.Float, nullable=False)
    classification = db.Column(db.Enum('safe', 'suspect', 'phishing', name='email_classification_enum'), nullable=False, default='safe')
    scan_date = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    # Relationship to detailed report (1-to-1)
    analysis_details = db.relationship('EmailAnalysisDetails', backref='email', uselist=False, cascade='all, delete-orphan', lazy=True)

    def to_dict(self):
        """Serialize ScannedEmail object model details into standard dictionary format."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'message_id': self.message_id,
            'thread_id': self.thread_id,
            'sender': self.sender,
            'recipient': self.recipient,
            'subject': self.subject,
            'received_date': self.received_date.isoformat() if self.received_date else None,
            'body_text': self.body_text,
            'risk_score': self.risk_score,
            'classification': self.classification,
            'scan_date': self.scan_date.isoformat() if self.scan_date else None
        }


class EmailAnalysisDetails(db.Model):
    """Granular analytics table containing check logs, matches, SPF results, and reasons."""
    __tablename__ = 'email_analysis_details'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    scanned_email_id = db.Column(db.Integer, db.ForeignKey('scanned_emails.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    domain_reputation_score = db.Column(db.Float, nullable=False, default=100.0)
    spf_alignment = db.Column(db.Boolean, nullable=False, default=False)
    dkim_alignment = db.Column(db.Boolean, nullable=False, default=False)
    dmarc_alignment = db.Column(db.Boolean, nullable=False, default=False)
    url_analysis = db.Column(db.JSON, nullable=True)  # Store JSON representation of parsed links
    attachment_analysis = db.Column(db.JSON, nullable=True)  # Store files results info
    nlp_entities = db.Column(db.JSON, nullable=True)  # Store key entities recognized
    explain_reason = db.Column(db.Text, nullable=True)

    def to_dict(self):
        """Serialize EmailAnalysisDetails object model details into standard dictionary format."""
        return {
            'id': self.id,
            'scanned_email_id': self.scanned_email_id,
            'domain_reputation_score': self.domain_reputation_score,
            'spf_alignment': self.spf_alignment,
            'dkim_alignment': self.dkim_alignment,
            'dmarc_alignment': self.dmarc_alignment,
            'url_analysis': self.url_analysis,
            'attachment_analysis': self.attachment_analysis,
            'nlp_entities': self.nlp_entities,
            'explain_reason': self.explain_reason
        }


class AuditLog(db.Model):
    """Audit logs for tracking security-related operations and system authentication events."""
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    action = db.Column(db.String(255), nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        """Serialize AuditLog object model details into standard dictionary format."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'action': self.action,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }
