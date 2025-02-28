FROM python:3.10

# Install dependencies
RUN apt update && apt install -y baresip ffmpeg alsa-utils netcat-openbsd

# Set working directory
WORKDIR /app

# Copy files
COPY requirements.txt .
COPY main.py .
COPY config.yaml .

# Create necessary directories
RUN mkdir -p logs

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose SIP ports
EXPOSE 5060/udp
EXPOSE 5061/tcp

# Run the AI bot
CMD ["python", "main.py"]
