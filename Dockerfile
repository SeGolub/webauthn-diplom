FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEEPFACE_HOME=/app/.deepface \
    PYTHONPATH=/app/backend

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    wget \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN uv pip install --system --no-cache setuptools wheel && \
    uv pip install --system --no-cache -r requirements.txt

RUN mkdir -p /app/.deepface/weights && \
    wget -qO /app/.deepface/weights/arcface_weights.h5 https://github.com/serengil/deepface_models/releases/download/v1.0/arcface_weights.h5

COPY ./backend ./backend
COPY ./frontend ./frontend

CMD uvicorn backend.src.main:app --host 0.0.0.0 --port ${PORT:-8000}