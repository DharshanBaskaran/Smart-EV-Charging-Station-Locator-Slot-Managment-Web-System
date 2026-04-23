/**
 * Notification Service
 * Centralized notification creation logic.
 */
const Notification = require('../models/Notification');
const logger = require('./logger');

async function createNotification(userId, type, title, message) {
  try {
    await Notification.create({
      notificationId: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId, type, title, message,
    });
  } catch (e) {
    logger.error('Notification creation failed', { error: e.message, userId });
  }
}

module.exports = { createNotification };
