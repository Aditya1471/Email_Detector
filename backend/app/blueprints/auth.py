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

# Scopes needed for Google Email read and modify access
SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.modify'
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
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            body {
                background: radial-gradient(circle at center, rgba(10, 15, 20, 0.75) 0%, rgba(5, 7, 10, 0.95) 100%), url('http://localhost:5173/login_bg.jpg');
                background-size: cover;
                background-position: center;
                background-attachment: fixed;
                color: #FFF;
                font-family: 'Outfit', sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                position: relative;
            }
            .navbar {
                position: absolute;
                top: 30px;
                left: 0;
                right: 0;
                padding: 0 60px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-sizing: border-box;
                width: 100%;
            }
            .logo-group {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .logo-main {
                font-size: 22px;
                font-weight: 900;
                letter-spacing: 1px;
                color: #FFF;
                line-height: 1;
            }
            .logo-sub {
                font-size: 9px;
                color: #10B981;
                font-weight: 700;
                letter-spacing: 0.5px;
                margin-top: 4px;
            }
            .nav-links {
                display: flex;
                align-items: center;
                gap: 24px;
            }
            .nav-link {
                font-size: 14px;
                color: #9CA3AF;
                cursor: pointer;
                font-weight: 500;
            }
            .nav-open-btn {
                background: rgba(255, 255, 255, 0.85);
                color: #111827;
                border: none;
                padding: 8px 24px;
                border-radius: 8px;
                font-weight: 700;
                font-size: 14px;
                cursor: pointer;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            }
            .card {
                background: rgba(15, 23, 42, 0.85);
                border: 2px solid #10B981;
                border-radius: 16px;
                padding: 40px;
                max-width: 460px;
                width: 90%;
                box-sizing: border-box;
                box-shadow: 0 0 35px rgba(16, 185, 129, 0.25);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                text-align: center;
                margin-top: 60px;
            }
            h2 { font-size: 24px; font-weight: 700; margin: 0 0 8px 0; color: #FFF; }
            p { color: #9CA3AF; font-size: 13.5px; margin: 0 0 32px 0; line-height: 1.4; }
            .btn-account {
                background: rgba(0, 0, 0, 0.25);
                border: 1px solid rgba(255, 255, 255, 0.08);
                color: #F3F4F6;
                padding: 14px 18px;
                border-radius: 8px;
                width: 100%;
                text-align: left;
                margin-bottom: 12px;
                cursor: pointer;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 14px;
                transition: 0.2s;
                font-family: 'Outfit', sans-serif;
            }
            .btn-account:hover {
                background: rgba(16, 185, 129, 0.05);
                border-color: #10B981;
                box-shadow: 0 0 10px rgba(16, 185, 129, 0.15);
            }
            .avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: #6366F1;
                display: flex;
                align-items: center;
                justify: center;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 15px;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
                flex-shrink: 0;
            }
            .custom-form {
                margin-top: 24px;
                border-top: 1px solid rgba(255,255,255,0.08);
                padding-top: 24px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            input {
                width: 100%;
                padding: 12px 14px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.08);
                background: rgba(0,0,0,0.25);
                color: #FFF;
                font-size: 14px;
                outline: none;
                box-sizing: border-box;
                font-family: 'Outfit', sans-serif;
                transition: border-color 0.2s;
            }
            input:focus {
                border-color: #10B981;
            }
            .btn-submit {
                background: #10B981;
                color: #FFF;
                border: none;
                padding: 14px;
                width: 100%;
                border-radius: 8px;
                font-weight: 800;
                font-size: 14px;
                cursor: pointer;
                box-shadow: 0 0 15px rgba(16, 185, 129, 0.35);
                transition: 0.2s;
                font-family: 'Outfit', sans-serif;
            }
            .btn-submit:hover {
                background: #059669;
            }
            .footer {
                position: absolute;
                bottom: 24px;
                font-size: 12px;
                color: #4B5563;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <!-- NAVBAR -->
        <header class="navbar">
            <div class="logo-group">
                <div class="shield-icon">
                    <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
                        <path d="M12 2L2 6v8c0 5.52 4.48 10 10 10s10-4.48 10-10V6L12 2z" stroke="#10B981" strokeWidth="2.5" fill="rgba(16, 185, 129, 0.1)"/>
                        <path d="M12 7v10M9 12h6" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                </div>
                <div>
                    <div class="logo-main">PHISHGUARD</div>
                    <div class="logo-sub">AI PHISHING EMAIL DETECTION</div>
                </div>
            </div>
            <div class="nav-links">
                <span class="nav-link">Support</span>
                <span class="nav-link">Docs</span>
                <button class="nav-open-btn">Open</button>
            </div>
        </header>

        <!-- MAIN CARD -->
        <div class="card">
            <h2>Google Consent Sandbox</h2>
            <p>Select a simulated email account to connect to PhishGuard</p>
            
            <button class="btn-account" onclick="chooseAccount('student-presenter@gmail.com', 'Student Presenter')">
                <div class="avatar">S</div>
                <div>
                    <div>Student Presenter</div>
                    <div style="font-size:12px; color:#9CA3AF; font-weight:normal; margin-top:2px;">student-presenter@gmail.com</div>
                </div>
            </button>
            
            <button class="btn-account" onclick="chooseAccount('reviewer-company@gmail.com', 'Company Evaluator')">
                <div class="avatar" style="background:#10B981; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25)">C</div>
                <div>
                    <div>Company Evaluator</div>
                    <div style="font-size:12px; color:#9CA3AF; font-weight:normal; margin-top:2px;">reviewer-company@gmail.com</div>
                </div>
            </button>
            
            <div class="custom-form">
                <input type="email" id="custom-email" placeholder="Or enter custom email..." required>
                <input type="text" id="custom-name" placeholder="Or enter custom name..." required>
                <button class="btn-submit" onclick="submitCustom()">Use Custom Identity</button>
            </div>
        </div>

        <!-- FOOTER -->
        <footer class="footer">
            © 2026 PhishGuard Inc. | Privacy Policy | Terms of Service
        </footer>

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

@auth_bp.route('/login-direct', methods=['POST'])
def login_direct():
    """Verify IMAP credentials directly, create user, and generate session cookie in a single step."""
    import imaplib
    import threading
    data = request.get_json() or {}
    email_addr = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    imap_server = data.get('server', 'imap.gmail.com').strip()
    
    if not email_addr or not password:
        return jsonify({
            'status': 'error',
            'message': 'Email address and App Password are required.'
        }), 400
        
    # Verify connection first (so user gets instant validation error on typo)
    try:
        mail = imaplib.IMAP4_SSL(imap_server)
        mail.login(email_addr, password)
        mail.logout()
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"Mail connection failed: {str(e)}. Please check your App Password or ensure IMAP settings are enabled in Gmail."
        }), 400
        
    # Find or create user
    user = db.users.find_one({'email': email_addr})
    if not user:
        # Create standard investigator user
        new_user = {
            'email': email_addr,
            'name': email_addr.split('@')[0].capitalize(),
            'role': 'investigator',
            'created_at': datetime.utcnow(),
            'tokens': {
                'access_token': 'mock_direct_imap_sync',
                'refresh_token': 'mock_direct_imap_sync'
            },
            'imap_config': {
                'email': email_addr,
                'password': password,
                'server': imap_server,
                'connected_at': datetime.utcnow().isoformat()
            }
        }
        res = db.users.insert_one(new_user)
        user_id = str(res.inserted_id)
        role = 'investigator'
    else:
        user_id = str(user['_id'])
        role = user.get('role', 'investigator')
        # Update connection configuration
        db.users.update_one(
            {'_id': user['_id']},
            {'$set': {
                'imap_config': {
                    'email': email_addr,
                    'password': password,
                    'server': imap_server,
                    'connected_at': datetime.utcnow().isoformat()
                }
            }}
        )
        
    # Trigger initial scan in a background thread so the user doesn't wait too long to login
    from backend.app.blueprints.emails import sync_user_imap_inbox_realtime
    threading.Thread(target=sync_user_imap_inbox_realtime, args=(user_id,), daemon=True).start()
    
    # Create session tokens
    access_token = generate_access_token(user_id, email_addr, role)
    refresh_token = generate_refresh_token(user_id)
    
    response = make_response(jsonify({
        'status': 'success',
        'message': 'Login and mailbox link successful!',
        'user': {
            'id': user_id,
            'email': email_addr,
            'role': role
        }
    }), 200)
    
    response.set_cookie(
        'access_token',
        access_token,
        httponly=True,
        secure=False,  # localhost local testing
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )
    
    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        secure=False,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )
    
    return response

@auth_bp.route('/register', methods=['POST'])
def register_user():
    """Register a new investigator user in the system database."""
    import imaplib
    import threading
    data = request.get_json() or {}
    email_addr = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    name = data.get('name', '').strip()
    imap_server = data.get('server', 'imap.gmail.com').strip()
    
    if not email_addr or not name:
        return jsonify({
            'status': 'error',
            'message': 'Name and Gmail address are required.'
        }), 400
        
    # Check if user already exists
    users_col = db.users
    existing = users_col.find_one({'email': email_addr})
    if existing:
        return jsonify({
            'status': 'error',
            'message': 'Email address is already registered. Please sign in instead.'
        }), 400
        
    # Verify IMAP credentials if password is provided
    if password:
        try:
            mail = imaplib.IMAP4_SSL(imap_server)
            mail.login(email_addr, password)
            mail.logout()
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f"Mail connection failed: {str(e)}. Please check your App Password or ensure IMAP settings are enabled in Gmail."
            }), 400
            
    # Create new record
    role = 'investigator'
    # Auto-escalate the first presenter/admin user
    if users_col.count_documents({}) == 0 or 'presenter' in email_addr:
        role = 'admin'
        
    new_user = {
        'email': email_addr,
        'name': name,
        'role': role,
        'created_at': datetime.utcnow(),
        'tokens': {
            'access_token': 'mock_direct_imap_sync',
            'refresh_token': 'mock_direct_imap_sync'
        },
        'imap_config': {
            'email': email_addr,
            'password': password,
            'server': imap_server,
            'connected_at': datetime.utcnow().isoformat()
        } if password else None
    }
    res = users_col.insert_one(new_user)
    user_id = str(res.inserted_id)
    
    # Trigger initial scan in a background thread if password provided
    if password:
        from backend.app.blueprints.emails import sync_user_imap_inbox_realtime
        threading.Thread(target=sync_user_imap_inbox_realtime, args=(user_id,), daemon=True).start()
        
    # Create session tokens
    access_token = generate_access_token(user_id, email_addr, role)
    refresh_token = generate_refresh_token(user_id)
    
    response = make_response(jsonify({
        'status': 'success',
        'message': 'Registration and link successful!',
        'user': {
            'id': user_id,
            'email': email_addr,
            'role': role
        }
    }), 200)
    
    response.set_cookie(
        'access_token',
        access_token,
        httponly=True,
        secure=False,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )
    
    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        secure=False,
        samesite='Lax',
        max_age=7 * 24 * 60 * 60
    )
    
    return response

@auth_bp.route('/reset-password', methods=['POST'])
def reset_user_password():
    """Clear the stored IMAP app password for a given email to allow reconnection."""
    data = request.get_json() or {}
    email_addr = data.get('email', '').strip().lower()
    
    if not email_addr:
        return jsonify({
            'status': 'error',
            'message': 'Gmail address is required to reset configuration.'
        }), 400
        
    users_col = db.users
    user = users_col.find_one({'email': email_addr})
    if not user:
        return jsonify({
            'status': 'error',
            'message': 'This email address is not registered in the system.'
        }), 404
        
    # Clear the stored password in imap_config
    if user.get('imap_config'):
        users_col.update_one(
            {'_id': user['_id']},
            {'$set': {
                'imap_config.password': ''
            }}
        )
        
    return jsonify({
        'status': 'success',
        'message': 'Stored credentials cleared. You can now connect a new Google App Password!'
    }), 200
