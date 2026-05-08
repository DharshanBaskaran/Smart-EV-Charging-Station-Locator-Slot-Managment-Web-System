# ⚡ Valence — Smart EV Charging Station Locator & Slot Management System

> **One app to find, book, and pay for EV charging — across every operator.**

Valence is a full-stack web platform that solves the biggest headache for Electric Vehicle (EV) owners: needing **17–20 different apps** just to find and use charging stations from different companies. Valence brings every operator's stations together into **one single map**, with real-time availability, easy booking, and a built-in digital wallet — so you only need **one account** to charge anywhere.

---

## 🤔 The Problem We Solve

Imagine you own an EV and want to drive from Chennai to Bangalore. Along the way, charging stations are run by different companies — Tata Power, Ather, Zeon, BESCOM, and more. Today, you would need:

- A **separate app** for each company
- A **separate account and wallet** for each
- **No way to see** all stations together on one map
- **No idea** if a charger is actually working until you arrive
- **No cross-company trip planning** for long drives

**Valence fixes all of this.** One map. One account. One wallet. Real-time updates. Trip planning across all operators.

---

## ✨ What Can You Do With Valence?

### 🗺️ Find Charging Stations Instantly
- See **all stations from every operator** on a single interactive map
- Filter by **your car's battery range** — only see stations you can actually reach
- Filter by **connector type** (Type 2 AC, CCS2, CHAdeMO, etc.) to find compatible chargers
- Works on desktop and mobile browsers

### 🟢 Check Charger Availability in Real Time
- Every charger port shows **live status**: Free, Occupied, or Defective
- Updates happen **automatically every 15 seconds** — no need to refresh the page
- Never drive to a broken or occupied charger again

### 📅 Book a Charging Slot
- Reserve a time slot from **15 minutes to 3 hours**
- See the **estimated cost before you book**
- No double-bookings — the system prevents scheduling conflicts
- View, manage, and cancel your reservations anytime

### 🔋 Live Charging Session Tracking
- Start a charging session and **watch your battery fill up in real time**
- Progress updates every **5 seconds** with live energy and cost display
- Automatic payment from your wallet when the session completes
- Instant invoice generated with GST breakdown

### 💰 Built-In Digital Wallet
- **One wallet** that works across all operators — no more juggling multiple payment methods
- Top up your balance anytime
- **Dynamic pricing** — cheaper rates during off-peak hours, higher during rush hour
- Apply **promo codes** for discounts
- Full **transaction history** with downloadable PDF invoices

### 🛣️ Trip Planner for Long Drives
- Planning a road trip? Enter your destination and battery range
- Valence calculates **which stations to stop at** along the way
- Suggests stops from **any operator** — not just one company
- See the full route with charging stops drawn on the map

### 🏢 Community-Powered Station Data
- Know a new station that's not on the map? **Submit it yourself!**
- An admin reviews and approves submissions to keep data accurate
- Crowd-sourced data means the map stays **up to date** faster than any single company can

### ⭐ Station Reviews & Ratings
- Read what other EV drivers think about a station
- Leave your own **star rating and review** after charging
- Helps the community find the **best-maintained stations**

### 🚗 Fleet Vehicle Management
- Manage **multiple vehicles** under one account
- Track charging history, costs, and energy usage for each vehicle
- Ideal for businesses or families with more than one EV

### 🤖 Smart Chatbot Assistant
- Have a question? Ask the built-in **intelligent chatbot**
- Understands common questions about charging, pricing, account help, and more
- Handles typos gracefully with fuzzy text matching

### 🌱 Carbon Footprint Tracker
- See how much **CO₂ you've avoided** by driving electric
- Track your environmental impact over time
- Equivalents shown in **trees planted** for easy understanding

### 🔐 Secure Account System
- **One account** to access everything — register once, charge everywhere
- Industry-standard password security (bcrypt hashing)
- Forgot your password? Recover it with your **security question** — no email required
- Admin and station-owner roles for advanced management

### 📱 Works Offline (PWA)
- Valence is a **Progressive Web App** — install it on your phone's home screen like a real app
- Basic features work even with a weak or lost internet connection

### 👑 Admin Command Center
- **Dashboard** with live analytics: total users, stations, sessions, revenue
- **Approve or reject** community-submitted stations
- **Manage users** — view, toggle roles, or remove accounts
- **Broadcast messages** to all users platform-wide
- **Activity logs** to monitor platform health

### 🏪 Station Owner Portal
- Station owners can view **analytics for their own stations**
- Track how busy their chargers are, revenue generated, and user ratings

---

## 🏗️ How It's Built (Technical Overview)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML, CSS, JavaScript | What users see and interact with |
| **Maps** | Leaflet.js + OpenStreetMap | Interactive map — completely free, no API keys needed |
| **Backend** | Node.js + Express.js | The server that handles all logic and data |
| **Database** | MongoDB + Mongoose | Stores all data: users, stations, bookings, wallets, etc. |
| **Real-Time** | Socket.io (WebSocket) | Live port status updates & charging progress |
| **Authentication** | JWT + bcrypt | Secure login system |
| **Security** | Helmet.js, Rate Limiting, Input Validation | Protection against common web attacks |
| **Charts** | Chart.js | Dashboard analytics visualisation |

### Project Structure

```
valence/
├── frontend/                  ← What users see (the website)
│   ├── index.html             ← Main map page
│   ├── login.html             ← Login & registration
│   ├── dashboard.html         ← Analytics dashboard
│   ├── history.html           ← Charging session history
│   ├── fleet.html             ← Fleet vehicle management
│   ├── admin.html             ← Admin command center
│   ├── owner.html             ← Station owner portal
│   ├── app.js                 ← Main application logic
│   ├── style.css              ← All styling
│   ├── sw.js                  ← Service worker (offline support)
│   └── manifest.json          ← PWA configuration
│
├── backend/                   ← The server (handles data & logic)
│   ├── server.js              ← Main server file
│   ├── seed.js                ← Populates database with sample data
│   ├── routes/                ← 18 API route modules
│   │   ├── auth.js            ← Login, register, password recovery
│   │   ├── stations.js        ← Station search & management
│   │   ├── ports.js           ← Port status & connector data
│   │   ├── reservations.js    ← Slot booking system
│   │   ├── sessions.js        ← Live charging sessions
│   │   ├── wallet.js          ← Digital wallet & payments
│   │   ├── pricing.js         ← Dynamic time-of-day pricing
│   │   ├── reviews.js         ← Station ratings & reviews
│   │   ├── chat.js            ← Intelligent chatbot
│   │   ├── fleet.js           ← Fleet vehicle management
│   │   ├── notifications.js   ← In-app notifications
│   │   ├── dashboard.js       ← Analytics data
│   │   ├── admin.js           ← Admin operations
│   │   ├── owner.js           ← Station owner portal
│   │   ├── referrals.js       ← Referral reward system
│   │   ├── qr.js              ← QR code generation
│   │   ├── users.js           ← User profile management
│   │   └── docs.js            ← API documentation
│   ├── models/                ← 12 database collections
│   ├── middleware/             ← Security & authentication checks
│   ├── config/                ← Database & environment config
│   └── utils/                 ← Helper functions
│
└── README.md                  ← You are here!
```

---

## 🚀 How to Run the Project

### What You Need First

1. **Node.js** (version 16 or later) — [Download here](https://nodejs.org)
2. **MongoDB** — Either:
   - Install locally: [mongodb.com/try/download](https://www.mongodb.com/try/download/community)
   - Or use the free cloud option: [MongoDB Atlas](https://www.mongodb.com/atlas) (no install needed)

### Step-by-Step Setup

```bash
# 1. Go to the backend folder
cd valence/backend

# 2. Install all required packages
npm install

# 3. Set up your environment file
#    (Edit the .env file with your MongoDB connection string if needed)

# 4. Populate the database with sample stations & data
npm run seed

# 5. Start the server
npm start
```

### Open the App

Go to **http://localhost:3001** in your browser — that's it! 🎉

You'll see an interactive map with charging stations. Create an account and start exploring.

---

## 📡 API Modules (18 Total)

For developers — Valence exposes a complete REST API:

| Module | What It Handles |
|--------|----------------|
| **Auth** | Register, login, password recovery, security questions |
| **Stations** | Search, filter, add, and manage charging stations |
| **Ports** | Real-time port status (Free / Occupied / Defective) |
| **Reservations** | Book, view, and cancel time slots |
| **Sessions** | Start, track, and complete live charging sessions |
| **Wallet** | Balance, top-up, transactions, promo codes, invoices |
| **Pricing** | Dynamic rates based on time of day and day of week |
| **Reviews** | Station ratings and user reviews |
| **Chat** | Intelligent chatbot with fuzzy text matching |
| **Fleet** | Multi-vehicle management under one account |
| **Notifications** | In-app alerts for bookings, approvals, etc. |
| **Dashboard** | Platform analytics and KPIs |
| **Admin** | User management, station approvals, broadcasts |
| **Owner** | Station owner analytics portal |
| **Referrals** | Refer-a-friend reward system |
| **QR** | QR code generation for stations |
| **Users** | Profile and vehicle data management |
| **Docs** | Swagger-style API documentation |

---

## 🔮 Future Enhancements

| Enhancement | What It Means |
|------------|---------------|
| **Live IoT Sensors** | Replace simulated port status with real hardware sensors |
| **Google Directions API** | Use actual road routes instead of straight-line distances |
| **Payment Gateway** | Real money payments via Razorpay or Stripe |
| **Mobile App** | Native Android/iOS app using React Native or Flutter |
| **Push Notifications** | SMS and push alerts for slot reminders and availability |
| **Vehicle Detection** | Ultrasonic sensors to auto-detect if a car is parked at a charger |
| **More Languages** | Add Kannada, Telugu, Bengali, Marathi (currently supports English, Hindi, Tamil) |

---

## 🛡️ Security Features

- 🔒 **JWT tokens** for secure, stateless authentication
- 🔑 **bcrypt password hashing** — passwords are never stored in plain text
- 🛡️ **Helmet.js** — protects against common web vulnerabilities
- 🚦 **Rate limiting** — prevents brute-force attacks (100 requests/15 min general, 20/15 min for login)
- ✅ **Input validation** — all user inputs are checked and sanitised
- 👮 **Role-based access control** — separate permissions for users, station owners, and admins

---

## 📊 Key Numbers

| Metric | Value |
|--------|-------|
| Backend API routes | 18 modules, 50+ endpoints |
| Database collections | 12 |
| Real-time update interval | Port status: 15 seconds, Charging progress: 5 seconds |
| Supported connector types | Type 2 AC, CCS2, CHAdeMO, Bharat DC-001, GB/T |
| Slot duration range | 15 minutes to 3 hours |
| Supported languages | English, Hindi, Tamil |
| Pricing tiers | Peak (1.5x), Standard (1.0x), Off-Peak (0.7x) |
| Cost | 100% open-source — zero licensing fees |

---

## 👨‍💻 Author

**S. B. Dharshan**
Department of MCA, P.S.N.A College of Engineering and Technology (Autonomous)
Dindigul, Tamil Nadu, India

**Guide: Mr. S. Jai Ganesh, MCA., M.Phil., MBA.**
Associate Professor, Department of MCA

---

<p align="center">
  <strong>Built with ❤️ using open-source technologies</strong><br>
  Node.js • Express.js • MongoDB • Socket.io • Leaflet.js • OpenStreetMap
</p>
