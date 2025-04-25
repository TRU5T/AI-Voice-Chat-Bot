const jwt = require('jsonwebtoken');
const { query } = require('../database');
const logger = require('../utils/logger');

// Authentication middleware
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists
    const user = await query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (!user.rows[0]) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user.rows[0];
    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Authorization middleware
function authorize(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = {
  authenticate,
  authorize
}; 