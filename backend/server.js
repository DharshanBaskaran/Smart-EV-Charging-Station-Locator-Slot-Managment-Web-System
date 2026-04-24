/**
 * VoltPath — Express + MongoDB Server (Refactored)
 * Smart EV Charging Station Locator & Slot Management
 * 
 * Architecture: Modular routes, JWT auth, bcrypt, rate limiting, helmet.
 * Month 1: Security Hardening & Architecture.
 * Month 2: Real-Time WebSocket + Charging Sessions.
 */
const express  = require('express');
const http     = require('http');
const cors     = require('cors');
const path     = require('path');
const mongoose = require('mongoose');

// ── Config & Utils ───────────────────────────────────────────────────────────
const config = require('./config');
const logger = require('./utils/logger');

// ── Security Middleware ──────────────────────────────────────────────────────
let helmet;
try { helmet = require('helmet'); } catch (_) { helmet = null; }

let morgan;
try { morgan = require('morgan'); } catch (_) { morgan = null; }

const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// ── Route Modules ────────────────────────────────────────────────────────────
const authRoutes          = require('./routes/auth');
const stationRoutes       = require('./routes/stations');
const portRoutes          = require('./routes/ports');
const reservationRoutes   = require('./routes/reservations');
const reviewRoutes        = require('./routes/reviews');
const notificationRoutes  = require('./routes/notifications');
const userRoutes          = require('./routes/users');
const dashboardRoutes     = require('./routes/dashboard');
const sessionRoutes       = require('./routes/sessions');
const walletRoutes        = require('./routes/wallet');
const qrRoutes            = require('./routes/qr');
const docsRoutes          = require('./routes/docs');
const referralRoutes      = require('./routes/referrals');
const pricingRoutes       = require('./routes/pricing');
const chatRoutes          = require('./routes/chat');
const fleetRoutes         = require('./routes/fleet');
const ownerRoutes         = require('./routes/owner');

// ── WebSocket Manager ────────────────────────────────────────────────────────
const { initSocketIO } = require('./utils/socketManager');

// ── App Setup ────────────────────────────────────────────────────────────────
const app = express();

// Security headers
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: false,  // Disable CSP for Leaflet/CDN compatibility
    crossOriginEmbedderPolicy: false,
  }));
}

// CORS
app.use(cors());

// Request logging
if (morgan) {
  app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting (all API routes)
app.use('/api', generalLimiter);

// Static files (frontend)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── MongoDB Connection ───────────────────────────────────────────────────────
mongoose.connect(config.MONGO_URI)
  .then(() => logger.info('MongoDB connected', { uri: config.MONGO_URI.replace(/\/\/.*@/, '//***@') }))
  .catch(err => {
    logger.error('MongoDB connection failed', { error: err.message });
    process.exit(1);
  });

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: config.NODE_ENV,
  });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/stations',      stationRoutes);
app.use('/api/ports',         portRoutes);
app.use('/api/reservations',  reservationRoutes);
app.use('/api/reviews',       reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api',               userRoutes);      // /api/me, /api/users, /api/favorites
app.use('/api',               dashboardRoutes); // /api/dashboard, /api/admin/stats, /api/cost-estimate
app.use('/api/sessions',      sessionRoutes);   // /api/sessions/start, /api/sessions/active, etc.
app.use('/api/wallet',        walletRoutes);    // /api/wallet/balance, /topup, /transactions, /invoice
app.use('/api/qr',            qrRoutes);        // /api/qr/station/:id, /api/qr/session/:id
app.use('/api/docs',          docsRoutes);      // /api/docs — Swagger UI, /api/docs/spec — OpenAPI JSON
app.use('/api/referrals',     referralRoutes);   // /api/referrals/my-code, /api/referrals/apply
app.use('/api/pricing',       pricingRoutes);    // /api/pricing/current, /api/pricing/calculate
app.use('/api/chat',          chatRoutes);       // /api/chat/history, /api/chat/send, /api/chat/close
app.use('/api/fleet',         fleetRoutes);      // /api/fleet/vehicles CRUD
app.use('/api/owner',         ownerRoutes);      // /api/owner/stations, port mgmt

// ── Backward-compatible review routes ────────────────────────────────────────
// Frontend calls GET/POST /api/stations/:id/reviews — redirect to review routes
app.get('/api/stations/:id/reviews', (req, res, next) => {
  req.url = `/api/reviews/station/${req.params.id}`;
  app.handle(req, res, next);
});
app.post('/api/stations/:id/reviews', (req, res, next) => {
  req.url = `/api/reviews/station/${req.params.id}`;
  req.method = 'POST';
  app.handle(req, res, next);
});

// ── Error Handling ───────────────────────────────────────────────────────────
app.use('/api', notFoundHandler);
app.use(errorHandler);

// ── Start Server (HTTP + WebSocket) ──────────────────────────────────────────
const PORT = config.PORT;
const server = http.createServer(app);

// Initialize Socket.io on the HTTP server
try {
  initSocketIO(server);
} catch (e) {
  logger.warn('Socket.io not available — install with: npm install socket.io', { error: e.message });
}

server.listen(PORT, () => {
  console.log(`⚡ VoltPath running on port ${PORT}`);
});