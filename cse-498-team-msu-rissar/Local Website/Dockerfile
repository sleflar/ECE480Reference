# multi-stage dockerfile for flask backend
# build with --target development for dev or --target production for prod

FROM python:3.11-slim AS base

LABEL maintainer="MSU RISSAR Team" \
      description="Docker image for local containerized dashboard backend"

# set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    vim \
    curl \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# create non-root user
RUN useradd -m -u 1000 rissar && \
    mkdir -p /app && \
    chown -R rissar:rissar /app

WORKDIR /app

# copy requirements first for better layer caching
COPY --chown=rissar:rissar requirements.txt .

# install python dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# copy application code
COPY --chown=rissar:rissar . .

# expose port
EXPOSE 8080
ENV PORT=8080

USER rissar

# ============================================
# development stage
# ============================================
FROM base AS development

ENV FLASK_ENV=development

CMD ["python3", "app.py"]

# ============================================
# production stage
# ============================================
FROM base AS production

ENV FLASK_ENV=production

# health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

CMD ["sh", "-c", "exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app"]