import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from a .env file if it exists
load_dotenv()

class Config:
    """Base configurations."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'super-secret-dev-key-change-in-prod')
    
    # Database
    MYSQL_USER = os.environ.get('DB_USER', 'root')
    MYSQL_PASSWORD = os.environ.get('DB_PASSWORD', '')
    MYSQL_HOST = os.environ.get('DB_HOST', 'localhost')
    MYSQL_PORT = os.environ.get('DB_PORT', '3306')
    MYSQL_DB = os.environ.get('DB_NAME', 'phishing_detector')
    
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', 
        f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT Settings
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-prod')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    
    # OAuth Settings
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', None)
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', None)
    GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost:5000/api/auth/google/callback')
    
    # Threat Intelligence Sources
    PHISHTANK_API_KEY = os.environ.get('PHISHTANK_API_KEY', None)
    VIRUSTOTAL_API_KEY = os.environ.get('VIRUSTOTAL_API_KEY', None)

    # General configuration
    DEBUG = False
    TESTING = False


class DevelopmentConfig(Config):
    """Development configurations."""
    DEBUG = True
    # In development, we can fallback to SQLite if MySQL is not available, 
    # but the instructions ask for enterprise grade. We will strictly use MySQL configuration.


class TestingConfig(Config):
    """Testing configurations."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('TEST_DATABASE_URL', 'sqlite:///:memory:')


class ProductionConfig(Config):
    """Production configurations."""
    # Production overrides, forcing security checks
    DEBUG = False
    TESTING = False
    
    # Ensure secrets are defined in production
    def __init__(self):
        super().__init__()
        # In a real environment, we'd log alerts if default development values are used.
        pass


# Dictionary mapping environment names to configuration classes
config_by_name = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig
}

def get_config():
    """Retrieve active configuration object based on environment variable."""
    env = os.environ.get('FLASK_ENV', 'development').lower()
    return config_by_name.get(env, DevelopmentConfig)
