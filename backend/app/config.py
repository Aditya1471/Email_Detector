import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
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

settings = Settings()
