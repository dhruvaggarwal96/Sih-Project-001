require('dotenv').config();

const cors = require('cors');
const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { createRoadIntelligence } = require('./road-intelligence');

const app = express();
const port = Number(process.env.PORT ?? 4000);
const databaseDirectory = path.join(__dirname, 'database');
const uploadsDirectory = path.join(__dirname, 'uploads');

fs.mkdirSync(databaseDirectory, { recursive: true });
fs.mkdirSync(uploadsDirectory, { recursive: true });

const db = new sqlite3.Database(path.join(databaseDirectory, 'urban-intelligence.db'));
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(error) {
    if (error) reject(error);
    else resolve({ id: this.lastID, changes: this.changes });
  });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)));
});

app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use('/uploads', express.static(uploadsDirectory));

let roadIntelligence = null;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isLatitude(value) {
  return value !== null && value >= -90 && value <= 90;
}

function isLongitude(value) {
  return value !== null && value >= -180 && value <= 180;
}

function healthFromInspection({ tyreCondition, brakeCondition, lightsCondition, fuelBatteryLevel, engineTemperature }) {
  if (
    tyreCondition === 'Poor' ||
    brakeCondition === 'Poor' ||
    (engineTemperature !== null && engineTemperature >= 105) ||
    (fuelBatteryLevel !== null && fuelBatteryLevel <= 10)
  ) return 'Critical';

  if (
    tyreCondition === 'Fair' ||
    brakeCondition === 'Fair' ||
    lightsCondition === 'Faulty' ||
    (engineTemperature !== null && engineTemperature >= 95) ||
    (fuelBatteryLevel !== null && fuelBatteryLevel <= 25)
  ) return 'Needs Attention';

  return 'Good';
}

async function initialiseDatabase() {
  await run('PRAGMA foreign_keys = ON');
  await run(`
    CREATE TABLE IF NOT EXISTS buses (
      id TEXT PRIMARY KEY,
      route_id TEXT,
      latitude REAL,
      longitude REAL,
      speed_kmph REAL,
      passenger_count INTEGER,
      crowd_level TEXT,
      fuel_battery_level REAL,
      health_status TEXT NOT NULL DEFAULT 'Good',
      status TEXT NOT NULL DEFAULT 'On route',
      last_seen_at TEXT,
      updated_at TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bus_id TEXT NOT NULL,
      driver_id TEXT,
      route_id TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed_kmph REAL,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (bus_id) REFERENCES buses(id)
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bus_id TEXT,
      driver_id TEXT NOT NULL,
      route_id TEXT,
      issue_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT,
      latitude REAL,
      longitude REAL,
      is_emergency INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      reported_at TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bus_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      fuel_battery_level REAL,
      engine_temperature REAL,
      tyre_condition TEXT,
      brake_condition TEXT,
      lights_condition TEXT,
      fault_description TEXT,
      health_status TEXT NOT NULL,
      inspected_at TEXT NOT NULL,
      FOREIGN KEY (bus_id) REFERENCES buses(id)
    )
  `);
  await run('CREATE INDEX IF NOT EXISTS idx_locations_bus_time ON locations(bus_id, recorded_at DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_reports_status_time ON reports(status, reported_at DESC)');
}

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'urban-intelligence-api', time: new Date().toISOString() });
});

// Driver app: sends a GPS point and the current speed for one bus.
app.post('/api/location', async (request, response, next) => {
  try {
    const busId = text(request.body.busId);
    const driverId = text(request.body.driverId);
    const routeId = text(request.body.routeId) || null;
    const latitude = number(request.body.latitude);
    const longitude = number(request.body.longitude);
    const speedKmph = number(request.body.speedKmph);
    const passengerCount = number(request.body.passengerCount);
    const crowdLevel = text(request.body.crowdLevel) || null;

    if (!busId || !driverId || !isLatitude(latitude) || !isLongitude(longitude)) {
      return response.status(400).json({ error: 'busId, driverId, valid latitude, and valid longitude are required.' });
    }
    if (speedKmph !== null && speedKmph < 0) {
      return response.status(400).json({ error: 'speedKmph cannot be negative.' });
    }

    const recordedAt = new Date().toISOString();
    await run(
      `INSERT INTO buses (id, route_id, latitude, longitude, speed_kmph, passenger_count, crowd_level, last_seen_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         route_id = COALESCE(excluded.route_id, buses.route_id),
         latitude = excluded.latitude,
         longitude = excluded.longitude,
         speed_kmph = excluded.speed_kmph,
         passenger_count = COALESCE(excluded.passenger_count, buses.passenger_count),
         crowd_level = COALESCE(excluded.crowd_level, buses.crowd_level),
         status = CASE WHEN buses.status = 'Breakdown' THEN buses.status ELSE 'On route' END,
         last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at`,
      [busId, routeId, latitude, longitude, speedKmph, passengerCount, crowdLevel, recordedAt, recordedAt],
    );
    await run(
      'INSERT INTO locations (bus_id, driver_id, route_id, latitude, longitude, speed_kmph, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [busId, driverId, routeId, latitude, longitude, speedKmph, recordedAt],
    );

    return response.status(201).json({ message: 'Location saved.', busId, recordedAt });
  } catch (error) {
    return next(error);
  }
});

// Driver app: sends a traffic, road-condition, breakdown, or SOS report.
app.post('/api/report', async (request, response, next) => {
  try {
    const busId = text(request.body.busId) || null;
    const driverId = text(request.body.driverId);
    const routeId = text(request.body.routeId) || null;
    const issueType = text(request.body.issueType);
    const severity = text(request.body.severity) || 'Medium';
    const description = text(request.body.description) || null;
    const latitude = request.body.latitude === undefined ? null : number(request.body.latitude);
    const longitude = request.body.longitude === undefined ? null : number(request.body.longitude);
    const isEmergency = request.body.isEmergency === true || request.body.isEmergency === 1 ? 1 : 0;

    if (!driverId || !issueType) {
      return response.status(400).json({ error: 'driverId and issueType are required.' });
    }
    if ((latitude === null) !== (longitude === null) || (latitude !== null && (!isLatitude(latitude) || !isLongitude(longitude)))) {
      return response.status(400).json({ error: 'Send both valid latitude and longitude, or send neither.' });
    }

    const reportedAt = new Date().toISOString();
    const result = await run(
      `INSERT INTO reports (bus_id, driver_id, route_id, issue_type, severity, description, latitude, longitude, is_emergency, reported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [busId, driverId, routeId, issueType, severity, description, latitude, longitude, isEmergency, reportedAt],
    );
    if (busId && (isEmergency || severity === 'Critical' || issueType.toLowerCase().includes('breakdown'))) {
      const busStatus = isEmergency ? 'Emergency' : 'Breakdown';
      await run(
        `INSERT INTO buses (id, status, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
        [busId, busStatus, reportedAt],
      );
    }

    return response.status(201).json({ message: 'Report saved.', reportId: result.id, reportedAt });
  } catch (error) {
    return next(error);
  }
});

// Driver app: sends a manual inspection or data read from vehicle sensors.
app.post('/api/inspection', async (request, response, next) => {
  try {
    const busId = text(request.body.busId);
    const driverId = text(request.body.driverId);
    const fuelBatteryLevel = request.body.fuelBatteryLevel === undefined ? null : number(request.body.fuelBatteryLevel);
    const engineTemperature = request.body.engineTemperature === undefined ? null : number(request.body.engineTemperature);
    const tyreCondition = text(request.body.tyreCondition) || 'Good';
    const brakeCondition = text(request.body.brakeCondition) || 'Good';
    const lightsCondition = text(request.body.lightsCondition) || 'Good';
    const faultDescription = text(request.body.faultDescription) || null;

    if (!busId || !driverId) {
      return response.status(400).json({ error: 'busId and driverId are required.' });
    }
    if ((fuelBatteryLevel !== null && (fuelBatteryLevel < 0 || fuelBatteryLevel > 100)) || (engineTemperature !== null && engineTemperature < 0)) {
      return response.status(400).json({ error: 'Fuel/battery must be 0–100 and engine temperature cannot be negative.' });
    }

    const healthStatus = healthFromInspection({ tyreCondition, brakeCondition, lightsCondition, fuelBatteryLevel, engineTemperature });
    const inspectedAt = new Date().toISOString();
    const result = await run(
      `INSERT INTO inspections (bus_id, driver_id, fuel_battery_level, engine_temperature, tyre_condition, brake_condition, lights_condition, fault_description, health_status, inspected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [busId, driverId, fuelBatteryLevel, engineTemperature, tyreCondition, brakeCondition, lightsCondition, faultDescription, healthStatus, inspectedAt],
    );
    await run(
      `INSERT INTO buses (id, fuel_battery_level, health_status, status, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         fuel_battery_level = excluded.fuel_battery_level,
         health_status = excluded.health_status,
         status = CASE WHEN buses.status = 'Breakdown' THEN buses.status ELSE excluded.status END,
         updated_at = excluded.updated_at`,
      [busId, fuelBatteryLevel, healthStatus, healthStatus === 'Critical' ? 'Needs attention' : 'On route', inspectedAt],
    );

    return response.status(201).json({ message: 'Inspection saved.', inspectionId: result.id, healthStatus, inspectedAt });
  } catch (error) {
    return next(error);
  }
});

// Citizen app: lists buses with their last known location and service status.
app.get('/api/buses', async (request, response, next) => {
  try {
    const routeId = text(request.query.routeId);
    const params = [];
    let sql = `SELECT id AS busId, route_id AS routeId, latitude, longitude, speed_kmph AS speedKmph,
      passenger_count AS passengerCount, crowd_level AS crowdLevel, fuel_battery_level AS fuelBatteryLevel,
      health_status AS healthStatus, status, last_seen_at AS lastSeenAt
      FROM buses`;
    if (routeId) {
      sql += ' WHERE route_id = ?';
      params.push(routeId);
    }
    sql += ' ORDER BY last_seen_at DESC';
    const buses = await all(sql, params);
    return response.json({ updatedAt: new Date().toISOString(), buses });
  } catch (error) {
    return next(error);
  }
});

// Government dashboard: combines bus status, reports, and route-level data.
app.get('/api/dashboard', async (_request, response, next) => {
  try {
    const [buses, alerts, summary, routePerformance, roadReports, openRoadIssues] = await Promise.all([
      all(`SELECT id AS busId, route_id AS routeId, latitude, longitude, speed_kmph AS speedKmph,
        passenger_count AS passengerCount, crowd_level AS crowdLevel, fuel_battery_level AS fuelBatteryLevel,
        health_status AS healthStatus, status, last_seen_at AS lastSeenAt FROM buses ORDER BY last_seen_at DESC`),
      all(`SELECT id, bus_id AS busId, driver_id AS driverId, route_id AS routeId, issue_type AS issueType,
        severity, description, latitude, longitude, is_emergency AS isEmergency, status, reported_at AS reportedAt
        FROM reports WHERE status = 'open' ORDER BY reported_at DESC LIMIT 50`),
      get(`SELECT
        COUNT(*) AS totalBuses,
        SUM(CASE WHEN julianday(last_seen_at) >= julianday('now', '-5 minutes') THEN 1 ELSE 0 END) AS activeBuses,
        SUM(CASE WHEN status = 'Breakdown' THEN 1 ELSE 0 END) AS breakdowns,
        SUM(CASE WHEN health_status IN ('Needs Attention', 'Critical') THEN 1 ELSE 0 END) AS busesNeedingAttention
        FROM buses`),
      all(`SELECT COALESCE(route_id, 'Unassigned') AS routeId, COUNT(*) AS buses,
        ROUND(AVG(speed_kmph), 1) AS averageSpeedKmph,
        SUM(CASE WHEN crowd_level = 'High' THEN 1 ELSE 0 END) AS crowdedBuses,
        SUM(CASE WHEN status = 'Breakdown' THEN 1 ELSE 0 END) AS breakdowns
        FROM buses GROUP BY route_id ORDER BY crowdedBuses DESC, averageSpeedKmph ASC`),
      roadIntelligence ? roadIntelligence.listRoadReports() : Promise.resolve([]),
      roadIntelligence ? roadIntelligence.getOpenRoadIssueCount() : Promise.resolve(0),
    ]);
    const openAlerts = alerts.length;
    return response.json({
      updatedAt: new Date().toISOString(),
      summary: {
        totalBuses: Number(summary?.totalBuses ?? 0),
        activeBuses: Number(summary?.activeBuses ?? 0),
        breakdowns: Number(summary?.breakdowns ?? 0),
        busesNeedingAttention: Number(summary?.busesNeedingAttention ?? 0),
        openAlerts,
        openRoadIssues,
      },
      buses,
      alerts,
      routePerformance,
      roadReports,
    });
  } catch (error) {
    return next(error);
  }
});

function handleError(error, _request, response, _next) {
  console.error(error);
  response.status(500).json({ error: 'The server could not process this request.' });
}

initialiseDatabase()
  .then(async () => {
    roadIntelligence = await createRoadIntelligence({ run, get, all });
    app.use('/api', roadIntelligence.router);
    app.use(handleError);
    app.listen(port, '0.0.0.0', () => {
      console.log(`Urban Intelligence API running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });
