# Road AI Scanner page

This is a separate web page for manual road-problem uploads. It sends the image or one sampled video frame to the existing Node Backend. The Backend calls the model service, saves the result in SQLite, finds the correct ward, and creates a municipal ticket.

## 1. Run the model service

```powershell
cd 'C:\Users\LENOVO\Desktop\SIH Project\Backend\ml-service'
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
uvicorn main:app --host 0.0.0.0 --port 8001
```

In `Backend/ml-service/.env`, add your own Roboflow values:

```env
ROBOFLOW_API_KEY=your_secret_key
ROBOFLOW_MODEL_ID=your-project-name/1
```

For an SIH presentation without a Roboflow key, use this temporary demo value instead. The UI clearly labels the result as a demo and does **not** claim it is AI.

```env
DEMO_ML_MODE=true
```

## 2. Run the Node Backend

Open a second terminal:

```powershell
cd 'C:\Users\LENOVO\Desktop\SIH Project\Backend'
npm install
npm run dev
```

The API is now at `http://localhost:4000/api` and it automatically creates/updates this database:

```text
Backend/database/urban-intelligence.db
```

## 3. Run this page

Open a third terminal:

```powershell
cd 'C:\Users\LENOVO\Desktop\SIH Project\model'
npm install
Copy-Item .env.example .env
npm run dev
```

Open the localhost address Vite prints, usually `http://localhost:5173`.

## How it works

```text
User selects photo/video
    -> video: page takes one clear frame at 25% of its duration
    -> POST /api/road-condition with photo + GPS
    -> Python model service calls Roboflow
    -> Node API calculates priority and matches GPS to ward GeoJSON
    -> SQLite road_reports table stores the ticket
    -> page shows the result and saved ticket
```

## Important places to edit

| Need | File/place |
| --- | --- |
| Backend address | `model/.env` → `VITE_TRANSIT_API_URL` |
| Roboflow secret/model | `Backend/ml-service/.env` |
| AI classes | Roboflow dataset: `pothole`, `garbage`, `flooding`, `road_blockage`, `accident` |
| Priority rules | `Backend/road-intelligence.js` → `calculatePriority` |
| Ward/municipality routing | SQLite `wards` and `municipalities` tables; replace demo boundary with official ward GeoJSON |
| UI fields/style | `model/src/App.tsx` and `model/src/styles.css` |

## What the database stores

The `road_reports` table stores: uploaded photo path, GPS, issue type, confidence, detections, pothole count, size estimate, priority, ward, municipality, status, and timestamps.

The page is for manual reporting. The Driver Expo app can later call the same `POST /api/road-condition` endpoint using a camera image and its live GPS.
