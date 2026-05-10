FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    wget \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /root/.deepface/weights && \
    wget -qO /root/.deepface/weights/arcface_weights.h5 https://github.com/serengil/deepface_models/releases/download/v1.0/arcface_weights.h5

COPY ./src ./src

CMD sh -c "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}"