# Urban Intelligence API

This Node.js server shares transport data between the Expo citizen app, the Expo driver app, and the government dashboard.

## Run it

```powershell
cd 'C:\Users\LENOVO\Desktop\SIH Project\Backend'
npm install
npm run dev
```

The server starts at `http://localhost:4000`. Its SQLite database is created automatically in `database/urban-intelligence.db`.

For a physical phone, use your computer's local IPv4 address instead of `localhost`, for example `http://192.168.1.5:4000/api`.

## API routes

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/location` | Save a driver's GPS point and speed. |
| `POST` | `/api/report` | Save an SOS, breakdown, traffic, or road-condition report. |
| `POST` | `/api/inspection` | Save vehicle fuel/battery and health data. |
| `GET` | `/api/buses` | List buses and their latest positions. |
| `GET` | `/api/dashboard` | Get government dashboard summary, alerts, and route data. |
| `POST` | `/api/road-condition` | Upload a road photo, detect an issue, route it to a ward, and create a municipal ticket. |
| `GET` | `/api/road-reports` | List municipality road-issue tickets. |
| `PATCH` | `/api/road-reports/:ticketId` | Set a ticket to `open`, `assigned`, `in_progress`, or `resolved`. |

## Road-condition model and municipality tickets

Start the separate road-model service before using `POST /api/road-condition`:

```powershell
cd 'C:\Users\LENOVO\Desktop\SIH Project\Backend\ml-service'
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8001
```

Put the Roboflow key and model ID in `ml-service/.env`, not in the Expo or Dashboard projects. The API stores the photo, GPS, AI detections, pothole count, calibrated/manual size estimate, priority score, ward, municipal body, and ticket state. It includes a clearly labelled demo-only fallback when `DEMO_ML_MODE=true`.

The initial ward polygon is a **sample demonstration boundary**. Before deployment, import official municipality/ward GeoJSON into the `wards` table; the API uses point-in-polygon matching to route reports to the correct body.

## Request examples

### Save a location

```json
{
  "busId": "DL-01-AB-4821",
  "driverId": "DRV-101",
  "routeId": "522",
  "latitude": 28.641,
  "longitude": 77.218,
  "speedKmph": 32,
  "passengerCount": 42,
  "crowdLevel": "Moderate"
}
```

### Save a breakdown report

```json
{
  "busId": "DL-01-AB-4821",
  "driverId": "DRV-101",
  "routeId": "522",
  "issueType": "Breakdown",
  "severity": "Critical",
  "description": "Engine warning light is on.",
  "latitude": 28.641,
  "longitude": 77.218,
  "isEmergency": true
}
```

### Save an inspection

```json
{
  "busId": "DL-01-AB-4821",
  "driverId": "DRV-101",
  "fuelBatteryLevel": 78,
  "engineTemperature": 88,
  "tyreCondition": "Good",
  "brakeCondition": "Good",
  "lightsCondition": "Good"
}
```
