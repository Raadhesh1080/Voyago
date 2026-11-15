const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { initTracer } = require('jaeger-client');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3009;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const tracer = initTracer({
  serviceName: 'api-gateway',
  sampler: { type: 'const', param: 1 },
  reporter: { agentHost: process.env.JAEGER_AGENT_HOST || 'localhost' }
}, {});

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any localhost / 127.0.0.1 origin in development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Request logging
app.use((req, res, next) => {
  const span = tracer.startSpan(`${req.method} ${req.path}`);
  req.span = span;
  logger.info({ method: req.method, path: req.path, traceId: span.context().toTraceId() });
  res.on('finish', () => span.finish());
  next();
});

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-gateway' });
});

const proxyRequest = async (req, res, targetUrl, pathPrefix) => {
  try {
    const headers = { ...req.headers };
    delete headers.host;
    let targetPath = req.originalUrl;
    if (pathPrefix) {
      targetPath = targetPath.replace(new RegExp('^' + pathPrefix), '');
      if (!targetPath.startsWith('/')) {
        targetPath = '/' + targetPath;
      }
      targetPath = pathPrefix + targetPath;
    }
    const response = await axios({
      method: req.method,
      url: targetUrl + targetPath,
      data: req.rawBody || req.body,
      headers: headers,
      validateStatus: () => true
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
};

// Public routes - Auth service
app.use('/api/auth', (req, res) => {
  proxyRequest(req, res, process.env.AUTH_SERVICE_URL || 'http://localhost:3001', '/api/auth');
});

// Protected routes - User service (Admin only)
app.use('/api/users', authenticate, requireAdmin, (req, res) => {
  proxyRequest(req, res, process.env.USER_SERVICE_URL || 'http://localhost:3002', '/api/users');
});

// Protected routes - Trip service
app.get('/api/trips*', (req, res) => {
  proxyRequest(req, res, process.env.TRIP_SERVICE_URL || 'http://localhost:3003', '/api/trips');
});

app.use('/api/trips', authenticate, requireAdmin, (req, res) => {
  proxyRequest(req, res, process.env.TRIP_SERVICE_URL || 'http://localhost:3003', '/api/trips');
});

app.use('/api/destinations', authenticate, requireAdmin, (req, res) => {
  proxyRequest(req, res, process.env.TRIP_SERVICE_URL || 'http://localhost:3003', '/api/destinations');
});

// Protected routes - Payment service
app.use('/api/payment-methods', authenticate, requireAdmin, (req, res) => {
  proxyRequest(req, res, process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004', '/api/payment-methods');
});

app.use('/api/payments', authenticate, (req, res) => {
  proxyRequest(req, res, process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004', '/api/payments');
});

// Error handling
app.use((err, req, res, next) => {
  logger.error({ error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => logger.info({ event: 'server_started', port: PORT }));

module.exports = app;
