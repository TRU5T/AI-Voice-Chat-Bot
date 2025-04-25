require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeDatabase } = require('./database');
const { initializeSipService } = require('./services/sip');
const { initializeApi } = require('./api');
const logger = require('./utils/logger');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Initialize services
async function initialize() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Initialize SIP service
    await initializeSipService();
    logger.info('SIP service initialized');

    // Initialize API routes
    initializeApi(app);
    logger.info('API routes initialized');

    // Start server
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the application
initialize(); 