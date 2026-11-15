const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { Pool } = require('pg');
const neo4j = require('neo4j-driver');
const Joi = require('joi');
const { initTracer } = require('jaeger-client');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3003;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const tracer = initTracer({
  serviceName: 'trip-service',
  sampler: { type: 'const', param: 1 },
  reporter: { agentHost: process.env.JAEGER_AGENT_HOST || 'localhost' }
}, {});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password')
);

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

const tripSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().optional(),
  price: Joi.number().positive().required(),
  durationDays: Joi.number().integer().positive().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  maxParticipants: Joi.number().integer().positive().required(),
  status: Joi.string().valid('active', 'inactive', 'cancelled', 'completed').optional(),
  destinations: Joi.array().items(Joi.object({
    destinationId: Joi.string().uuid().required(),
    dayNumber: Joi.number().integer().positive().required()
  })).optional(),
  accommodations: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    type: Joi.string().required(),
    address: Joi.string().optional(),
    checkInDate: Joi.date().required(),
    checkOutDate: Joi.date().required()
  })).optional(),
  transportation: Joi.array().items(Joi.object({
    type: Joi.string().required(),
    departureLocation: Joi.string().required(),
    arrivalLocation: Joi.string().required(),
    departureTime: Joi.date().required(),
    arrivalTime: Joi.date().required(),
    provider: Joi.string().optional()
  })).optional(),
  activities: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    durationHours: Joi.number().optional(),
    price: Joi.number().optional(),
    scheduledTime: Joi.date().optional()
  })).optional()
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'trip-service' });
});

// Get all trips
app.get('/api/trips', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM trips';
    let params = [limit, offset];
    
    if (status) {
      query += ' WHERE status = $3';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    
    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM trips' + (status ? ' WHERE status = $1' : ''), status ? [status] : []);
    
    res.json({
      trips: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// Get trip by ID
app.get('/api/trips/:id', async (req, res) => {
  try {
    const tripResult = await pool.query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
    
    if (tripResult.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    
    const trip = tripResult.rows[0];
    
    const [destinations, accommodations, transportation, activities] = await Promise.all([
      pool.query('SELECT td.*, d.name, d.country, d.city FROM trip_destinations td JOIN destinations d ON td.destination_id = d.id WHERE td.trip_id = $1', [req.params.id]),
      pool.query('SELECT * FROM accommodations WHERE trip_id = $1', [req.params.id]),
      pool.query('SELECT * FROM transportation WHERE trip_id = $1', [req.params.id]),
      pool.query('SELECT * FROM activities WHERE trip_id = $1', [req.params.id])
    ]);
    
    res.json({
      ...trip,
      destinations: destinations.rows,
      accommodations: accommodations.rows,
      transportation: transportation.rows,
      activities: activities.rows
    });
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

// Create trip
app.post('/api/trips', async (req, res) => {
  const client = await pool.connect();
  try {
    const { error, value } = tripSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    await client.query('BEGIN');

    const { title, description, price, durationDays, startDate, endDate, maxParticipants, status = 'active', destinations, accommodations, transportation, activities } = value;

    const tripResult = await client.query(
      'INSERT INTO trips (title, description, price, duration_days, start_date, end_date, max_participants, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [title, description, price, durationDays, startDate, endDate, maxParticipants, status]
    );

    const trip = tripResult.rows[0];

    if (destinations) {
      for (const dest of destinations) {
        await client.query(
          'INSERT INTO trip_destinations (trip_id, destination_id, day_number) VALUES ($1, $2, $3)',
          [trip.id, dest.destinationId, dest.dayNumber]
        );
      }
    }

    if (accommodations) {
      for (const acc of accommodations) {
        await client.query(
          'INSERT INTO accommodations (trip_id, name, type, address, check_in_date, check_out_date) VALUES ($1, $2, $3, $4, $5, $6)',
          [trip.id, acc.name, acc.type, acc.address, acc.checkInDate, acc.checkOutDate]
        );
      }
    }

    if (transportation) {
      for (const trans of transportation) {
        await client.query(
          'INSERT INTO transportation (trip_id, type, departure_location, arrival_location, departure_time, arrival_time, provider) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [trip.id, trans.type, trans.departureLocation, trans.arrivalLocation, trans.departureTime, trans.arrivalTime, trans.provider]
        );
      }
    }

    if (activities) {
      for (const act of activities) {
        await client.query(
          'INSERT INTO activities (trip_id, name, description, duration_hours, price, scheduled_time) VALUES ($1, $2, $3, $4, $5, $6)',
          [trip.id, act.name, act.description, act.durationHours, act.price, act.scheduledTime]
        );
      }
    }

    await client.query('COMMIT');
    logger.info({ event: 'trip_created', tripId: trip.id });
    res.status(201).json(trip);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to create trip' });
  } finally {
    client.release();
  }
});

// Update trip
app.put('/api/trips/:id', async (req, res) => {
  try {
    const { error, value } = tripSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { title, description, price, durationDays, startDate, endDate, maxParticipants, status } = value;

    const result = await pool.query(
      'UPDATE trips SET title = $1, description = $2, price = $3, duration_days = $4, start_date = $5, end_date = $6, max_participants = $7, status = $8 WHERE id = $9 RETURNING *',
      [title, description, price, durationDays, startDate, endDate, maxParticipants, status, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });

    logger.info({ event: 'trip_updated', tripId: req.params.id });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

// Delete trip
app.delete('/api/trips/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM trips WHERE id = $1 RETURNING id', [req.params.id]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });

    logger.info({ event: 'trip_deleted', tripId: req.params.id });
    res.json({ message: 'Trip deleted successfully' });
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// Destinations CRUD
app.get('/api/destinations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM destinations ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch destinations' });
  }
});

app.post('/api/destinations', async (req, res) => {
  try {
    const { name, country, city, description, imageUrl } = req.body;
    const result = await pool.query(
      'INSERT INTO destinations (name, country, city, description, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, country, city, description, imageUrl]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to create destination' });
  }
});

app.put('/api/destinations/:id', async (req, res) => {
  try {
    const { name, country, city, description, imageUrl } = req.body;
    const result = await pool.query(
      'UPDATE destinations SET name = $1, country = $2, city = $3, description = $4, image_url = $5 WHERE id = $6 RETURNING *',
      [name, country, city, description, imageUrl, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Destination not found' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to update destination' });
  }
});

app.delete('/api/destinations/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM destinations WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Destination not found' });
    res.json({ message: 'Destination deleted successfully' });
  } catch (err) {
    logger.error({ error: err.message });
    res.status(500).json({ error: 'Failed to delete destination' });
  }
});

app.listen(PORT, () => logger.info({ event: 'server_started', port: PORT }));

module.exports = app;
