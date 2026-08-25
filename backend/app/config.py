import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
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

settings = Settings()
