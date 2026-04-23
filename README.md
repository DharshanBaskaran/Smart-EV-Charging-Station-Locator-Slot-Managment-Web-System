# VoltPath – Working Model

A runnable prototype for **VoltPath: Smart EV Charging Station Locator & Slot Management**. This demonstrates PoC 1–4 from the project draft (map + stations, real-time port status, slot reservation, route to station).

## What’s included

- **Backend** (Node.js + Express): REST API for stations, ports with simulated status, slots, and reservations.
- **Frontend** (HTML/CSS/JS): Map (Leaflet/OpenStreetMap), station list, station detail with live port status, reserve slot flow, “My reservations”, and route line to selected station.

## Prerequisites

- **Node.js** (v16 or later): [nodejs.org](https://nodejs.org)

## How to run

1. **Install dependencies**
   ```bash
   cd voltpath-working-model/backend
   npm install
   ```

2. **Start the server** (serves both API and frontend)
   ```bash
   npm start
   ```

3. **Open in browser**
   - Go to: **http://localhost:3001**
   - You should see the map with 5 charging stations. Click a station in the list or on the map to see details and port status. Use **Reserve** to book a slot and **Get route** to draw the route from the default location to the station.

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stations` | List all stations |
| GET | `/api/stations/:id` | Station detail + ports with live status |
| GET | `/api/ports/status` | All ports with simulated status |
| GET | `/api/ports/:portId/slots` | Available 30-min slots (next 48 h) |
| POST | `/api/reservations` | Create reservation (body: `portId`, `startTime`, `endTime`, `userId`) |
| GET | `/api/reservations?userId=user1` | List reservations |
| DELETE | `/api/reservations/:id` | Cancel reservation |

- **Trip Planner** (PoC 5): Plan long trips; select destination on map and get suggested charging stops based on battery range.
- **Centralized Platform**: Integrates stations from multiple operators (Ather, Tata Power, BESCOM, Zeon).

## PoCs covered

| PoC | Feature | How to try |
|-----|---------|------------|
| 1 | Map + aggregated stations | Open app → stations on map and in list |
| 2 | Real-time port status | Select a station → port status (free/occupied/defective); refreshes periodically |
| 3 | Slot reservation | Select station → Reserve on a free port → choose slot → confirm; see “My reservations” and cancel |
| 4 | Route to station | Select station → “Get route” → route line on map |
| 5 | **Trip Planner** | Click "Plan Long Trip" → Set Range → Click Map for Dest → See Route + Stops |

## Data

- **Stations**: `backend/data/stations.json` (5 sample stations).
- **Ports**: `backend/data/ports.json` (connector type, power). Status is **simulated** (changes over time) so no IoT hardware is required.
- **Reservations**: In-memory; lost on server restart.

## Optional: run frontend separately

If you prefer to serve the frontend from another port (e.g. for development):

1. Serve the frontend, e.g. from `frontend` folder:
   ```bash
   npx serve frontend
   ```
2. In `frontend/app.js`, set `API_BASE` to `http://localhost:3001/api`.
3. Start the backend: `cd backend && npm start`.
4. Open the URL shown by `serve` (e.g. http://localhost:3000).

## Next steps (from project draft)

- Replace simulated port status with real IoT/sensors.
- Integrate **Google Directions API** for production route optimization (this demo uses a simple polyline).
- Add **charging stop suggestion** (PoC 5) using route + vehicle range.
- Build the **Android app** using the same API.
