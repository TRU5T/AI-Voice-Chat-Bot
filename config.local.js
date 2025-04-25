module.exports = {
  // Database configuration
  database: {
    host: 'localhost',
    port: 5432,
    user: 'aivoice',
    password: 'aivoice',
    database: 'aivoice'
  },

  // Redis configuration
  redis: {
    host: 'localhost',
    port: 6379
  },

  // API configuration
  api: {
    port: 3000,
    jwtSecret: 'your-local-jwt-secret',
    adminPassword: 'admin123'
  },

  // AI Services
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY
  },

  // Media paths
  media: {
    path: './media',
    tempPath: './temp'
  },

  // Logging
  logging: {
    level: 'debug',
    path: './logs'
  }
}; 