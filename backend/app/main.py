import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import scans, auth
from .config import settings

app = FastAPI(
    title="PhishGuard API Gateway",
    description="Explainable Phishing and Fraud Email Detection Service Backend",
    version="1.2.0"
)

# Setup CORS Policies
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router prefixes
app.include_router(scans.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])

from sqlalchemy import text
from .database import engine

@app.get("/health")
def get_health_status():
    """
    Service health verification checkpoint.
    """
    database_status = "unavailable"
    try:
        # Check database connection availability safely
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            database_status = "available"
    except Exception:
        pass

    return {
        "status": "healthy",
        "service": "phishguard-api-gateway",
        "version": "1.2.0",
        "database": database_status
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=True if settings.APP_ENV == "development" else False
    )
