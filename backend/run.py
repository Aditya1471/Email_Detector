import os
from backend.app import create_app

# Create Flask application instance
app = create_app()

if __name__ == '__main__':
    # Retrieve port and host from environment, or use secure local defaults
    host = os.environ.get('HOST', '127.0.0.1')
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    # Start local development server
    app.run(host=host, port=port, debug=debug)
