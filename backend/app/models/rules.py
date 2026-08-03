from datetime import datetime
from backend.app.database import db

class CustomRule(db.Model):
    """User whitelists & blacklists rules for blocking or bypassing sender, domain, or keyword patterns."""
    __tablename__ = 'custom_rules'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True) # NULL indicates Global system rule
    type = db.Column(db.Enum('sender', 'domain', 'keyword', name='rule_type_enum'), nullable=False)
    pattern = db.Column(db.String(255), nullable=False, index=True)
    classification = db.Column(db.Enum('whitelist', 'blacklist', name='rule_classification_enum'), nullable=False)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Serialize CustomRule object model details into standard dictionary format."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'type': self.type,
            'pattern': self.pattern,
            'classification': self.classification,
            'active': self.active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
