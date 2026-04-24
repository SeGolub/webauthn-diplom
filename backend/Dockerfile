FROM python:3.11-slim

WORKDIR /app

# Системные зависимости для dlib / face_recognition:
# cmake и build-essential нужны для компиляции C++ модулей dlib,
# libopenblas-dev — быстрая линейная алгебра (ускоряет face_recognition).
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    && rm -rf /var/lib/apt/lists/*

# Копируем и устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем директорию с исходным кодом
COPY ./src ./src

# Запускаем FastAPI через Uvicorn
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]