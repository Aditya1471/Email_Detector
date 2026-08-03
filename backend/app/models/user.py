from datetime import datetime
from backend.app.database import db

class User(db.Model):
    """User accounts table model representing security admins and system users."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    full_name = db.Column(db.String(150), nullable=True)
    role = db.Column(db.String(50), nullable=False, default='user')
    status = db.Column(db.String(50), nullable=False, default='active')
    phone_number = db.Column(db.String(50), nullable=True, unique=True)
    password_hash = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    oauth_accounts = db.relationship('OAuthAccount', backref='user', cascade='all, delete-orphan', lazy=True)
    monitored_inboxes = db.relationship('MonitoredInbox', backref='user', cascade='all, delete-orphan', lazy=True)
    scanned_emails = db.relationship('ScannedEmail', backref='user', cascade='all, delete-orphan', lazy=True)
    custom_rules = db.relationship('CustomRule', backref='user', cascade='all, delete-orphan', lazy=True)
    audit_logs = db.relationship('AuditLog', backref='user', cascade='all, delete')

    def to_dict(self):
        """Serialize User object model details into standard dictionary format."""
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'phone_number': self.phone_number,
            'role': self.role,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class OAuthAccount(db.Model):
    """OAuth credentials storage table model linking external provider credentials."""
    __tablename__ = 'oauth_accounts'
    __table_args__ = (
        db.UniqueConstraint('provider', 'provider_user_id', name='uq_provider_user'),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    provider = db.Column(db.String(50), nullable=False)
    provider_user_id = db.Column(db.String(255), nullable=False)
    access_token = db.Column(db.Text, nullable=True)
    refresh_token = db.Column(db.Text, nullable=True)
    token_expiry = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def is_token_expired(self):
        """Evaluate if the OAuth credentials access token has expired."""
        if not self.token_expiry:
            return True
        return datetime.utcnow() >= self.token_expiry
