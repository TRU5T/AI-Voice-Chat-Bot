const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../database');
const sipService = require('../services/sip');

// Authentication routes
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (!user.rows[0]) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = require('bcryptjs').compareSync(
      password,
      user.rows[0].password_hash
    );
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = require('jsonwebtoken').sign(
      { userId: user.rows[0].id, role: user.rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Client management routes
router.get('/clients', authenticate, async (req, res) => {
  try {
    const clients = await query(`
      SELECT c.*, s.*, a.* 
      FROM clients c
      LEFT JOIN sip_configs s ON c.id = s.client_id
      LEFT JOIN ai_configs a ON c.id = a.client_id
    `);
    res.json(clients.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/clients', authenticate, authorize('admin'), async (req, res) => {
  try {
    const client = await sipService.addClient(req.body);
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/clients/:id', authenticate, async (req, res) => {
  try {
    const client = await query(`
      SELECT c.*, s.*, a.* 
      FROM clients c
      LEFT JOIN sip_configs s ON c.id = s.client_id
      LEFT JOIN ai_configs a ON c.id = a.client_id
      WHERE c.id = $1
    `, [req.params.id]);
    
    if (!client.rows[0]) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    res.json(client.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/clients/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const client = await sipService.updateClient(req.params.id, req.body);
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/clients/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await sipService.removeClient(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Call management routes
router.get('/calls', authenticate, async (req, res) => {
  try {
    const calls = await query(`
      SELECT c.*, cl.name as client_name
      FROM calls c
      JOIN clients cl ON c.client_id = cl.id
      ORDER BY c.start_time DESC
      LIMIT 100
    `);
    res.json(calls.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/calls/:id', authenticate, async (req, res) => {
  try {
    const call = await query(`
      SELECT c.*, cl.name as client_name
      FROM calls c
      JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = $1
    `, [req.params.id]);
    
    if (!call.rows[0]) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    res.json(call.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/calls/:id/transcript', authenticate, async (req, res) => {
  try {
    const interactions = await query(`
      SELECT * FROM call_interactions
      WHERE call_id = $1
      ORDER BY timestamp
    `, [req.params.id]);
    
    res.json(interactions.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registration management routes
router.get('/registrations', authenticate, async (req, res) => {
  try {
    const status = await sipService.getRegistrationStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/registrations/:id/register', authenticate, authorize('admin'), async (req, res) => {
  try {
    const client = await query(`
      SELECT c.*, s.* 
      FROM clients c
      JOIN sip_configs s ON c.id = s.client_id
      WHERE c.id = $1
    `, [req.params.id]);
    
    if (!client.rows[0]) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    await sipService.registerClient(client.rows[0]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/registrations/:id/unregister', authenticate, authorize('admin'), async (req, res) => {
  try {
    await sipService.removeClient(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics routes
router.get('/analytics/overview', authenticate, async (req, res) => {
  try {
    const overview = await query(`
      SELECT 
        COUNT(*) as total_calls,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_calls,
        AVG(duration) as avg_duration,
        COUNT(DISTINCT client_id) as active_clients
      FROM calls
      WHERE start_time >= NOW() - INTERVAL '30 days'
    `);
    
    res.json(overview.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/call-volume', authenticate, async (req, res) => {
  try {
    const volume = await query(`
      SELECT 
        DATE_TRUNC('day', start_time) as date,
        COUNT(*) as call_count
      FROM calls
      WHERE start_time >= NOW() - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date
    `);
    
    res.json(volume.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function initializeApi(app) {
  app.use('/api', router);
}

module.exports = {
  initializeApi
}; 