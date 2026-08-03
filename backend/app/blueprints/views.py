from flask import Blueprint, render_template, request, redirect, url_for
from backend.app.utils.security import decode_token

views_bp = Blueprint('views', __name__)

def check_session_valid():
    """Verify if the browser JWT session cookie is present and valid."""
    token = request.cookies.get('access_token')
    if not token:
        return False
    payload = decode_token(token)
    return 'error' not in payload and payload.get('type') == 'access'


@views_bp.route('/')
def index():
    """Redirect index requests to dashboard or login based on JWT cookies."""
    if check_session_valid():
        return redirect(url_for('views.dashboard'))
    return redirect(url_for('views.login'))


@views_bp.route('/login')
def login():
    """Render the corporate login page."""
    if check_session_valid():
        return redirect(url_for('views.dashboard'))
    return render_template('login.html')


@views_bp.route('/dashboard')
def dashboard():
    """Render the analytics dashboard page."""
    if not check_session_valid():
        return redirect(url_for('views.login'))
    return render_template('dashboard.html')


@views_bp.route('/scanning')
def scanning():
    """Render the real-time manual heuristics scanning interface."""
    if not check_session_valid():
        return redirect(url_for('views.login'))
    return render_template('scanning.html')


@views_bp.route('/history')
def history():
    """Render the historic email scan logs page."""
    if not check_session_valid():
        return redirect(url_for('views.login'))
    return render_template('history.html')


@views_bp.route('/rules')
def rules():
    """Render whitelists & blacklists configurations management page."""
    if not check_session_valid():
        return redirect(url_for('views.login'))
    return render_template('rules.html')


@views_bp.route('/intelligence')
def intelligence():
    """Render Threat Intelligence and indicators management page."""
    if not check_session_valid():
        return redirect(url_for('views.login'))
    return render_template('intelligence.html')


@views_bp.route('/settings')
def settings():
    """Render user settings and Gmail monitoring parameters page."""
    if not check_session_valid():
        return redirect(url_for('views.login'))
    return render_template('settings.html')
