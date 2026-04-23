/**
 * Swagger API Documentation Route
 * Serves a Swagger UI page with all API endpoints documented.
 */
const express = require('express');
const router = express.Router();

const apiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'VoltPath API',
    version: '2.0.0',
    description: 'Smart EV Charging Station Locator & Slot Management Platform API.\n\nFeatures: JWT authentication, station management, charging sessions, wallet/payments, reviews, notifications, and real-time WebSocket updates.',
    contact: { name: 'VoltPath Team' },
  },
  servers: [{ url: '/api', description: 'Main API' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': {
      post: { tags: ['Auth'], summary: 'Login', description: 'Authenticate with username and password. Returns JWT token.', security: [],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' } }, required: ['username', 'password'] } } } },
        responses: { '200': { description: 'Login successful — returns token and user data' }, '401': { description: 'Invalid credentials' } },
      }
    },
    '/auth/register': {
      post: { tags: ['Auth'], summary: 'Register', description: 'Create a new user account with bcrypt-hashed password.', security: [],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } }, required: ['username', 'password'] } } } },
        responses: { '201': { description: 'User created' }, '409': { description: 'Username taken' } },
      }
    },
    '/stations': {
      get: { tags: ['Stations'], summary: 'List all stations', description: 'Optionally filter by proximity (lat, lng, rangeKm), connector type, or power.', security: [],
        parameters: [
          { name: 'lat', in: 'query', schema: { type: 'number' } },
          { name: 'lng', in: 'query', schema: { type: 'number' } },
          { name: 'rangeKm', in: 'query', schema: { type: 'number' } },
          { name: 'connectorType', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Array of stations' } },
      },
      post: { tags: ['Stations'], summary: 'Add a community station', responses: { '201': { description: 'Station created' } } },
    },
    '/stations/{id}': {
      get: { tags: ['Stations'], summary: 'Get station details with ports', security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Station details with ports and reviews' } },
      },
    },
    '/ports/status': { get: { tags: ['Ports'], summary: 'Get all port statuses (real-time)', security: [], responses: { '200': { description: 'Array of port statuses' } } } },
    '/ports/{portId}/slots': { get: { tags: ['Ports'], summary: 'Get available 30-min slots for a port', security: [],
      parameters: [{ name: 'portId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { '200': { description: 'Array of 48-hour slots' } },
    }},
    '/reservations': {
      get: { tags: ['Reservations'], summary: 'List my reservations', responses: { '200': { description: 'Array of reservations' } } },
      post: { tags: ['Reservations'], summary: 'Create a reservation',
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { portId: { type: 'string' }, startTime: { type: 'string', format: 'date-time' }, endTime: { type: 'string', format: 'date-time' } } } } } },
        responses: { '201': { description: 'Reservation created' }, '409': { description: 'Time conflict' } },
      },
    },
    '/reservations/{id}': {
      delete: { tags: ['Reservations'], summary: 'Cancel a reservation',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Cancelled' } },
      },
    },
    '/sessions/start': {
      post: { tags: ['Charging Sessions'], summary: 'Start a charging session',
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { portId: { type: 'string' }, durationMin: { type: 'integer' }, batteryStartPct: { type: 'integer' }, batteryTargetPct: { type: 'integer' } } } } } },
        responses: { '201': { description: 'Session started with real-time WebSocket updates' }, '409': { description: 'Already have active session' } },
      },
    },
    '/sessions/{id}/stop': { post: { tags: ['Charging Sessions'], summary: 'Stop a charging session early', responses: { '200': { description: 'Session stopped, final cost calculated' } } } },
    '/sessions/active': { get: { tags: ['Charging Sessions'], summary: 'Get current active session', responses: { '200': { description: 'Active session or null' } } } },
    '/sessions/history': { get: { tags: ['Charging Sessions'], summary: 'Get past sessions', responses: { '200': { description: 'Array of past sessions' } } } },
    '/wallet/balance': { get: { tags: ['Wallet'], summary: 'Get wallet balance', responses: { '200': { description: 'Balance and currency' } } } },
    '/wallet/topup': {
      post: { tags: ['Wallet'], summary: 'Add money to wallet',
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { amount: { type: 'number', minimum: 10, maximum: 10000 }, paymentMethod: { type: 'string', enum: ['upi', 'card', 'netbanking'] } } } } } },
        responses: { '200': { description: 'Top-up successful' } },
      },
    },
    '/wallet/transactions': { get: { tags: ['Wallet'], summary: 'Transaction history (paginated)', responses: { '200': { description: 'Transactions with pagination' } } } },
    '/wallet/summary': { get: { tags: ['Wallet'], summary: 'Monthly spending summary', responses: { '200': { description: 'Monthly breakdown' } } } },
    '/wallet/apply-promo': { post: { tags: ['Wallet'], summary: 'Apply a promo code', responses: { '200': { description: 'Credit applied' }, '404': { description: 'Invalid code' } } } },
    '/wallet/invoice/{sessionId}': { get: { tags: ['Wallet'], summary: 'Get invoice for a session', responses: { '200': { description: 'Invoice data with GST' } } } },
    '/reviews/station/{id}': {
      get: { tags: ['Reviews'], summary: 'Get station reviews', security: [], responses: { '200': { description: 'Array of reviews' } } },
      post: { tags: ['Reviews'], summary: 'Post a review (1-5 stars)', responses: { '201': { description: 'Review created' } } },
    },
    '/notifications': { get: { tags: ['Notifications'], summary: 'Get my notifications', responses: { '200': { description: 'Notifications array + unread count' } } } },
    '/dashboard': { get: { tags: ['Dashboard'], summary: 'User dashboard stats', responses: { '200': { description: 'Comprehensive stats' } } } },
    '/admin/stats': { get: { tags: ['Admin'], summary: 'Admin analytics (admin only)', responses: { '200': { description: 'Platform-wide stats' } } } },
    '/favorites/{stationId}': { post: { tags: ['Favorites'], summary: 'Toggle favorite station', responses: { '200': { description: 'Updated favorites' } } } },
    '/me': {
      get: { tags: ['User'], summary: 'Get my profile', responses: { '200': { description: 'User data' } } },
      put: { tags: ['User'], summary: 'Update my profile', responses: { '200': { description: 'Updated user' } } },
    },
    '/qr/station/{id}': { get: { tags: ['QR'], summary: 'Get QR code for a station', security: [], responses: { '200': { description: 'QR image URL' } } } },
    '/health': { get: { tags: ['System'], summary: 'Health check', security: [], responses: { '200': { description: 'Server status' } } } },
  },
  tags: [
    { name: 'Auth', description: 'Authentication (JWT)' },
    { name: 'Stations', description: 'Charging station CRUD' },
    { name: 'Ports', description: 'Port management & real-time status' },
    { name: 'Reservations', description: 'Slot booking' },
    { name: 'Charging Sessions', description: 'Live charging with WebSocket progress' },
    { name: 'Wallet', description: 'Payments, top-ups, transactions' },
    { name: 'Reviews', description: 'Station ratings & reviews' },
    { name: 'Notifications', description: 'User notifications' },
    { name: 'Dashboard', description: 'Analytics & stats' },
    { name: 'Admin', description: 'Admin-only endpoints' },
    { name: 'QR', description: 'QR code generation' },
    { name: 'System', description: 'Health & diagnostics' },
  ],
};

// Serve the OpenAPI spec as JSON
router.get('/spec', (req, res) => {
  res.json(apiSpec);
});

// Serve a Swagger UI page
router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head>
  <title>VoltPath API Docs</title>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({ url: '/api/docs/spec', dom_id: '#swagger-ui', deepLinking: true, presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset] });</script>
</body></html>`);
});

module.exports = router;
