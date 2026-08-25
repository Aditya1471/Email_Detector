from fastapi import status
from starlette.types import ASGIApp, Receive, Scope, Send


class RequestSizeLimitMiddleware:
    """
    ASGI Middleware enforcing maximum allowed request body size constraints.
    Checks Content-Length header early and limits reading chunk sizes during body streaming
    to prevent unlimited memory buffering (protecting against Denial of Service attacks).
    """

    def __init__(self, app: ASGIApp, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # 1. Early check via Content-Length headers
        headers = dict(scope.get("headers", []))
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                if int(content_length) > self.max_bytes:
                    await self.send_413_response(send)
                    return
            except ValueError:
                pass

        # 2. Bounded body reading proxy (for missing Content-Length or chunked encoding)
        body_bytes_read = 0
        limit_exceeded = False

        async def bounded_receive():
            nonlocal body_bytes_read, limit_exceeded
            message = await receive()
            if message["type"] == "http.request":
                body_chunk = message.get("body", b"")
                body_bytes_read += len(body_chunk)
                if body_bytes_read > self.max_bytes:
                    limit_exceeded = True
                    # Raise an exception that is caught by our handler,
                    # or force body truncation to trigger downstream validation failures
                    raise RuntimeError("MAX_BODY_EXCEEDED")
            return message

        try:
            await self.app(scope, bounded_receive, send)
        except RuntimeError as e:
            if str(e) == "MAX_BODY_EXCEEDED" or limit_exceeded:
                await self.send_413_response(send)
            else:
                raise e

    async def send_413_response(self, send: Send) -> None:
        response_body = b'{"detail": "Request body exceeds the maximum allowed size."}'
        await send(
            {
                "type": "http.response.start",
                "status": status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(response_body)).encode("ascii")),
                ],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": response_body,
            }
        )
