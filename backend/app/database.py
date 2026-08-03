from flask_sqlalchemy import SQLAlchemy

# Initialize the SQLAlchemy extension. 
# It will be bound to the Flask application object inside the app factory.
db = SQLAlchemy()
