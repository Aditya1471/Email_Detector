import jwt
import datetime
from functools import wraps
from flask import request, jsonify, current_app, g
from backend.app.database import db
from backend.app.models.user import User
from backend.app.models.email import AuditLog

def generate_access_token(user_id, email, role):
    """Generate a JWT access token for authentication (short lifetime)."""
    payload = {
        'exp': datetime.datetime.utcnow() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES'],
        'iat': datetime.datetime.utcnow(),
        'sub': str(user_id),
        'email': email,
        'role': role,
        'type': 'access'
    }
    return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')

def generate_refresh_token(user_id):
    """Generate a JWT refresh token for session extension (longer lifetime)."""
    payload = {
        'exp': datetime.datetime.utcnow() + current_app.config['JWT_REFRESH_TOKEN_EXPIRES'],
        'iat': datetime.datetime.utcnow(),
        'sub': str(user_id),
        'type': 'refresh'
    }
    return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')

def decode_token(token):
    """Decode and validate a JWT token, handling expiration and signature issues."""
    try:
        payload = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return {'error': 'TOKEN_EXPIRED', 'message': 'The token has expired.'}
    except jwt.InvalidTokenError:
        return {'error': 'INVALID_TOKEN', 'message': 'The token is invalid.'}

def get_token_from_request():
    """Extract token from request headers or HTTP-only cookies."""
    # 1. Check Authorization Header (e.g. Bearer <JWT>)
    auth_header = request.headers.get('Authorization', None)
    if auth_header and auth_header.startswith('Bearer '):
        return auth_header.split(' ')[1]
    
    # 2. Check Cookie fallback
    return request.cookies.get('access_token', None)

def login_required(f):
    """Decorator to require valid user JWT authentication on API endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            return jsonify({
                'status': 'error',
                'error_code': 'UNAUTHORIZED',
                'message': 'Authentication token is missing.'
            }), 401

        payload = decode_token(token)
        if 'error' in payload:
            return jsonify({
                'status': 'error',
                'error_code': payload['error'],
                'message': payload['message']
            }), 401

        if payload.get('type') != 'access':
            return jsonify({
                'status': 'error',
                'error_code': 'INVALID_TOKEN_TYPE',
                'message': 'Access token required.'
            }), 401

        user = User.query.get(int(payload['sub']))
        if not user or user.status != 'active':
            return jsonify({
                'status': 'error',
                'error_code': 'USER_INACTIVE',
                'message': 'User account is disabled or does not exist.'
            }), 401

        # Set user context in Flask's global context proxy 'g'
        g.current_user = user
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator to require Admin credentials on protected API endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            return jsonify({
                'status': 'error',
                'error_code': 'UNAUTHORIZED',
                'message': 'Authentication token is missing.'
            }), 401

        payload = decode_token(token)
        if 'error' in payload:
            return jsonify({
                'status': 'error',
                'error_code': payload['error'],
                'message': payload['message']
            }), 401

        if payload.get('role') != 'admin':
            return jsonify({
                'status': 'error',
                'error_code': 'FORBIDDEN',
                'message': 'Admin privileges required.'
            }), 403

        user = User.query.get(int(payload['sub']))
        if not user or user.status != 'active':
            return jsonify({
                'status': 'error',
                'error_code': 'USER_INACTIVE',
                'message': 'User account is disabled or does not exist.'
            }), 401

        g.current_user = user
        return f(*args, **kwargs)
    return decorated

def log_audit_action(action, user_id=None):
    """Write system modification and login events to audit log database table."""
    try:
        # Determine client request details
        ip_addr = request.remote_addr if request else None
        user_agent = request.user_agent.string if request and request.user_agent else None
        
        # If user_id is omitted, try using global user proxy context
        if not user_id and hasattr(g, 'current_user') and g.current_user:
            user_id = g.current_user.id
            
        log = AuditLog(
            user_id=user_id,
            action=action,
            ip_address=ip_addr,
            user_agent=user_agent
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        # Fail silently to avoid interrupting requests, but log to stdout
        db.session.rollback()
        print(f"Error logging audit trail: {str(e)}")
