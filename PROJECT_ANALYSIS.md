# VoltPath – Project Analysis Document

---

## 1. Problem Definition

India's electric vehicle (EV) ecosystem is growing rapidly, with **25,000+ public charging stations** deployed by 2025 and the number surging every quarter. However, the EV charging experience for end-users remains fragmented and frustrating. EV drivers are forced to install and manage **17–20 different mobile apps** from various Charge Point Operators (CPOs) like Tata Power, Ather, BESCOM, Zeon, ChargeZone, and others — each with its own registration, payment gateway, and station database.

**Core Problems Identified:**

1. **App Fatigue & Fragmentation** – Over 40 CPOs operate independently in India. Each has its own app, leading to confusion and a poor user experience.
2. **No Unified View** – There is no single platform where a user can view stations from all operators on one map.
3. **Range Anxiety** – Users are unsure whether they can reach a charging station within their vehicle's battery range, especially on highways and intercity routes.
4. **Real-Time Visibility Gap** – Many existing apps lack reliable real-time status of charger availability (free, occupied, or defective). Reports show nearly **50% of public chargers are non-functional** at any given time.
5. **Interoperability** – Stations use diverse connector types (Type 2, CCS2, CHAdeMO, Bharat DC-001, GB/T), and there is no unified system to help users filter by compatibility.
6. **Long-Trip Planning** – Existing apps support "nearby station" search but do not intelligently break a long route into segments and suggest charging stops based on vehicle range.

**VoltPath** aims to solve these problems by providing a **single, centralized, smart EV charging station locator and slot management platform**.

---

## 2. Literature Survey

### 2.1 Academic & Industry Research

| Source / Study | Key Findings |
|---|---|
| **Bolt.Earth Industry Report, 2025** | 50%+ of India's ~30,000 public chargers are non-operational. Average utilization rate is below 25%. Over 40 CPOs run independent networks. |
| **AckoDrive EV Report, 2024** | "App fatigue" is a primary barrier — drivers need ~17–20 apps. Payment inconsistencies (card vs UPI vs cash) compound the problem. |
| **Ministry of Power Guidelines, 2024** | Issued guidelines to promote standardization and interoperability across charging networks. Target: fully interoperable, single national app by 2030. |
| **ORF Online Analysis, 2025** | Outdated chargers (e.g., Bharat-001 standard) are becoming incompatible with newer EVs. Grid constraints were not designed for high-power EV charging. |
| **EVUpdate Media, 2025** | India's 2025 battery-swapping policy aims to standardize connector types and promote interoperability across networks. |
| **DIY Guru EV Research, 2025** | India has 26,367+ public charging stations. Tier-2 cities saw 4,625 operational stations by April 2025. Growth is significant but unevenly distributed. |
| **Vasudha Foundation Report, 2024** | 16,347 public charging stations were operational by March 2024, growing to 25,202 by December 2024 — a 54% growth in 9 months. |

### 2.2 Key Observations from Literature

- There is a **clear government push** (FAME II, state subsidies) toward expanding charging infrastructure, but the software layer (user-facing apps) remains fragmented.
- The concept of an **aggregator platform** (like what OLA/Uber did for taxis) is recognized as a gap in the EV charging ecosystem.
- **Real-time port status monitoring** using IoT/API integration is still nascent; most apps rely on static or delayed data.
- **Route-based trip planning** with charging stop suggestions is offered by some apps (Tata Power, Zeon) but limited to their own network only.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | User Registration and Login (with secure authentication) | High |
| FR-02 | User Profile management (vehicle type, model, battery range) | High |
| FR-03 | Interactive map displaying charging stations from all operators | High |
| FR-04 | Search and filter stations by location, range, connector type, and operator | High |
| FR-05 | Real-time port status display (Free / Occupied / Defective) | High |
| FR-06 | Slot reservation system (30-minute time slots) | High |
| FR-07 | View and cancel existing reservations | Medium |
| FR-08 | Navigate to station via Google Maps integration | High |
| FR-09 | Long-trip planner with automatic charging stop suggestions based on battery range | High |
| FR-10 | Community feature — users can add new charging stations | Medium |
| FR-11 | Admin panel for user and station management | Medium |
| FR-12 | Geolocation-based "Locate Me" to find nearby stations from current position | Medium |

### 3.2 Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | The system shall respond to API requests within 500ms under normal load |
| NFR-02 | The UI shall be responsive and usable on both desktop and mobile browsers |
| NFR-03 | User passwords shall be hashed (SHA-256) and never stored in plain text |
| NFR-04 | The system shall support concurrent users without data corruption |
| NFR-05 | The application shall use a modern, dark-themed, accessible UI design |
| NFR-06 | The system shall gracefully handle network failures and show appropriate messages |

---

## 4. Feasibility Study

### 4.1 Technical Feasibility ✅

| Factor | Assessment |
|--------|------------|
| **Frontend** | HTML, CSS, JavaScript with Leaflet.js for maps — all open-source, well-documented, no licensing costs |
| **Backend** | Node.js + Express — lightweight, widely supported, fast prototyping |
| **Maps & Routing** | OpenStreetMap (free) for tiles; Google Maps API available for production routing |
| **Real-Time Status** | Simulated via algorithm in the prototype; can be replaced with IoT/webhook integration |
| **Hosting** | Can run on any cloud (AWS, GCP, Heroku) or local machine with Node.js installed |
| **Data Storage** | JSON files for PoC; easily upgradable to MongoDB/PostgreSQL for production |

**Verdict:** Technically feasible with open-source tools. No proprietary dependencies.

### 4.2 Economic Feasibility ✅

| Item | Cost |
|------|------|
| Development tools (VS Code, Node.js, Git) | Free / Open-source |
| Map tiles (OpenStreetMap) | Free |
| Hosting (PoC phase) | Free (localhost) |
| Hosting (Production - basic cloud VM) | ~₹500–2,000/month |
| Google Maps API (if needed) | Free tier: 28,000 map loads/month |
| Domain name | ~₹800/year |

**Verdict:** Very low cost for development and deployment. Economically viable for a student/startup project.

### 4.3 Operational Feasibility ✅

- Target users (EV owners) are already tech-savvy and use smartphone apps for charging.
- The UI follows familiar patterns (map-based search, similar to Google Maps, Swiggy, Ola).
- No training required — intuitive interface with clear labels and buttons.
- Community contribution model (adding stations) encourages organic data growth.

**Verdict:** Operationally feasible. Users can adopt it without a learning curve.

### 4.4 Schedule Feasibility ✅

| Phase | Duration |
|-------|----------|
| Research & Requirement Gathering | 3 weeks |
| System Design & Architecture Planning | 3 weeks |
| Backend API Development | 4 weeks |
| Frontend UI Development | 5 weeks |
| Integration & System Testing | 3 weeks |
| User Acceptance Testing (UAT) & Bug Fixing | 3 weeks |
| Documentation & Deployment | 2 weeks |
| Post-Deployment Monitoring & Maintenance | 1 week |
| **Total** | **~6 months (24 weeks)** |

**Verdict:** Achievable within a full semester timeline with adequate time for iterative development, rigorous testing, and thorough documentation.

---

## 5. Existing System

### 5.1 Current Market Players

| App | Operator | Stations | Key Features | Limitations |
|-----|----------|----------|--------------|-------------|
| **Tata Power EZ Charge** | Tata Power | 5,500+ charging points across 620+ cities | Station locator, trip planner, slot booking, RFID, wallet, multi-payment | **Only shows Tata Power stations**; no third-party stations |
| **Ather Grid** | Ather Energy | 1,400+ fast-charger locations in 100+ cities | QR scan-to-charge, remote monitoring, filter by plug type | **Primarily for Ather scooters**; limited DC charger coverage |
| **BESCOM EV Mitra** | BESCOM (Govt.) | Karnataka only | 11-language support, OTP/RFID login, UPI payments, WhatsApp bot | **Karnataka-only coverage**; no intercity routing |
| **Zeon Charging** | Zeon | 400+ chargers | Live SOC display, trip planner, auto-charge, multi-session monitoring | **Limited network size**; only Zeon stations visible |

### 5.2 Key Drawbacks of the Existing System

1. **Operator Lock-In** — Each app only shows its own operator's stations. Users cannot see a unified view.
2. **Multiple Registrations** — Users need separate accounts, wallets, and payment setups for each app.
3. **No Cross-Network Trip Planning** — Trip planners only suggest stops from their own network, missing potentially closer stations from other operators.
4. **Inconsistent Real-Time Data** — Some apps show static data or delayed status, leading to wasted trips to non-functional chargers.
5. **No Community Contribution** — None of the apps allow users to report new stations or update existing station info.
6. **No Range-Based Filtering** — Most apps search by distance radius but don't consider the user's actual vehicle battery range for intelligent filtering.

---

## 6. Proposed System — VoltPath

### 6.1 System Overview

**VoltPath** is a centralized, smart EV charging station locator and slot management platform that aggregates stations from **all major operators** (Ather, Tata Power, BESCOM, Zeon, and community-added stations) into a **single, unified interface**.

### 6.2 Key Differentiators from Existing Systems

| Feature | Existing Apps | VoltPath (Proposed) |
|---------|---------------|---------------------|
| Multi-operator stations | ❌ Only own network | ✅ All operators on one map |
| Single login/account | ❌ Separate per app | ✅ One account for everything |
| Range-based smart search | ❌ Distance-only | ✅ Filters by vehicle's battery range |
| Cross-network trip planner | ❌ Own stations only | ✅ Suggests nearest station from ANY operator |
| Real-time port status | ⚠️ Inconsistent | ✅ Simulated (IoT-ready architecture) |
| Community station addition | ❌ Not available | ✅ Users can add new stations |
| User vehicle profile | ⚠️ Limited | ✅ Full profile with vehicle model & battery range |
| Slot reservation | ✅ Available in some | ✅ Available with 30-min granularity |
| Google Maps navigation | ✅ Available | ✅ One-click navigation |

### 6.3 System Architecture

```
┌──────────────────────────────────────────────────┐
│                   FRONTEND                        │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │
│  │ Login  │  │  Map   │  │ Detail │  │  Trip  │ │
│  │  Page  │  │  View  │  │ Panel  │  │Planner │ │
│  └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘ │
│      └───────────┴──────────┴────────────┘       │
│              HTML / CSS / JavaScript              │
│              Leaflet.js + OpenStreetMap            │
└──────────────────┬───────────────────────────────┘
                   │  REST API (JSON)
┌──────────────────▼───────────────────────────────┐
│                   BACKEND                         │
│              Node.js + Express                    │
│  ┌──────────────────────────────────────────────┐│
│  │  Auth Module    │  Station API  │  Slots API ││
│  │  (Login/Signup) │  (CRUD + Geo) │  (Reserve) ││
│  └──────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────┐│
│  │  Port Status    │  Trip Planner │   Users    ││
│  │  (Simulated)    │  (Range Algo) │   (CRUD)   ││
│  └──────────────────────────────────────────────┘│
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│                 DATA LAYER                        │
│    stations.json  │  ports.json  │  users.json    │
│    (In-memory reservations for PoC)               │
└──────────────────────────────────────────────────┘
```

### 6.4 Modules Implemented

| Module | Description | PoC Status |
|--------|-------------|------------|
| **Authentication** | Secure login/logout with token-based sessions, password hashing (SHA-256) | ✅ Complete |
| **User Profile** | Store vehicle type, model, battery range; editable via profile modal | ✅ Complete |
| **Station Locator** | Interactive map with markers for all operators, range-based filtering using Haversine formula | ✅ Complete |
| **Real-Time Port Status** | Simulated status engine (free/occupied/defective) with periodic refresh | ✅ Complete |
| **Slot Reservation** | Browse available 30-min slots, reserve, view "My Reservations", cancel | ✅ Complete |
| **Trip Planner** | Set destination on map, auto-calculate charging stops based on range, draw route with stop markers | ✅ Complete |
| **Community Stations** | Authenticated users can add new stations with coordinates | ✅ Complete |
| **Navigation** | One-click Google Maps navigation to any station | ✅ Complete |
| **Admin Panel** | Admin can view all users, manage data | ✅ Complete |

---

## 7. Other Analysis Issues

### 7.1 Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Real-time status data unavailable from operators | High | Medium | Use simulation engine (current approach); can integrate APIs later |
| Google Maps API rate limits / costs | Medium | Low | Use OpenStreetMap for maps (free); Google only for navigation links |
| Data accuracy of community-added stations | Medium | Medium | Admin moderation panel; future: community voting/verification |
| Scalability with JSON file storage | High (at scale) | High | Migrate to MongoDB/PostgreSQL for production deployment |
| Security vulnerabilities (token theft) | Low | High | Use HTTPS in production; implement token expiry and refresh tokens |

### 7.2 Technology Stack Summary

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend | HTML5, CSS3, Vanilla JS | Lightweight, no build step, fast loading |
| Maps | Leaflet.js + OpenStreetMap | Free, open-source, no API key required |
| Backend | Node.js + Express.js | Fast I/O, large npm ecosystem, easy REST API creation |
| Data Storage | JSON files (PoC) | Simple for prototyping; upgrade path to DB exists |
| Authentication | SHA-256 hashing + Bearer tokens | Industry-standard approach for session management |
| Navigation | Google Maps URLs | Universal, works on all devices |

### 7.3 Use Case Summary

| Actor | Use Case |
|-------|----------|
| **EV Owner** | Register → Login → Set vehicle & range → Search stations → View port status → Reserve slot → Navigate → Plan long trip |
| **Community User** | Login → Add new station with coordinates → Station appears on map for all users |
| **Admin** | Login → View all users → Monitor system → Manage stations |

### 7.4 Future Enhancements

1. **IoT Integration** — Replace simulated port status with real sensor data via MQTT/webhooks.
2. **Google Directions API** — Use actual road routing instead of straight-line distance for trip planning.
3. **Payment Gateway** — Integrate Razorpay/Stripe for in-app charging payments.
4. **Android/iOS App** — Build a native mobile app using the same REST API backend.
5. **Rating & Reviews** — Allow users to rate stations and leave reviews.
6. **Push Notifications** — Notify users when their reserved slot is approaching or when a nearby station becomes free.
7. **EV Battery Analytics** — Track charging patterns and suggest optimal charging schedules.
8. **Multi-Language Support** — Add regional language support (Kannada, Tamil, Hindi) like BESCOM EV Mitra.

---

*Document prepared for: VoltPath – Smart EV Charging Station Locator & Slot Management*
*Date: February 2026*
