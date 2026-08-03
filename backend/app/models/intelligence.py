from datetime import datetime
from backend.app.database import db

class ThreatIntel(db.Model):
    """Threat intelligence store mapping malicious elements like domains, IPs, URLs."""
    __tablename__ = 'threat_intelligence_db'
    __table_args__ = (
        db.UniqueConstraint('threat_type', 'threat_value', name='uq_threat_type_val'),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    threat_type = db.Column(db.Enum('domain', 'ip', 'url', name='threat_type_enum'), nullable=False)
    threat_value = db.Column(db.String(512), nullable=False, index=True)
    risk_score = db.Column(db.Integer, nullable=False, default=100)
    source = db.Column(db.String(100), nullable=True)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Serialize ThreatIntel object model details into standard dictionary format."""
        return {
            'id': self.id,
            'threat_type': self.threat_type,
            'threat_value': self.threat_value,
            'risk_score': self.risk_score,
            'source': self.source,
            'added_at': self.added_at.isoformat() if self.added_at else None
        }
