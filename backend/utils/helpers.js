/**
 * Utility / Helper Functions
 * Moved out of server.js for reusability and testability.
 */

/**
 * Haversine formula — returns distance in KM between two lat/lng points.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Simulated port status generator.
 * In production this would come from IoT/hardware telemetry.
 */
function getPortStatus(portId) {
  const t    = Math.floor(Date.now() / 10000);
  const seed = (portId + t).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    functional:  seed % 10 > 1,
    occupancy:   (seed + t) % 4 === 0 ? 'occupied' : 'free',
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Generate 48 hours of 30-minute slots for a port.
 */
function getSlotsForPort(portId, reservedKeys) {
  const slots = [];
  const now   = new Date();
  const start = new Date(now);
  start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);

  for (let i = 0; i < 96; i++) {
    const startTime = new Date(start.getTime() + i * 30 * 60 * 1000);
    const endTime   = new Date(startTime.getTime() + 30 * 60 * 1000);
    const key       = `${portId}_${startTime.toISOString()}`;
    slots.push({
      id:        `slot_${portId}_${i}`,
      portId,
      startTime: startTime.toISOString(),
      endTime:   endTime.toISOString(),
      status:    reservedKeys.has(key) ? 'reserved' : 'available',
    });
  }
  return slots;
}

module.exports = { haversineKm, getPortStatus, getSlotsForPort };
