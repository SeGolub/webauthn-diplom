FROM python:3.11-slim

WORKDIR /app

# Копируем и устанавливаем зависимости 
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем директорию с исходным кодом 
COPY ./src ./src

# Запускаем FastAPI через Uvicorn
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]