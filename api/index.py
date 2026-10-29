"""
Vercel serverless entry point for PhishGuard FastAPI backend.
This file wraps the FastAPI app for Vercel's Python serverless runtime.
"""
import sys
import os

# Add the backend directory to path so we can import the app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from backend.app.main import app

# Vercel uses this handler
handler = app
