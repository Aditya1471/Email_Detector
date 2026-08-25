FROM python:3.11-slim

# Set environment system configurations
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /workspace

# Install system dependencies if required for runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements to leverage Docker build cache
COPY requirements.txt .

# Install dependencies cleanly without caching pip packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and config files
COPY app /workspace/app
COPY migrations /workspace/migrations
COPY alembic.ini /workspace/alembic.ini

# Create non-root application user and group
RUN groupadd -g 1000 phishguard && \
    useradd -u 1000 -g phishguard -m -s /bin/bash phishguard

# Change ownership of the workspace directory
RUN chown -R phishguard:phishguard /workspace

# Run container as non-root user
USER phishguard

EXPOSE 8000

# Start production uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
