import time
import uuid
import uvicorn
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import scans, auth
from app.config import settings
from app.database import engine
from app.security.size_limiter import RequestSizeLimitMiddleware
from app.logging_config import logger
from sqlalchemy import text

app = FastAPI(
    title="PhishGuard API Gateway",
    description="Explainable Phishing and Fraud Email Detection Service Backend",
    version="1.2.0"
)

# Custom Request ID, Logging, and Security Headers Middleware
class SecurityHeadersAndLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Log request start safely (no passwords, headers, or body logged)
        logger.info(f"[{request_id}] START: {request.method} {request.url.path}")
        
        start_time = time.time()
        try:
            response = await call_next(request)
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Inject Request ID
            response.headers["X-Request-ID"] = request_id
            
            # Inject Security Headers
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
            response.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate"
            
            # Log response stats safely
            logger.info(f"[{request_id}] COMPLETED: {request.method} {request.url.path} - Status: {response.status_code} in {duration_ms}ms")
            return response
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(f"[{request_id}] ERROR: {request.method} {request.url.path} after {duration_ms}ms: {str(e)}")
            raise e

# Register Middlewares in proper execution order (reverse order of registration)
app.add_middleware(SecurityHeadersAndLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

app.add_middleware(
    RequestSizeLimitMiddleware,
    max_bytes=settings.MAX_REQUEST_BODY_BYTES
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# Global Exception Handlers Masking Unhandled 500-level Failures
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    # Preserve standard HTTPExceptions (like 401, 403, 404, 429)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Preserve validation errors with helpful context details (safely encoded)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_encoder(exc.errors())}
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        f"[{request_id}] Unhandled server exception: {str(exc)}",
        exc_info=True
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected server error occurred.",
            "request_id": request_id
        }
    )

# Register API Router prefixes
app.include_router(scans.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])

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
