import os
from backend.app import create_app

app = create_app()

if __name__ == '__main__':
    # Flask runner on port 5000 in debug mode
    app.run(host='0.0.0.0', port=5000, debug=True)
