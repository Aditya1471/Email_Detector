import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_talisman import Talisman
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from backend.app.config import get_config
from backend.app.database import db

# Global extensions
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per minute"],
    storage_uri="memory://"
)

def create_app(config_class=None):
    """Application Factory Pattern initializing extensions, configs, database and blueprints."""
    # Resolve project root folders for frontend templates and static assets
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(current_dir))
    template_dir = os.path.join(project_root, 'frontend', 'templates')
    static_dir = os.path.join(project_root, 'frontend', 'static')
    
    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
    
    # 1. Load Configurations
    if not config_class:
        config_class = get_config()
    app.config.from_object(config_class)

    # 2. Bind Extensions
    db.init_app(app)
    limiter.init_app(app)
    
    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # 3. Configure HTTP Security Headers (Flask-Talisman)
    # Configure a secure but functional Content Security Policy (CSP)
    csp = {
        'default-src': "'self'",
        'script-src': [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://cdn.jsdelivr.net",
            "https://apis.google.com",
            "https://code.jquery.com"
        ],
        'style-src': [
            "'self'",
            "'unsafe-inline'",
            "https://cdn.jsdelivr.net",
            "https://fonts.googleapis.com"
        ],
        'font-src': [
            "'self'",
            "https://fonts.gstatic.com",
            "https://cdn.jsdelivr.net"
        ],
        'img-src': [
            "'self'",
            "data:",
            "https://lh3.googleusercontent.com"
        ],
        'connect-src': [
            "'self'",
            "https://apis.google.com"
        ]
    }
    
    # Enable Talisman with CSP. In development, force_https can be turned off to run on local machine without SSL.
    is_prod = os.environ.get('FLASK_ENV', 'development').lower() == 'production'
    Talisman(
        app,
        content_security_policy=csp,
        force_https=is_prod,
        strict_transport_security=is_prod
    )

    # 4. Register Blueprints
    from backend.app.blueprints.auth import auth_bp
    from backend.app.blueprints.api import api_bp
    from backend.app.blueprints.rules import rules_bp
    from backend.app.blueprints.intelligence import intel_bp
    from backend.app.blueprints.views import views_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(api_bp, url_prefix='/api/scan')
    app.register_blueprint(rules_bp, url_prefix='/api/rules')
    app.register_blueprint(intel_bp, url_prefix='/api/intelligence')
    app.register_blueprint(views_bp)

    # 5. Global API Error Handlers
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'status': 'error',
            'error_code': 'BAD_REQUEST',
            'message': str(error.description) if hasattr(error, 'description') else 'Invalid request parameters.',
            'timestamp': datetime_now_iso()
        }), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({
            'status': 'error',
            'error_code': 'UNAUTHORIZED',
            'message': 'Authentication credentials missing or invalid.',
            'timestamp': datetime_now_iso()
        }), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            'status': 'error',
            'error_code': 'FORBIDDEN',
            'message': 'You do not have permission to access this resource.',
            'timestamp': datetime_now_iso()
        }), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'status': 'error',
            'error_code': 'RESOURCE_NOT_FOUND',
            'message': 'The requested resource could not be found.',
            'timestamp': datetime_now_iso()
        }), 404

    @app.errorhandler(429)
    def ratelimit_handler(error):
        return jsonify({
            'status': 'error',
            'error_code': 'RATE_LIMIT_EXCEEDED',
            'message': f"Too many requests. Limit is {error.description}.",
            'timestamp': datetime_now_iso()
        }), 429

    @app.errorhandler(500)
    def internal_server_error(error):
        return jsonify({
            'status': 'error',
            'error_code': 'INTERNAL_SERVER_ERROR',
            'message': 'An unexpected error occurred on the server.',
            'timestamp': datetime_now_iso()
        }), 500

    # 6. Database Table Creation (convenient local auto-init)
    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            print(f"Database initialization warning (could be MySQL connection issue): {str(e)}")

    # 7. Start Background Monitoring Scheduler
    if not app.config.get('TESTING'):
        # Verify Werkzeug reloader state to prevent double threading instantiation
        if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
            from backend.app.scheduler import start_scheduler
            start_scheduler(app)

    return app

def datetime_now_iso():
    """Helper to return current UTC time in ISO formatting."""
    import datetime
    return datetime.datetime.utcnow().isoformat() + "Z"
