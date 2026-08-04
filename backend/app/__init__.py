from flask import Flask
from flask_cors import CORS
from backend.app.config import Config
from backend.app.database import db

def create_app(config_class=Config):
    """Application factory instantiating configurations, database connection fallbacks, and blueprints."""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize CORS for cross-origin React clients session cookies transfers
    CORS(app, supports_credentials=True, resources={
        r"/api/*": {
            "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
            "allow_headers": ["Content-Type", "Authorization"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        }
    })
    
    # Initialize database connection wrappers
    db.initialize(app.config['MONGO_URI'])
    
    # Register blueprints with prefix endpoints
    from backend.app.blueprints.auth import auth_bp
    from backend.app.blueprints.emails import emails_bp
    from backend.app.blueprints.dashboard import dashboard_bp
    from backend.app.blueprints.reports import reports_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(emails_bp, url_prefix='/api/emails')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    
    @app.route('/')
    def root_status_check():
        return {
            'status': 'active',
            'project': 'PhishGuard AI Phishing Email Detection Website Backend',
            'version': '1.0.0',
            'database': 'local_json_fallback' if db.is_fallback else 'mongodb_live'
        }, 200
        
    return app
