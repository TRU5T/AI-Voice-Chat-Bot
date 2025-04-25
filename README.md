# AI Voice Agent Platform

A multi-tenant AI voice agent platform that integrates with BroadWorks/SaasBoss phone systems.

## Features

- SIP registration with multiple BroadWorks systems
- AI-powered speech recognition and natural language processing
- Text-to-speech synthesis
- Web-based administration portal
- Call monitoring and analytics
- Multi-tenant support

## Prerequisites

- Docker and Docker Compose
- PostgreSQL 14+
- Redis 7+
- Drachtio SIP server
- RTPEngine media server
- OpenAI API key
- ElevenLabs API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/ai-voice-agent-platform.git
cd ai-voice-agent-platform
```

2. Copy the environment template and configure your settings:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
- Database credentials
- Redis settings
- Drachtio configuration
- API keys
- Media paths

4. Start the services:
```bash
docker-compose up -d
```

5. Initialize the database:
```bash
docker-compose exec api node src/database/schema.sql
```

## Configuration

### SIP Configuration

1. Configure your BroadWorks system to allow SIP registrations from the platform
2. Add client configurations through the admin portal
3. Test SIP registration status

### AI Configuration

1. Configure OpenAI API key for speech recognition and language processing
2. Set up ElevenLabs API key for text-to-speech
3. Customize system prompts and voice settings per client

## Usage

### Admin Portal

Access the admin portal at `http://localhost:80`

Default credentials:
- Username: admin
- Password: (set in ADMIN_PASSWORD environment variable)

### API Documentation

The API is available at `http://localhost:3000/api`

Endpoints:
- `/auth/login` - User authentication
- `/clients` - Client management
- `/calls` - Call records and transcripts
- `/registrations` - SIP registration status
- `/analytics` - Call analytics

## Development

1. Install dependencies:
```bash
npm install
```

2. Start development servers:
```bash
npm run dev
```

3. Run tests:
```bash
npm test
```

## Security Considerations

- All credentials are stored encrypted in the database
- JWT authentication with short expiration
- Rate limiting on API endpoints
- TLS for SIP signaling
- SRTP for media encryption

## Monitoring

- Logs are stored in `/app/logs`
- Health checks available at `/api/health`
- Call metrics and analytics in the admin portal

## Troubleshooting

1. Check service logs:
```bash
docker-compose logs -f [service_name]
```

2. Verify SIP registration:
```bash
docker-compose exec sip_service node src/services/sip/registrationStatus.js
```

3. Test AI services:
```bash
docker-compose exec api node src/services/ai/test.js
```

## License

MIT License

## Support

For support, please open an issue in the GitHub repository or contact the development team. 