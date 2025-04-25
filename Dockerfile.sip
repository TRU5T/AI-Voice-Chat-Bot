FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# Create necessary directories
RUN mkdir -p /app/logs /app/media/greetings /app/media/goodbyes /app/temp

# Set environment variables
ENV NODE_ENV=production
ENV MEDIA_PATH=/app/media
ENV TEMP_PATH=/app/temp

# Expose ports
EXPOSE 3000

# Start the service
CMD ["node", "src/index.js"] 