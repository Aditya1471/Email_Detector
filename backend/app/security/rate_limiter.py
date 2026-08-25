import time
import threading
from collections import defaultdict
from fastapi import Request, HTTPException, status
from app.config import settings

class InMemoryRateLimiter:
    """
    Sliding window in-memory rate limiter.
    
    ⚠️ WARNING:
    In-memory rate limiting is suitable only for single-process development or staging environments.
    In multi-worker (Uvicorn replicas) or clustered production systems, this state is isolated per process.
    For horizontal production scalability:
      - Use a distributed store (e.g. Redis via fastapi-limiter) OR
      - Offload rate-limiting entirely to the API Gateway/Reverse Proxy (e.g. Nginx, Cloudflare).
    """
    def __init__(self):
        self.lock = threading.Lock()
        # Holds request timestamps per (client_id, route_category)
        self.requests = defaultdict(list)
        
        # Route category limits: (max_requests, window_seconds)
        self.configs = {
            "login": (5, 60),      # Max 5 logins/minute
            "register": (3, 60),   # Max 3 registrations/minute
            "scans": (10, 60),     # Max 10 scans/minute
            "feedback": (5, 60),   # Max 5 feedbacks/minute
            "general": (60, 60)    # Max 60 requests/minute default
        }

    def _clean_old_requests(self, key: tuple, now: float, window: int):
        cutoff = now - window
        self.requests[key] = [t for t in self.requests[key] if t > cutoff]

    def check_limit(self, client_id: str, category: str) -> int:
        """
        Verifies if requests from a client ID exceed specified category thresholds.
        Returns the number of seconds to wait before retrying if limited, otherwise 0.
        """
        if not settings.RATE_LIMIT_ENABLED:
            return 0

        if category not in self.configs:
            category = "general"
            
        limit, window = self.configs[category]
        now = time.time()
        
        with self.lock:
            key = (client_id, category)
            self._clean_old_requests(key, now, window)
            
            if len(self.requests[key]) >= limit:
                oldest = self.requests[key][0]
                retry_after = int(window - (now - oldest))
                return max(1, retry_after)
                
            self.requests[key].append(now)
            return 0

# Shared single process instance
limiter = InMemoryRateLimiter()

def get_client_identifier(request: Request) -> str:
    """
    Constructs a rate limit identifier from the client's IP address.
    Checks X-Forwarded-For if running behind a trusted reverse proxy.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def rate_limit(category: str):
    """
    FastAPI dependency factory enforcing rate limits on route queries.
    """
    def dependency(request: Request):
        client_id = get_client_identifier(request)
        retry_seconds = limiter.check_limit(client_id, category)
        if retry_seconds > 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Please try again in {retry_seconds} seconds.",
                headers={"Retry-After": str(retry_seconds)}
            )
    return dependency
