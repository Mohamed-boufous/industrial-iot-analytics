FROM python:3.11-slim

WORKDIR /app

# Installation des dépendances système requises pour confluent-kafka (librdkafka)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    librdkafka-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copie et installation des dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code de l'application backend
COPY . .

# Exposition du port API FastAPI
EXPOSE 8000

# Commande de démarrage avec Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
