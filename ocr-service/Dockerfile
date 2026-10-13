# LAND-IQ OCR Service — Production Container Image
FROM python:3.11-slim

# Install system dependencies required by OpenCV and PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create application user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/

# Create model and cache directories with proper permissions
RUN mkdir -p /home/appuser/.paddlex && chown -R appuser:appuser /home/appuser /app

USER appuser

ENV PYTHONUNBUFFERED=1 \
    MAX_CONCURRENT_OCR=4 \
    MAX_FILE_SIZE_BYTES=26214400 \
    MAX_PDF_PAGES=50

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start production server using uvicorn worker
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--timeout-keep-alive", "65"]
