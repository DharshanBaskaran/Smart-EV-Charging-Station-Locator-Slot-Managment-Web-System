/**
 * WebSocket Manager — Socket.io real-time events
 * Handles live port status broadcasts and charging session progress.
 */
const logger = require('../utils/logger');
const { getPortStatus } = require('../utils/helpers');
const Port = require('../models/Port');
const ChargingSession = require('../models/ChargingSession');

let io = null;

// Active charging simulation intervals: sessionId → intervalId
const activeSimulations = {};

/**
 * Initialize Socket.io on the HTTP server.
 */
function initSocketIO(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    logger.debug('WebSocket client connected', { socketId: socket.id });

    // Client can join a room for a specific station to get targeted updates
    socket.on('join-station', (stationId) => {
      socket.join(`station:${stationId}`);
      logger.debug('Client joined station room', { socketId: socket.id, stationId });
    });

    socket.on('leave-station', (stationId) => {
      socket.leave(`station:${stationId}`);
    });

    // Client joins their user-specific room for notifications & session updates
    socket.on('join-user', (userId) => {
      socket.join(`user:${userId}`);
      logger.debug('Client joined user room', { socketId: socket.id, userId });
    });

    socket.on('disconnect', () => {
      logger.debug('WebSocket client disconnected', { socketId: socket.id });
    });
  });

  // Broadcast port status updates every 15 seconds
  setInterval(async () => {
    try {
      const ports = await Port.find({});
      const statusUpdates = ports.map(p => ({
        portId: p.portId,
        stationId: p.stationId,
        ...getPortStatus(p.portId),
      }));

      io.emit('port-status-update', statusUpdates);
    } catch (e) {
      logger.error('Port status broadcast error', { error: e.message });
    }
  }, 15000);

  logger.info('WebSocket server initialized (Socket.io)');
  return io;
}

/**
 * Get the Socket.io instance.
 */
function getIO() {
  return io;
}

/**
 * Emit an event to a specific user's room.
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Emit an event to a specific station's room.
 */
function emitToStation(stationId, event, data) {
  if (io) {
    io.to(`station:${stationId}`).emit(event, data);
  }
}

/**
 * Start a charging session simulation.
 * Simulates battery charging progress over time.
 */
function startChargingSimulation(session) {
  const totalDurationMs = (session.durationMin || 30) * 60 * 1000;
  const startTime = Date.now();
  const updateIntervalMs = 5000; // Update every 5 seconds

  const intervalId = setInterval(async () => {
    try {
      const elapsed = Date.now() - startTime;
      const progressPct = Math.min(100, (elapsed / totalDurationMs) * 100);
      const energySoFar = (session.powerKw * (elapsed / 3600000)); // kWh
      const costSoFar = energySoFar * session.pricePerKwh;

      const batteryRange = session.batteryTargetPct - session.batteryStartPct;
      const currentBattery = session.batteryStartPct + (batteryRange * (progressPct / 100));

      // Update session in DB
      const updatedSession = await ChargingSession.findOneAndUpdate(
        { sessionId: session.sessionId },
        {
          progressPct: Math.round(progressPct),
          energyKwh: parseFloat(energySoFar.toFixed(2)),
          totalCostINR: parseFloat(costSoFar.toFixed(2)),
          batteryEndPct: Math.round(currentBattery),
        },
        { new: true }
      );

      // Broadcast progress to the user
      emitToUser(session.userId, 'charging-progress', {
        sessionId: session.sessionId,
        progressPct: Math.round(progressPct),
        energyKwh: parseFloat(energySoFar.toFixed(2)),
        totalCostINR: parseFloat(costSoFar.toFixed(2)),
        batteryPct: Math.round(currentBattery),
        elapsedMin: Math.round(elapsed / 60000),
        remainingMin: Math.max(0, Math.round((totalDurationMs - elapsed) / 60000)),
      });

      // Complete the session
      if (progressPct >= 100) {
        clearInterval(intervalId);
        delete activeSimulations[session.sessionId];

        const finalEnergy = parseFloat((session.powerKw * (session.durationMin / 60)).toFixed(2));
        const finalCost = parseFloat((finalEnergy * session.pricePerKwh).toFixed(2));

        await ChargingSession.findOneAndUpdate(
          { sessionId: session.sessionId },
          {
            status: 'completed',
            completedAt: new Date(),
            progressPct: 100,
            energyKwh: finalEnergy,
            totalCostINR: finalCost,
            batteryEndPct: session.batteryTargetPct,
          }
        );

        // Auto-debit from wallet (Month 3)
        try {
          const { getOrCreateWallet, createTransaction } = require('../routes/wallet');
          const wallet = await getOrCreateWallet(session.userId);
          if (wallet.balance >= finalCost) {
            wallet.balance = parseFloat((wallet.balance - finalCost).toFixed(2));
            await wallet.save();
            await createTransaction(
              session.userId, 'charging_debit', finalCost, 'debit',
              `Charging session — ${finalEnergy} kWh @ ₹${session.pricePerKwh}/kWh`,
              session.sessionId, 'wallet', wallet.balance,
              { energyKwh: finalEnergy, pricePerKwh: session.pricePerKwh }
            );
            logger.info('Auto-debit from wallet', { userId: session.userId, amount: finalCost, balance: wallet.balance });
          } else {
            logger.warn('Insufficient wallet balance for auto-debit', {
              userId: session.userId, required: finalCost, balance: wallet.balance,
            });
          }
        } catch (walletErr) {
          logger.error('Wallet auto-debit error', { error: walletErr.message, sessionId: session.sessionId });
        }

        emitToUser(session.userId, 'charging-complete', {
          sessionId: session.sessionId,
          energyKwh: finalEnergy,
          totalCostINR: finalCost,
          batteryPct: session.batteryTargetPct,
        });

        logger.info('Charging session completed', { sessionId: session.sessionId });
      }
    } catch (e) {
      logger.error('Charging simulation error', { error: e.message, sessionId: session.sessionId });
      clearInterval(intervalId);
      delete activeSimulations[session.sessionId];
    }
  }, updateIntervalMs);

  activeSimulations[session.sessionId] = intervalId;
}

/**
 * Stop a charging simulation (for cancellation).
 */
function stopChargingSimulation(sessionId) {
  if (activeSimulations[sessionId]) {
    clearInterval(activeSimulations[sessionId]);
    delete activeSimulations[sessionId];
  }
}

module.exports = {
  initSocketIO,
  getIO,
  emitToUser,
  emitToStation,
  startChargingSimulation,
  stopChargingSimulation,
};
