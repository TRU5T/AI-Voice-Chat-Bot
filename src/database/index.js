const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const pool = new Pool({
  user: process.env.DB_USER || 'aivoice',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'aivoice',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Read and execute schema file
async function initializeDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await pool.query(schema);
    logger.info('Database schema initialized');
    
    // Create admin user if not exists
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminPassword) {
      const hashedPassword = require('bcryptjs').hashSync(adminPassword, 10);
      await pool.query(
        `INSERT INTO users (username, password_hash, role)
         VALUES ('admin', $1, 'admin')
         ON CONFLICT (username) DO NOTHING`,
        [hashedPassword]
      );
      logger.info('Admin user initialized');
    }
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

// Query helper
async function query(text, params) {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error:', error);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  query,
  pool
}; 