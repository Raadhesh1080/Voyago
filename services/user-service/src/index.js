const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const { initTracer } = require('jaeger-client');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3002;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const tracer = initTracer({
  serviceName: 'user-service',
  sampler: { type: 'const', param: 1 },
  reporter: { agentHost: process.env.JAEGER_AGENT_HOST || 'localhost' }
}, {});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const span = tracer.startSpan(`${req.method} ${req.path}`);
  req.span = span;
  logger.info({ method: req.method, path: req.path, traceId: span.context().toTraceId() });
  res.on('finish', () => span.finish());
  next();
});

const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).optional(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phone: Joi.string().optional(),
  role: Joi.string().valid('admin', 'user').optional(),
  isActive: Joi.boolean().optional()
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service' });
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, phone, is_active, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    
    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, phone, is_active, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const { error, value } = userSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, password, firstName, lastName, phone, role = 'user', isActive = true } = value;
    const passwordHash = await bcrypt.hash(password || 'TempPass@123', 10);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, first_name, last_name, role, phone, is_active',
      [email, passwordHash, firstName, lastName, phone, role, isActive]
    );

    logger.info({ event: 'user_created', userId: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { error, value } = userSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, firstName, lastName, phone, role, isActive } = value;
    
    const result = await pool.query(
      'UPDATE users SET email = $1, first_name = $2, last_name = $3, phone = $4, role = $5, is_active = $6 WHERE id = $7 RETURNING id, email, first_name, last_name, role, phone, is_active',
      [email, firstName, lastName, phone, role, isActive, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    logger.info({ event: 'user_updated', userId: req.params.id });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    logger.info({ event: 'user_deleted', userId: req.params.id });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.listen(PORT, () => logger.info({ event: 'server_started', port: PORT }));

module.exports = app;
