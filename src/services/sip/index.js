const Srf = require('drachtio-srf');
const { MediaServer } = require('drachtio-fsmrf');
const { query } = require('../../database');
const logger = require('../../utils/logger');
const { handleCall } = require('./callProcessor');

const srf = new Srf();
const activeRegistrations = new Map();

// Media server configuration
const mediaServer = new MediaServer({
  address: process.env.FS_ADDRESS || '127.0.0.1',
  port: process.env.FS_PORT || 8021,
  secret: process.env.FS_SECRET
});

// Connect to Drachtio server
async function connectToDrachtio() {
  try {
    await srf.connect({
      host: process.env.DRACHTIO_HOST || '127.0.0.1',
      port: process.env.DRACHTIO_PORT || 9022,
      secret: process.env.DRACHTIO_SECRET
    });
    logger.info('Connected to Drachtio server');
  } catch (error) {
    logger.error('Failed to connect to Drachtio:', error);
    throw error;
  }
}

// Register a client
async function registerClient(client) {
  try {
    const registration = await srf.register({
      registrar: client.sip_server,
      realm: client.sip_domain,
      auth: {
        user: client.sip_username,
        pass: client.sip_password
      },
      regTimer: client.reg_interval || 3600
    });
    
    logger.info(`Successfully registered client ${client.id}`);
    await query(
      'UPDATE clients SET status = $1, status_message = $2 WHERE id = $3',
      ['active', 'Registration successful', client.id]
    );
    
    // Store registration
    activeRegistrations.set(client.id, registration);
    
    // Setup call handler
    registration.on('invite', (req, res) => {
      handleCall(req, res, client, mediaServer);
    });
    
    // Handle registration termination
    registration.on('unregistered', () => {
      logger.warn(`Registration terminated for client ${client.id}`);
      activeRegistrations.delete(client.id);
      query(
        'UPDATE clients SET status = $1, status_message = $2 WHERE id = $3',
        ['inactive', 'Registration terminated', client.id]
      );
      
      // Attempt re-registration
      setTimeout(() => registerClient(client), 5000);
    });
    
    return registration;
  } catch (error) {
    logger.error(`Registration failed for client ${client.id}:`, error);
    await query(
      'UPDATE clients SET status = $1, status_message = $2 WHERE id = $3',
      ['failed', error.message, client.id]
    );
    
    // Retry after delay
    setTimeout(() => registerClient(client), 60000);
    return null;
  }
}

// Initialize all client registrations
async function initializeRegistrations() {
  try {
    const result = await query(`
      SELECT c.*, s.* 
      FROM clients c
      JOIN sip_configs s ON c.id = s.client_id
      WHERE c.status != 'inactive'
    `);
    
    for (const client of result.rows) {
      await registerClient(client);
    }
    
    logger.info(`Initialized ${result.rows.length} client registrations`);
  } catch (error) {
    logger.error('Failed to initialize registrations:', error);
    throw error;
  }
}

// Initialize SIP service
async function initializeSipService() {
  try {
    await connectToDrachtio();
    await initializeRegistrations();
  } catch (error) {
    logger.error('Failed to initialize SIP service:', error);
    throw error;
  }
}

// Client management functions
async function addClient(clientData) {
  const client = await query(
    'INSERT INTO clients (name) VALUES ($1) RETURNING *',
    [clientData.name]
  );
  
  await query(
    'INSERT INTO sip_configs (client_id, sip_server, sip_domain, sip_username, sip_password) VALUES ($1, $2, $3, $4, $5)',
    [client.rows[0].id, clientData.sip_server, clientData.sip_domain, clientData.sip_username, clientData.sip_password]
  );
  
  await registerClient({ ...client.rows[0], ...clientData });
  return client.rows[0];
}

async function updateClient(clientId, clientData) {
  const existingReg = activeRegistrations.get(clientId);
  if (existingReg) {
    await existingReg.unregister();
    activeRegistrations.delete(clientId);
  }
  
  await query(
    'UPDATE clients SET name = $1 WHERE id = $2',
    [clientData.name, clientId]
  );
  
  await query(
    'UPDATE sip_configs SET sip_server = $1, sip_domain = $2, sip_username = $3, sip_password = $4 WHERE client_id = $5',
    [clientData.sip_server, clientData.sip_domain, clientData.sip_username, clientData.sip_password, clientId]
  );
  
  const client = await query('SELECT * FROM clients WHERE id = $1', [clientId]);
  await registerClient({ ...client.rows[0], ...clientData });
  return client.rows[0];
}

async function removeClient(clientId) {
  const registration = activeRegistrations.get(clientId);
  if (registration) {
    await registration.unregister();
    activeRegistrations.delete(clientId);
  }
  
  await query('DELETE FROM clients WHERE id = $1', [clientId]);
}

// Health check
async function getRegistrationStatus() {
  const clients = await query(`
    SELECT c.*, s.* 
    FROM clients c
    JOIN sip_configs s ON c.id = s.client_id
  `);
  
  return clients.rows.map(client => ({
    ...client,
    isCurrentlyRegistered: activeRegistrations.has(client.id)
  }));
}

module.exports = {
  initializeSipService,
  addClient,
  updateClient,
  removeClient,
  getRegistrationStatus
}; 