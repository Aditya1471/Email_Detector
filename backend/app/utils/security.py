import time
from functools import wraps
from flask import request, jsonify, g, current_app
import jwt
from bson.objectid import ObjectId

def generate_access_token(user_id, email, role):
    """Generate short-lived JWT access token for session validation."""
    payload = {
        'user_id': str(user_id),
        'email': email,
        'role': role,
        'exp': time.time() + 3600 # 1 hour expiration
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')

def generate_refresh_token(user_id):
    """Generate long-lived JWT refresh token."""
    payload = {
        'user_id': str(user_id),
        'exp': time.time() + 7 * 24 * 3600 # 7 days expiration
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')

def decode_token(token):
    """Decode and validate a JWT token payload."""
    try:
        return jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def login_required(f):
    """Decorator ensuring request contains authenticated access token cookie or header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('access_token')
        
        # Fallback to authorization header check
        if not token and 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                
        if not token:
            return jsonify({
                'status': 'error',
                'error_code': 'UNAUTHORIZED',
                'message': 'Authentication token is missing. Please log in.'
            }), 401
            
        payload = decode_token(token)
        if not payload:
            return jsonify({
                'status': 'error',
                'error_code': 'INVALID_TOKEN',
                'message': 'Token is invalid or expired. Please log in again.'
            }), 401
            
        # Bind user matching MongoDB document to Flask global context
        from backend.app import mongo
        try:
            user = mongo.db.users.find_one({'_id': ObjectId(payload['user_id'])})
            if not user:
                return jsonify({
                    'status': 'error',
                    'error_code': 'USER_NOT_FOUND',
                    'message': 'Associated user account not found.'
                }), 404
            
            # Convert _id to string for convenience
            user['id'] = str(user['_id'])
            g.current_user = user
        except Exception as e:
            return jsonify({
                'status': 'error',
                'error_code': 'DATABASE_ERROR',
                'message': f"Database lookups failed: {str(e)}"
            }), 500
            
        return f(*args, **kwargs)
    return decorated
