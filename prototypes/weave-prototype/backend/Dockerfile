# Weave backend image.
FROM python:3.11-slim AS runtime

# Keep Python lean and predictable in containers.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    WEAVE_DATA_DIR=/data

WORKDIR /app

# Install dependencies first (better layer caching), then the app.
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir . \
    && mkdir -p /data

# Run as a non-root user.
RUN useradd --create-home --uid 1000 weave \
    && chown -R weave:weave /app /data
USER weave

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
