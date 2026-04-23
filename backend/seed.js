/**
 * VoltPath - MongoDB Seed Script (Updated for bcrypt)
 * Seeds users, stations, and ports from JSON files into MongoDB.
 * Run once: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const path     = require('path');

const User      = require('./models/User');
const Station   = require('./models/Station');
const Port      = require('./models/Port');

const config    = require('./config');

const STATIONS_PATH = path.join(__dirname, 'data', 'stations.json');
const PORTS_PATH    = path.join(__dirname, 'data', 'ports.json');

async function seed() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log('✅  Connected to MongoDB:', config.MONGO_URI.replace(/\/\/.*@/, '//***@'));

    // ── 1. USERS ──────────────────────────────────────────────────────────────
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱  Seeding users...');

      // Hash passwords with bcrypt
      const adminHash = await bcrypt.hash('admin123', config.BCRYPT_SALT_ROUNDS);
      const demoHash  = await bcrypt.hash('demo123', config.BCRYPT_SALT_ROUNDS);

      await User.insertMany([
        {
          userId: 'u1', username: 'admin',
          passwordHash: adminHash,
          role: 'admin', name: 'Admin',
          email: 'admin@voltpath.com',
          vehicleType: 'bike', vehicleModel: '', batteryRangeKm: 80,
        },
        {
          userId: 'u2', username: 'demo',
          passwordHash: demoHash,
          role: 'user', name: 'Demo User',
          email: 'demo@example.com',
          vehicleType: 'bike', vehicleModel: 'Ather 450X', batteryRangeKm: 85,
        },
      ]);
      console.log('   ✔ 2 default users created  (admin / admin123 | demo / demo123)');
      console.log('   ✔ Passwords hashed with bcrypt (salt rounds:', config.BCRYPT_SALT_ROUNDS, ')');
    } else {
      console.log(`   ℹ  Users already seeded (${userCount} found) — skipping.`);
    }

    // ── 2. STATIONS ───────────────────────────────────────────────────────────
    const stationCount = await Station.countDocuments();
    if (stationCount === 0) {
      console.log('🌱  Seeding stations...');
      const rawStations = JSON.parse(fs.readFileSync(STATIONS_PATH, 'utf8'));
      const stations = rawStations.map(s => ({
        stationId: s.id,
        name:      s.name,
        address:   s.address,
        lat:       s.lat,
        lng:       s.lng,
        operator:  s.operator || 'Unknown',
        city:      s.city    || '',
        state:     s.state   || '',
        addedBy:   s.addedBy || 'system',
      }));
      await Station.insertMany(stations);
      console.log(`   ✔ ${stations.length} stations imported from stations.json`);
    } else {
      console.log(`   ℹ  Stations already seeded (${stationCount} found) — skipping.`);
    }

    // ── 3. PORTS ──────────────────────────────────────────────────────────────
    const portCount = await Port.countDocuments();
    if (portCount === 0) {
      console.log('🌱  Seeding ports...');
      const rawPorts = JSON.parse(fs.readFileSync(PORTS_PATH, 'utf8'));
      const ports = rawPorts.map(p => ({
        portId:        p.id,
        stationId:     p.stationId,
        connectorType: p.connectorType,
        powerKw:       p.powerKw,
      }));
      await Port.insertMany(ports);
      console.log(`   ✔ ${ports.length} ports imported from ports.json`);
    } else {
      console.log(`   ℹ  Ports already seeded (${portCount} found) — skipping.`);
    }

    // ── 4. PROMO CODES ────────────────────────────────────────────────────────
    const PromoCode = require('./models/PromoCode');
    const promoCount = await PromoCode.countDocuments();
    if (promoCount === 0) {
      console.log('🌱  Seeding promo codes...');
      await PromoCode.insertMany([
        {
          code: 'WELCOME50', type: 'flat', value: 50,
          usageLimit: 1000, perUserLimit: 1,
          validUntil: new Date('2027-12-31'),
          description: 'Welcome bonus — ₹50 free credit',
        },
        {
          code: 'CHARGE100', type: 'flat', value: 100,
          usageLimit: 500, perUserLimit: 1,
          validUntil: new Date('2027-06-30'),
          description: 'First charge bonus — ₹100 free credit',
        },
        {
          code: 'VOLTPATH20', type: 'flat', value: 20,
          usageLimit: 5000, perUserLimit: 3,
          validUntil: new Date('2027-12-31'),
          description: 'Repeat user bonus — ₹20 free credit',
        },
      ]);
      console.log('   ✔ 3 promo codes created (WELCOME50, CHARGE100, VOLTPATH20)');
    } else {
      console.log(`   ℹ  Promo codes already seeded (${promoCount} found) — skipping.`);
    }

    // ── 5. WALLETS ────────────────────────────────────────────────────────────
    const Wallet = require('./models/Wallet');
    const walletCount = await Wallet.countDocuments();
    if (walletCount === 0) {
      console.log('🌱  Seeding wallets...');
      await Wallet.insertMany([
        { userId: 'u1', balance: 500 },
        { userId: 'u2', balance: 200 },
      ]);
      console.log('   ✔ Wallets created (admin: ₹500, demo: ₹200)');
    } else {
      console.log(`   ℹ  Wallets already seeded (${walletCount} found) — skipping.`);
    }

    console.log('\n🎉  Seed complete! You can now start the server with: npm start');
    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
