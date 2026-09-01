import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self, **kwargs):
        # Override fields dynamically via kwargs
        for key, value in kwargs.items():
            setattr(self, key, value)

    APP_NAME: str = os.getenv("APP_NAME", "PhishGuard API")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    APP_HOST: str = os.getenv("APP_HOST", "127.0.0.1")
    APP_PORT: int = int(os.getenv("APP_PORT", "8000"))

    # CORS setup
    cors_str = os.getenv("ALLOWED_CORS_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000")
    ALLOWED_CORS_ORIGINS: list = [origin.strip() for origin in cors_str.split(",") if origin.strip()]

    # Model configuration
    BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))
    MODEL_PATH: str = os.getenv("MODEL_PATH", os.path.join(BASE_DIR, "ml", "phishing_model.joblib"))
    METADATA_PATH: str = os.path.join(BASE_DIR, "ml", "metadata.json")

    # Database configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg://phishguard:replace-password@localhost:5432/phishguard")
    DATABASE_ECHO: bool = os.getenv("DATABASE_ECHO", "false").lower() == "true"
    TEST_DATABASE_URL: str = os.getenv("TEST_DATABASE_URL", "sqlite+pysqlite:///./test.db")

    # JWT Authentication configuration
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "replace-with-a-long-random-development-secret")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

    # Production hardening settings
    ALLOWED_HOSTS_STR: str = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
    MAX_REQUEST_BODY_BYTES: int = int(os.getenv("MAX_REQUEST_BODY_BYTES", "1048576"))  # Default 1MB
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # HSTS Configuration settings
    ENABLE_HSTS: bool = os.getenv("ENABLE_HSTS", "false").lower() == "true"
    HSTS_MAX_AGE: int = int(os.getenv("HSTS_MAX_AGE", "86400"))  # Default 1 day
    HSTS_INCLUDE_SUBDOMAINS: bool = os.getenv("HSTS_INCLUDE_SUBDOMAINS", "false").lower() == "true"
    HSTS_PRELOAD: bool = os.getenv("HSTS_PRELOAD", "false").lower() == "true"

    # Token Encryption and OAuth Settings
    TOKEN_ENCRYPTION_KEY: str = os.getenv("TOKEN_ENCRYPTION_KEY", "qO9LSTDQJdKmym0dqxcC42v1VlZUXQhBTWJ6sfIewUw=")
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "mock-google-client-id.apps.googleusercontent.com")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "mock-google-client-secret")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/v1/integrations/gmail/callback")
    FRONTEND_INTEGRATIONS_URL: str = os.getenv("FRONTEND_INTEGRATIONS_URL", "http://localhost:5500/integrations.html")

    # Gmail Synchronization Settings
    GMAIL_SYNC_MAX_MESSAGES: int = int(os.getenv("GMAIL_SYNC_MAX_MESSAGES", "20"))
    GMAIL_SYNC_LOOKBACK_HOURS: int = int(os.getenv("GMAIL_SYNC_LOOKBACK_HOURS", "24"))
    GMAIL_SYNC_QUERY: str = os.getenv("GMAIL_SYNC_QUERY", "in:inbox newer_than:1d")

    # Microsoft Graph / Outlook Integration Settings
    MICROSOFT_CLIENT_ID: str = os.getenv("MICROSOFT_CLIENT_ID", "mock-microsoft-client-id")
    MICROSOFT_CLIENT_SECRET: str = os.getenv("MICROSOFT_CLIENT_SECRET", "mock-microsoft-client-secret")
    MICROSOFT_REDIRECT_URI: str = os.getenv("MICROSOFT_REDIRECT_URI", "http://localhost:8000/api/v1/integrations/outlook/callback")
    MICROSOFT_SCOPES: str = os.getenv("MICROSOFT_SCOPES", "openid profile email offline_access User.Read Mail.Read")
    MICROSOFT_AUTHORITY: str = os.getenv("MICROSOFT_AUTHORITY", "https://login.microsoftonline.com/common")
    MICROSOFT_WEBHOOK_URL: str = os.getenv("MICROSOFT_WEBHOOK_URL", "http://localhost:8000/api/v1/integrations/outlook/webhook")
    MICROSOFT_WEBHOOK_CLIENT_STATE: str = os.getenv("MICROSOFT_WEBHOOK_CLIENT_STATE", "phishguard-ms-graph-webhook-secret-client-state")
    OUTLOOK_SYNC_MAX_MESSAGES: int = int(os.getenv("OUTLOOK_SYNC_MAX_MESSAGES", "20"))

    # Twilio & SMS Notifications Settings
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "ACmockaccount000000000000000000000")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "mockauthtoken00000000000000000000")
    TWILIO_VERIFY_SERVICE_SID: str = os.getenv("TWILIO_VERIFY_SERVICE_SID", "VAобходимоmockservice000000000000")
    TWILIO_MESSAGING_SERVICE_SID: str = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "MGmockservice000000000000000000")
    SMS_ALERTS_ENABLED: bool = os.getenv("SMS_ALERTS_ENABLED", "false").lower() == "true"
    HIGH_RISK_ALERT_THRESHOLD: int = int(os.getenv("HIGH_RISK_ALERT_THRESHOLD", "80"))

    # Queue & Celery Background Processing Settings
    QUEUE_ENABLED: bool = os.getenv("QUEUE_ENABLED", "false").lower() == "true"
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
    WORKER_CONCURRENCY: int = int(os.getenv("WORKER_CONCURRENCY", "1"))
    MAX_JOB_RETRIES: int = int(os.getenv("MAX_JOB_RETRIES", "3"))
    MAX_SYNC_MESSAGES: int = int(os.getenv("MAX_SYNC_MESSAGES", "20"))

    @property
    def ALLOWED_HOSTS(self) -> list:
        return [host.strip() for host in self.ALLOWED_HOSTS_STR.split(",") if host.strip()]

    @property
    def jwt_secret(self) -> str:
        """
        Retrieves JWT_SECRET_KEY, rejecting default fallback settings in production environment context.
        """
        if self.APP_ENV == "production" and self.JWT_SECRET_KEY == "replace-with-a-long-random-development-secret":
            raise ValueError("JWT_SECRET_KEY must be securely updated for production deployments.")
        return self.JWT_SECRET_KEY

    def validate_production_settings(self):
        """
        Fails fast on application startup if insecure configurations are detected in production.
        """
        if self.APP_ENV == "production":
            if self.JWT_SECRET_KEY == "replace-with-a-long-random-development-secret":
                raise ValueError("Insecure JWT_SECRET_KEY is not allowed in production environments.")
            if self.TOKEN_ENCRYPTION_KEY == "qO9LSTDQJdKmym0dqxcC42v1VlZUXQhBTWJ6sfIewUw=":
                raise ValueError("Insecure default TOKEN_ENCRYPTION_KEY is not allowed in production environments.")
            if "*" in self.ALLOWED_CORS_ORIGINS:
                raise ValueError("Wildcard CORS origins are forbidden in production environments.")
            if not self.ALLOWED_HOSTS:
                raise ValueError("ALLOWED_HOSTS must not be empty in production environments.")


settings = Settings()
settings.validate_production_settings()
