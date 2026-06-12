# Imagem base oficial do Python (slim = menor tamanho)
FROM python:3.11-slim

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia primeiro só o requirements para aproveitar cache do Docker
# (se as dependências não mudaram, essa camada não é reconstruída)
COPY requirements.txt .

# Instala as dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Instala o Gunicorn (servidor WSGI de produção, mais robusto que flask run)
RUN pip install --no-cache-dir gunicorn

# Copia o restante do código
COPY . .

# Expõe a porta que o Flask usa
EXPOSE 5000

# Comando de inicialização em produção via Gunicorn
# -w 4 = 4 workers (processos)
# -b 0.0.0.0:5000 = escuta em todas as interfaces na porta 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "main:app"]
