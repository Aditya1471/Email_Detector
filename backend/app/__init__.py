from flask import Flask
from flask_cors import CORS
from flask_pymongo import PyMongo

from backend.app.config import Config

# Initialize MongoDB driver container globally
mongo = PyMongo()

def create_app(config_class=Config):
    """Application factory instantiating configurations, database connections, and registered blueprints."""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize CORS for React client requests validation
    CORS(app, supports_credentials=True)
    
    # Initialize MongoDB connection wrapper
    try:
        mongo.init_app(app)
    except Exception as mongo_err:
        print(f"[Warning] Failed to connect to MongoDB server: {str(mongo_err)}")
    
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
            'version': '1.0.0'
        }, 200
        
    return app
