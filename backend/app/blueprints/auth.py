import os
import time
from datetime import datetime
from flask import Blueprint, request, jsonify, make_response, redirect, render_template_string, current_app, g
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google_auth_oauthlib.flow import Flow
import jwt
from bson.objectid import ObjectId

from backend.app.database import db
from backend.app.utils.security import (
    generate_access_token, 
    generate_refresh_token, 
    decode_token, 
    login_required
)

auth_bp = Blueprint('auth', __name__)

# Scopes needed for Google Email read access
SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly'
]

def get_oauth_flow():
    """Build standard Google OAuth 2.0 flow using configuration keys."""
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
        scopes=SCOPES
    )
    flow.redirect_uri = current_app.config['GOOGLE_REDIRECT_URI']
    return flow

@auth_bp.route('/login-url', methods=['GET'])
def get_login_url():
    """Retrieve Google OAuth login URL. Redirects to mock sandbox if keys are unconfigured."""
    client_id = current_app.config['GOOGLE_CLIENT_ID']
    
    # Check if keys are default placeholder values
    if not client_id or 'placeholder' in client_id.lower():
        # Return mock OAuth consent portal URL
        mock_url = f"{request.host_url.rstrip('/')}/api/auth/mock-oauth-consent"
        return jsonify({
            'status': 'success',
            'login_url': mock_url,
            'is_mock': True
        }), 200
        
    try:
        flow = get_oauth_flow()
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        return jsonify({
            'status': 'success',
            'login_url': authorization_url,
            'is_mock': False
        }), 200
    except Exception as e:
        # Fallback to mock URL if Google API helper setup throws configuration errors
        mock_url = f"{request.host_url.rstrip('/')}/api/auth/mock-oauth-consent"
        return jsonify({
            'status': 'success',
            'login_url': mock_url,
            'is_mock': True,
            'config_error': str(e)
        }), 200

@auth_bp.route('/mock-oauth-consent', methods=['GET'])
def mock_oauth_consent():
    """Render a simulated Google OAuth account chooser screen for easy demo presentation."""
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Google Accounts Sandbox Consent</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                background-color: #0A0D14;
                color: #FFF;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
            }
            .card {
                background: #111522;
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 12px;
                padding: 32px;
                max-width: 400px;
                width: 100%;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            h2 { color: #06B6D4; margin-bottom: 8px; }
            p { color: #9CA3AF; font-size: 14px; margin-bottom: 24px; }
            .btn-account {
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.1);
                color: #F3F4F6;
                padding: 12px 16px;
                border-radius: 8px;
                width: 100%;
                text-align: left;
                margin-bottom: 12px;
                cursor: pointer;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 12px;
                transition: 0.2s;
            }
            .btn-account:hover {
                background: rgba(255,255,255,0.08);
                border-color: #06B6D4;
            }
            .avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: #6366F1;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 14px;
            }
            .custom-form {
                margin-top: 20px;
                border-top: 1px solid rgba(255,255,255,0.08);
                padding-top: 20px;
            }
            input {
                width: 100%;
                padding: 10px;
                border-radius: 6px;
                border: 1px solid rgba(255,255,255,0.1);
                background: rgba(0,0,0,0.2);
                color: #FFF;
                margin-bottom: 12px;
                box-sizing: border-box;
            }
            .btn-submit {
                background: linear-gradient(135deg, #06B6D4 0%, #6366F1 100%);
                color: #FFF;
                border: none;
                padding: 10px;
                width: 100%;
                border-radius: 6px;
                font-weight: bold;
                cursor: pointer;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>Google Consent Sandbox</h2>
            <p>Select a simulated email account to connect to PhishGuard</p>
            
            <button class="btn-account" onclick="chooseAccount('student-presenter@gmail.com', 'Student Presenter')">
                <div class="avatar">S</div>
                <div>
                    <div>Student Presenter</div>
                    <div style="font-size:12px; color:#9CA3AF;">student-presenter@gmail.com</div>
                </div>
            </button>
            
            <button class="btn-account" onclick="chooseAccount('reviewer-company@gmail.com', 'Company Evaluator')">
                <div class="avatar" style="background:#10B981;">C</div>
                <div>
                    <div>Company Evaluator</div>
                    <div style="font-size:12px; color:#9CA3AF;">reviewer-company@gmail.com</div>
                </div>
            </button>
            
            <div class="custom-form">
                <input type="email" id="custom-email" placeholder="Or enter custom email..." required>
                <input type="text" id="custom-name" placeholder="Or enter custom name..." required>
                <button class="btn-submit" onclick="submitCustom()">Use Custom Identity</button>
            </div>
        </div>

        <script>
            function chooseAccount(email, name) {
                const redirectUri = window.location.origin + "/api/auth/callback?mock_email=" + encodeURIComponent(email) + "&mock_name=" + encodeURIComponent(name);
                window.location.href = redirectUri;
            }
            function submitCustom() {
                const email = document.getElementById('custom-email').value;
                const name = document.getElementById('custom-name').value || email.split('@')[0];
                if (email && email.includes('@')) {
                    chooseAccount(email, name);
                } else {
                    alert('Please enter a valid email address.');
                }
            }
        </script>
    </body>
    </html>
    """
    return render_template_string(html_template)

@auth_bp.route('/callback', methods=['GET', 'POST'])
def oauth_callback():
    """Handle Google OAuth callback redirection. Saves tokens in MongoDB."""
    mock_email = request.args.get('mock_email')
    mock_name = request.args.get('mock_name', 'Sandbox User')
    
    email = None
    name = None
    access_token_val = "mock_access_token"
    refresh_token_val = "mock_refresh_token"
    scopes_val = SCOPES
    
    if mock_email:
        # Mock sandbox login flow
        email = mock_email.lower().strip()
        name = mock_name
    else:
        # Real Google API exchange flow
        try:
            flow = get_oauth_flow()
            flow.fetch_token(authorization_response=request.url)
            credentials = flow.credentials
            
            # Verify Google ID Token
            id_info = id_token.verify_oauth2_token(
                credentials.id_token,
                google_requests.Request(),
                current_app.config['GOOGLE_CLIENT_ID']
            )
            
            email = id_info['email'].lower().strip()
            name = id_info.get('name', email.split('@')[0].capitalize())
            access_token_val = credentials.token
            refresh_token_val = credentials.refresh_token or ""
            scopes_val = credentials.scopes
        except Exception as oauth_err:
            return jsonify({
                'status': 'error',
                'error_code': 'OAUTH_EXCHANGE_FAILED',
                'message': f"OAuth token exchange failed: {str(oauth_err)}"
            }), 400

    # Insert or update user details in MongoDB
    users_col = db.users
    user = users_col.find_one({'email': email})
    
    role = 'user'
    # Auto-escalate the first presenter/admin user
    if users_col.count_documents({}) == 0 or 'presenter' in email:
        role = 'admin'
        
    user_data = {
        'email': email,
        'full_name': name,
        'role': role,
        'connected_at': datetime.utcnow(),
        'tokens': {
            'access_token': access_token_val,
            'refresh_token': refresh_token_val,
            'token_uri': 'https://oauth2.googleapis.com/token',
            'scopes': scopes_val
        }
    }
    
    if user:
        # Update existing record
        users_col.update_one({'_id': user['_id']}, {'$set': user_data})
        user_id = str(user['_id'])
    else:
        # Create new record
        res = users_col.insert_one(user_data)
        user_id = str(res.inserted_id)

    # Generate security JWT tokens for session cookies
    access_token = generate_access_token(user_id, email, role)
    refresh_token = generate_refresh_token(user_id)

    # Redirect user back to React frontend dashboard
    frontend_url = "http://localhost:5173"
    response = redirect(frontend_url)
    
    response.set_cookie(
        'access_token',
        access_token,
        httponly=True,
        samesite='Lax',
        max_age=3600
    )
    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )
    return response

@auth_bp.route('/me', methods=['GET'])
@login_required
def get_user_profile():
    """Retrieve authenticated user details profile."""
    user = g.current_user.copy()
    user['id'] = str(user.get('_id', ''))
    user.pop('_id', None)
    user.pop('tokens', None)
    return jsonify({
        'status': 'success',
        'user': user
    }), 200

@auth_bp.route('/status', methods=['GET'])
def get_auth_status():
    """Verify if session cookies are active and authenticated."""
    token = request.cookies.get('access_token')
    if not token:
        return jsonify({'status': 'success', 'authenticated': False}), 200
        
    payload = decode_token(token)
    if not payload:
        return jsonify({'status': 'success', 'authenticated': False}), 200
        
    return jsonify({
        'status': 'success',
        'authenticated': True,
        'user_id': payload['user_id'],
        'email': payload['email'],
        'role': payload['role']
    }), 200

@auth_bp.route('/logout', methods=['POST'])
def logout_user():
    """Clean session cookies and close portal authentication."""
    response = make_response(jsonify({
        'status': 'success',
        'message': 'Logged out successfully.'
    }), 200)
    response.set_cookie('access_token', '', expires=0)
    response.set_cookie('refresh_token', '', expires=0)
    return response
