import os
from flask import Blueprint, request, jsonify, make_response, current_app, g
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google_auth_oauthlib.flow import Flow
import jwt
from werkzeug.security import generate_password_hash, check_password_hash

from backend.app.database import db
from backend.app.models.user import User, OAuthAccount
from backend.app.utils.security import (
    generate_access_token, 
    generate_refresh_token, 
    decode_token, 
    login_required,
    log_audit_action
)

auth_bp = Blueprint('auth', __name__)

# Scopes needed for Gmail reading and user email inspection
SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
]

def get_oauth_flow(state=None):
    """Initialize Google OAuth 2.0 flow using configuration parameters."""
    client_config = {
        "web": {
            "client_id": current_app.config['GOOGLE_CLIENT_ID'],
            "client_secret": current_app.config['GOOGLE_CLIENT_SECRET'],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "redirect_uris": [current_app.config['GOOGLE_REDIRECT_URI']]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        state=state
    )
    flow.redirect_uri = current_app.config['GOOGLE_REDIRECT_URI']
    return flow


@auth_bp.route('/google/login', methods=['GET'])
def google_login():
    """Generates the Google OAuth 2.0 redirection URL and state parameter."""
    google_client_id = current_app.config.get('GOOGLE_CLIENT_ID')
    
    # Fallback/Mock auth route for local development if client ID is missing
    if not google_client_id:
        return jsonify({
            'status': 'warning',
            'message': 'Google Client ID is not configured. Redirecting to mock login endpoints.',
            'mock_auth_url': f"http://localhost:5000/api/auth/mock-login"
        }), 200

    try:
        flow = get_oauth_flow()
        auth_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='select_account'
        )
        
        # Save state token in session or verify against state payload on frontend later
        return jsonify({
            'status': 'success',
            'auth_url': auth_url,
            'state': state
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error_code': 'OAUTH_INIT_FAILED',
            'message': f"Failed to initialize OAuth sequence: {str(e)}"
        }), 500


@auth_bp.route('/google/callback', methods=['POST'])
def google_callback():
    """Process OAuth redirection code, upsert user and return authorization JWTs."""
    data = request.get_json()
    code = data.get('code')
    state = data.get('state')
    
    if not code:
        return jsonify({
            'status': 'error',
            'error_code': 'MISSING_OAUTH_CODE',
            'message': 'Authorization code from Google was not provided.'
        }), 400

    try:
        # 1. Exchange auth code for tokens
        flow = get_oauth_flow(state=state)
        flow.fetch_token(code=code)
        credentials = flow.credentials

        # 2. Verify Google ID token and extract user details
        token_info = id_token.verify_oauth2_token(
            credentials.id_token,
            google_requests.Request(),
            current_app.config['GOOGLE_CLIENT_ID']
        )
        
        email = token_info.get('email')
        name = token_info.get('name')
        sub = token_info.get('sub') # Unique Google ID

        if not email:
            return jsonify({
                'status': 'error',
                'error_code': 'EMAIL_NOT_PROVIDED',
                'message': 'Email address was not provided by external auth provider.'
            }), 400

        # 3. Create or Update user record
        user = User.query.filter_by(email=email).first()
        if not user:
            # Check if this is the first user to set admin rights
            is_first_user = User.query.count() == 0
            user = User(
                email=email,
                full_name=name,
                role='admin' if is_first_user else 'user',
                status='active'
            )
            db.session.add(user)
            db.session.commit()

        # 4. Create/update linked OAuthAccount details
        oauth_account = OAuthAccount.query.filter_by(
            provider='google', 
            provider_user_id=sub
        ).first()

        if not oauth_account:
            oauth_account = OAuthAccount(
                user_id=user.id,
                provider='google',
                provider_user_id=sub
            )
            db.session.add(oauth_account)

        # Store encrypted/plain refresh tokens to perform background checks later
        oauth_account.access_token = credentials.token
        if credentials.refresh_token:
            oauth_account.refresh_token = credentials.refresh_token
        
        if credentials.expiry:
            oauth_account.token_expiry = credentials.expiry

        db.session.commit()

        # 5. Generate secure JWT tokens
        access_token = generate_access_token(user.id, user.email, user.role)
        refresh_token = generate_refresh_token(user.id)

        # 6. Log audit event
        log_audit_action(action=f"User {email} logged in via Google OAuth.", user_id=user.id)

        # 7. Package response containing user details and set HTTPOnly cookies
        response = make_response(jsonify({
            'status': 'success',
            'user': user.to_dict()
        }))
        
        # Set access token cookie
        response.set_cookie(
            'access_token',
            access_token,
            httponly=True,
            secure=current_app.config.get('ENV') == 'production',
            samesite='Lax',
            max_age=15 * 60 # 15 minutes
        )
        
        # Set refresh token cookie
        response.set_cookie(
            'refresh_token',
            refresh_token,
            httponly=True,
            secure=current_app.config.get('ENV') == 'production',
            samesite='Lax',
            max_age=7 * 24 * 60 * 60 # 7 days
        )

        return response

    except ValueError:
        # ID Token verification failed
        return jsonify({
            'status': 'error',
            'error_code': 'INVALID_TOKEN_SIGNATURE',
            'message': 'The security signature from Google verification checks failed.'
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'error_code': 'CALLBACK_PROCESSING_FAILED',
            'message': f"An error occurred: {str(e)}"
        }), 500


@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user_profile():
    """Retrieve detailed dashboard records for currently authenticated user."""
    return jsonify({
        'status': 'success',
        'user': g.current_user.to_dict()
    }), 200


@auth_bp.route('/logout', methods=['POST'])
def logout_user():
    """Clear session tokens and logs logout events."""
    # Try logging audit action if user was authenticated
    token = request.cookies.get('access_token', None)
    if token:
        payload = decode_token(token)
        if 'sub' in payload and 'error' not in payload:
            log_audit_action(action="User logged out successfully.", user_id=int(payload['sub']))

    response = make_response(jsonify({
        'status': 'success',
        'message': 'Successfully logged out user.'
    }))
    
    # Clear access and refresh token cookies
    response.delete_cookie('access_token')
    response.delete_cookie('refresh_token')
    return response


@auth_bp.route('/refresh', methods=['POST'])
def refresh_access_token():
    """Exchange a valid Refresh Token cookie for a new Access Token cookie."""
    refresh_token = request.cookies.get('refresh_token')
    if not refresh_token:
        return jsonify({
            'status': 'error',
            'error_code': 'MISSING_REFRESH_TOKEN',
            'message': 'Refresh token is missing.'
        }), 401

    payload = decode_token(refresh_token)
    if 'error' in payload:
        return jsonify({
            'status': 'error',
            'error_code': payload['error'],
            'message': payload['message']
        }), 401

    if payload.get('type') != 'refresh':
        return jsonify({
            'status': 'error',
            'error_code': 'INVALID_TOKEN_TYPE',
            'message': 'Valid refresh token is required.'
        }), 401

    user = User.query.get(int(payload['sub']))
    if not user or user.status != 'active':
        return jsonify({
            'status': 'error',
            'error_code': 'USER_INACTIVE',
            'message': 'User associated with token is inactive or deleted.'
        }), 401

    # Generate new access token
    new_access_token = generate_access_token(user.id, user.email, user.role)
    
    response = make_response(jsonify({
        'status': 'success',
        'message': 'Token refreshed successfully.'
    }))
    
    response.set_cookie(
        'access_token',
        new_access_token,
        httponly=True,
        secure=current_app.config.get('ENV') == 'production',
        samesite='Lax',
        max_age=15 * 60
    )
    
    return response


@auth_bp.route('/mock-login', methods=['GET', 'POST'])
def mock_login():
    """Development mock login endpoint bypassing Google API configuration constraints."""
    if current_app.config.get('ENV') == 'production':
        return jsonify({
            'status': 'error',
            'error_code': 'MOCK_DISABLED',
            'message': 'Mock endpoints are disabled in production configurations.'
        }), 403

    # Ensure a default mock admin user exists in development database
    mock_email = "dev-admin@cyberguard-phish.local"
    user = User.query.filter_by(email=mock_email).first()
    if not user:
        user = User(
            email=mock_email,
            full_name="Developer Local Administrator",
            role="admin",
            status="active"
        )
        db.session.add(user)
        db.session.commit()

        # Add a dummy OAuth Account too
        oauth = OAuthAccount(
            user_id=user.id,
            provider="google",
            provider_user_id="mock_oauth_sub_12345"
        )
        db.session.add(oauth)
        db.session.commit()

    # Generate tokens
    access_token = generate_access_token(user.id, user.email, user.role)
    refresh_token = generate_refresh_token(user.id)

    log_audit_action(action="Developer bypass login executed locally.", user_id=user.id)

    response = make_response(jsonify({
        'status': 'success',
        'message': 'Bypassed authentication successfully utilizing dev-admin credentials.',
        'user': user.to_dict(),
        'tokens_for_testing': {
            'access_token': access_token,
            'refresh_token': refresh_token
        }
    }))

    response.set_cookie(
        'access_token',
        access_token,
        httponly=True,
        samesite='Lax',
        max_age=15 * 60
    )
    
    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )

    return response


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user utilizing email/password or phone number."""
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    phone_number = data.get('phone_number', '').strip()
    password = data.get('password', '')
    full_name = data.get('full_name', '').strip() or "Standard User"

    # Validation
    if not password or len(password) < 6:
        return jsonify({
            'status': 'error',
            'error_code': 'VALIDATION_FAILED',
            'message': 'Password is required and must be at least 6 characters long.'
        }), 400

    if not email and not phone_number:
        return jsonify({
            'status': 'error',
            'error_code': 'VALIDATION_FAILED',
            'message': 'An email address or phone number is required to register.'
        }), 400

    # Ensure unique email
    if email:
        existing_email = User.query.filter_by(email=email).first()
        if existing_email:
            return jsonify({
                'status': 'error',
                'error_code': 'EMAIL_EXISTS',
                'message': 'A user account with this email address already exists.'
            }), 409

    # Ensure unique phone
    if phone_number:
        existing_phone = User.query.filter_by(phone_number=phone_number).first()
        if existing_phone:
            return jsonify({
                'status': 'error',
                'error_code': 'PHONE_EXISTS',
                'message': 'A user account with this phone number already exists.'
            }), 409

    # Generate dummy email if registering only with phone number to comply with NOT NULL constraint
    user_email = email if email else f"phone_{phone_number}@cyberguard-local.net"

    user = User(
        email=user_email,
        phone_number=phone_number if phone_number else None,
        full_name=full_name,
        password_hash=generate_password_hash(password),
        role='user',
        status='active'
    )

    try:
        db.session.add(user)
        db.session.commit()
        log_audit_action(action=f"Self-registration completed: {user_email}", user_id=user.id)
        return jsonify({
            'status': 'success',
            'message': 'Account created successfully. You can now log in.',
            'user': user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'error_code': 'DATABASE_ERROR',
            'message': f"Failed to register account: {str(e)}"
        }), 500


@auth_bp.route('/manual-login', methods=['POST'])
def manual_login():
    """Authenticate a user utilizing email/phone and password credentials."""
    data = request.get_json() or {}
    login_id = data.get('login_id', '').strip().lower()
    password = data.get('password', '')

    if not login_id or not password:
        return jsonify({
            'status': 'error',
            'error_code': 'VALIDATION_FAILED',
            'message': 'Identifier and password credentials are required.'
        }), 400

    # Query by email or phone
    user = User.query.filter(
        (User.email == login_id) | (User.phone_number == login_id)
    ).first()

    if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
        return jsonify({
            'status': 'error',
            'error_code': 'INVALID_CREDENTIALS',
            'message': 'Invalid login credentials.'
        }), 401

    if user.status != 'active':
        return jsonify({
            'status': 'error',
            'error_code': 'ACCOUNT_SUSPENDED',
            'message': 'This account has been suspended by system administrators.'
        }), 403

    # Generate JWT
    access_token = generate_access_token(user.id, user.email, user.role)
    refresh_token = generate_refresh_token(user.id)

    log_audit_action(action="Manual credential login completed.", user_id=user.id)

    response = make_response(jsonify({
        'status': 'success',
        'message': 'Authenticated successfully.',
        'user': user.to_dict(),
        'tokens_for_testing': {
            'access_token': access_token,
            'refresh_token': refresh_token
        }
    }))

    response.set_cookie(
        'access_token',
        access_token,
        httponly=True,
        samesite='Lax',
        max_age=15 * 60
    )
    
    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )

    return response


@auth_bp.route('/guest-login', methods=['POST'])
def guest_login():
    """Authenticate and log in as a Guest Investigator."""
    import random
    import time
    
    # Generate unique guest parameters
    guest_id = int(time.time()) + random.randint(100, 999)
    guest_email = f"guest_{guest_id}@cyberguard-guest.local"
    
    user = User(
        email=guest_email,
        full_name=f"Guest Investigator #{guest_id}",
        role='user',
        status='active'
    )

    try:
        db.session.add(user)
        db.session.commit()
        log_audit_action(action="Guest bypass login session started.", user_id=user.id)
    except Exception as db_err:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'error_code': 'DATABASE_ERROR',
            'message': f"Failed to initialize guest session: {str(db_err)}"
        }), 500

    # Generate JWT
    access_token = generate_access_token(user.id, user.email, user.role)
    refresh_token = generate_refresh_token(user.id)

    response = make_response(jsonify({
        'status': 'success',
        'message': 'Guest session started successfully.',
        'user': user.to_dict(),
        'tokens_for_testing': {
            'access_token': access_token,
            'refresh_token': refresh_token
        }
    }))

    response.set_cookie(
        'access_token',
        access_token,
        httponly=True,
        samesite='Lax',
        max_age=15 * 60
    )
    
    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )

    return response
