const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const express = require('express');
const multer = require('multer');

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const SUPPORTED_ISSUES = new Set(['pothole', 'garbage', 'flooding', 'road_blockage', 'accident']);
const STATUSES = new Set(['open', 'assigned', 'in_progress', 'resolved']);

const uploadDirectory = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadDirectory),
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNumber(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function validLatitude(value) {
  return value !== null && value >= -90 && value <= 90;
}

function validLongitude(value) {
  return value !== null && value >= -180 && value <= 180;
}

function normalizeIssue(value) {
  const normalized = cleanText(value).toLowerCase().replace(/[ -]/g, '_');
  if (['pothole', 'potholes', 'road_damage'].includes(normalized)) return 'pothole';
  if (['garbage', 'trash', 'waste', 'garbage_overflow', 'garbage_dump'].includes(normalized)) return 'garbage';
  if (['flood', 'flooding', 'waterlogging', 'water_logging', 'ponding_water'].includes(normalized)) return 'flooding';
  if (['road_blockage', 'blockage', 'obstruction', 'debris', 'traffic_obstruction'].includes(normalized)) return 'road_blockage';
  if (['accident', 'crash'].includes(normalized)) return 'accident';
  return null;
}

function pointIsInsidePolygon(latitude, longitude, points) {
  let inside = false;
  for (let i = 0, previous = points.length - 1; i < points.length; previous = i, i += 1) {
    const [longitudeA, latitudeA] = points[i];
    const [longitudeB, latitudeB] = points[previous];
    const crossesLatitude = (latitudeA > latitude) !== (latitudeB > latitude);
    const lineLongitude = ((longitudeB - longitudeA) * (latitude - latitudeA)) / (latitudeB - latitudeA) + longitudeA;
    if (crossesLatitude && longitude < lineLongitude) inside = !inside;
  }
  return inside;
}

function calculatePriority({ issueType, potholeCount, maximumDiameterCm, trafficLevel, nearSensitiveSite, repeatedReports }) {
  let score = 0;

  if (issueType === 'pothole') {
    if (maximumDiameterCm >= 60) score += 35;
    else if (maximumDiameterCm >= 30) score += 25;
    else if (maximumDiameterCm > 0) score += 15;
    else score += 8;
    if (potholeCount >= 3) score += 20;
    else if (potholeCount === 2) score += 10;
  } else if (issueType === 'flooding' || issueType === 'road_blockage' || issueType === 'accident') {
    score += 30;
  } else {
    score += 15;
  }

  if (trafficLevel === 'High') score += 20;
  else if (trafficLevel === 'Medium') score += 10;
  if (nearSensitiveSite) score += 15;
  if (repeatedReports >= 3) score += 10;
  else if (repeatedReports >= 1) score += 5;

  const priorityScore = Math.min(100, score);
  const priorityLevel = priorityScore >= 75 ? 'Critical' : priorityScore >= 50 ? 'High' : priorityScore >= 25 ? 'Medium' : 'Low';
  return { priorityScore, priorityLevel };
}

function estimateDiameterCm(prediction, manualDiameterCm) {
  if (manualDiameterCm !== null && manualDiameterCm > 0) {
    return { diameterCm: manualDiameterCm, source: 'manual field measurement' };
  }

  const calibratedCentimetresPerPixel = cleanNumber(process.env.CAMERA_CM_PER_PIXEL);
  if (calibratedCentimetresPerPixel !== null && calibratedCentimetresPerPixel > 0 && prediction.width > 0) {
    return {
      diameterCm: Math.round(prediction.width * calibratedCentimetresPerPixel * 10) / 10,
      source: 'calibrated image estimate',
    };
  }

  return { diameterCm: null, source: 'field measurement required' };
}

function displayIssue(issueType) {
  return issueType.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function runRoadModel(filePath, mimeType, demoIssueType) {
  const response = await fetch(`${process.env.ML_SERVICE_URL ?? 'http://127.0.0.1:8001'}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: fs.readFileSync(filePath).toString('base64'),
      mimeType,
      demoIssueType,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.detail || 'The road-condition model is unavailable.');
  }
  return payload;
}

async function createRoadIntelligence({ run, get, all }) {
  await run('PRAGMA foreign_keys = ON');
  await run(`
    CREATE TABLE IF NOT EXISTS municipalities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      contact_phone TEXT,
      contact_email TEXT
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS wards (
      id TEXT PRIMARY KEY,
      municipality_id TEXT NOT NULL,
      ward_number TEXT NOT NULL,
      name TEXT NOT NULL,
      boundary_geojson TEXT NOT NULL,
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id)
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS road_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT UNIQUE,
      bus_id TEXT,
      driver_id TEXT NOT NULL,
      route_id TEXT,
      issue_type TEXT NOT NULL,
      confidence REAL NOT NULL,
      prediction_count INTEGER NOT NULL DEFAULT 1,
      pothole_count INTEGER NOT NULL DEFAULT 0,
      max_pothole_diameter_cm REAL,
      diameter_source TEXT,
      priority_score INTEGER NOT NULL,
      priority_level TEXT NOT NULL,
      traffic_level TEXT NOT NULL DEFAULT 'Medium',
      near_sensitive_site INTEGER NOT NULL DEFAULT 0,
      repeated_reports INTEGER NOT NULL DEFAULT 0,
      photo_path TEXT NOT NULL,
      model_mode TEXT NOT NULL,
      model_note TEXT,
      detections_json TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      ward_id TEXT,
      municipality_id TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (ward_id) REFERENCES wards(id),
      FOREIGN KEY (municipality_id) REFERENCES municipalities(id)
    )
  `);
  await run('CREATE INDEX IF NOT EXISTS idx_road_reports_status_time ON road_reports(status, created_at DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_road_reports_issue_location ON road_reports(issue_type, latitude, longitude)');

  const sampleMunicipality = await get('SELECT id FROM municipalities WHERE id = ?', ['DEMO-CENTRAL-MC']);
  if (!sampleMunicipality) {
    // These sample boundaries are only for the SIH demonstration. Replace them with official ward GeoJSON before deployment.
    await run(
      `INSERT INTO municipalities (id, name, department_name, contact_name, contact_phone, contact_email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['DEMO-CENTRAL-MC', 'Demo Central Municipal Corporation', 'Roads and Drainage Department', 'Ward Control Officer', '+91-00000-00000', 'roads@example.gov.in'],
    );
    await run(
      `INSERT INTO wards (id, municipality_id, ward_number, name, boundary_geojson)
       VALUES (?, ?, ?, ?, ?)`,
      [
        'DEMO-WARD-12',
        'DEMO-CENTRAL-MC',
        '12',
        'Central Zone',
        JSON.stringify([[77.17, 28.57], [77.27, 28.57], [77.27, 28.67], [77.17, 28.67]]),
      ],
    );
  }

  async function findJurisdiction(latitude, longitude) {
    const wards = await all(`
      SELECT w.id AS wardId, w.ward_number AS wardNumber, w.name AS wardName, w.boundary_geojson AS boundaryGeojson,
        m.id AS municipalityId, m.name AS municipalityName, m.department_name AS departmentName,
        m.contact_name AS contactName, m.contact_phone AS contactPhone, m.contact_email AS contactEmail
      FROM wards w JOIN municipalities m ON m.id = w.municipality_id
    `);
    for (const ward of wards) {
      try {
        if (pointIsInsidePolygon(latitude, longitude, JSON.parse(ward.boundaryGeojson))) return ward;
      } catch {
        // A malformed imported ward boundary must not stop other wards from matching.
      }
    }
    return null;
  }

  async function listRoadReports(status = '') {
    const params = [];
    let sql = `
      SELECT rr.id, rr.ticket_id AS ticketId, rr.bus_id AS busId, rr.driver_id AS driverId, rr.route_id AS routeId,
        rr.issue_type AS issueType, rr.confidence, rr.prediction_count AS predictionCount, rr.pothole_count AS potholeCount,
        rr.max_pothole_diameter_cm AS maxPotholeDiameterCm, rr.diameter_source AS diameterSource,
        rr.priority_score AS priorityScore, rr.priority_level AS priorityLevel, rr.traffic_level AS trafficLevel,
        rr.near_sensitive_site AS nearSensitiveSite, rr.repeated_reports AS repeatedReports, rr.photo_path AS photoPath,
        rr.model_mode AS modelMode, rr.model_note AS modelNote, rr.detections_json AS detectionsJson,
        rr.latitude, rr.longitude, rr.status, rr.assigned_to AS assignedTo, rr.created_at AS createdAt, rr.updated_at AS updatedAt,
        w.ward_number AS wardNumber, w.name AS wardName, m.name AS municipalityName, m.department_name AS departmentName,
        m.contact_name AS contactName, m.contact_phone AS contactPhone, m.contact_email AS contactEmail
      FROM road_reports rr
      LEFT JOIN wards w ON w.id = rr.ward_id
      LEFT JOIN municipalities m ON m.id = rr.municipality_id`;
    if (status && STATUSES.has(status)) {
      sql += ' WHERE rr.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY rr.priority_score DESC, rr.created_at DESC LIMIT 100';
    const rows = await all(sql, params);
    return rows.map((row) => ({
      ...row,
      nearSensitiveSite: Boolean(row.nearSensitiveSite),
      detections: JSON.parse(row.detectionsJson),
    }));
  }

  const router = express.Router();

  router.post('/road-condition', upload.single('photo'), async (request, response, next) => {
    try {
      const busId = cleanText(request.body.busId) || null;
      const driverId = cleanText(request.body.driverId);
      const routeId = cleanText(request.body.routeId) || null;
      const latitude = cleanNumber(request.body.latitude);
      const longitude = cleanNumber(request.body.longitude);
      const trafficLevel = ['Low', 'Medium', 'High'].includes(cleanText(request.body.trafficLevel)) ? cleanText(request.body.trafficLevel) : 'Medium';
      const nearSensitiveSite = request.body.nearSensitiveSite === 'true' || request.body.nearSensitiveSite === '1';
      const manualDiameterCm = cleanNumber(request.body.potholeDiameterCm);
      const demoIssueType = normalizeIssue(request.body.demoIssueType);

      if (!request.file) return response.status(400).json({ error: 'A JPG, PNG, or WEBP road photo is required.' });
      if (!driverId || !validLatitude(latitude) || !validLongitude(longitude)) {
        fs.unlink(request.file.path, () => {});
        return response.status(400).json({ error: 'driverId, valid latitude, and valid longitude are required.' });
      }
      if (manualDiameterCm !== null && (manualDiameterCm <= 0 || manualDiameterCm > 500)) {
        fs.unlink(request.file.path, () => {});
        return response.status(400).json({ error: 'Pothole diameter must be between 1 and 500 cm when provided.' });
      }

      const modelResult = await runRoadModel(request.file.path, request.file.mimetype, demoIssueType);
      const detections = (Array.isArray(modelResult.predictions) ? modelResult.predictions : [])
        .map((prediction) => ({
          issueType: normalizeIssue(prediction.class || prediction.issueType),
          confidence: Number(prediction.confidence ?? 0),
          x: Number(prediction.x ?? 0),
          y: Number(prediction.y ?? 0),
          width: Number(prediction.width ?? 0),
          height: Number(prediction.height ?? 0),
        }))
        .filter((prediction) => prediction.issueType && SUPPORTED_ISSUES.has(prediction.issueType) && prediction.confidence >= 0.25);

      if (!detections.length) {
        fs.unlink(request.file.path, () => {});
        return response.status(422).json({ error: 'The model did not find a supported road problem in this photo.' });
      }

      const grouped = Object.values(Object.groupBy(detections, (prediction) => prediction.issueType));
      const mainGroup = grouped.sort((first, second) => second.length - first.length || Math.max(...second.map((item) => item.confidence)) - Math.max(...first.map((item) => item.confidence)))[0];
      const issueType = mainGroup[0].issueType;
      const confidence = Math.max(...mainGroup.map((item) => item.confidence));
      const potholes = detections.filter((item) => item.issueType === 'pothole');
      const diameters = potholes.map((item) => estimateDiameterCm(item, manualDiameterCm));
      const knownDiameters = diameters.map((item) => item.diameterCm).filter((item) => item !== null);
      const maxPotholeDiameterCm = knownDiameters.length ? Math.max(...knownDiameters) : null;
      const diameterSource = diameters.find((item) => item.diameterCm !== null)?.source ?? 'field measurement required';
      const repeated = await get(
        `SELECT COUNT(*) AS count FROM road_reports
         WHERE issue_type = ? AND status != 'resolved' AND created_at >= datetime('now', '-7 days')
           AND ABS(latitude - ?) < 0.005 AND ABS(longitude - ?) < 0.005`,
        [issueType, latitude, longitude],
      );
      const repeatedReports = Number(repeated?.count ?? 0);
      const priority = calculatePriority({ issueType, potholeCount: potholes.length, maximumDiameterCm: maxPotholeDiameterCm ?? 0, trafficLevel, nearSensitiveSite, repeatedReports });
      const jurisdiction = await findJurisdiction(latitude, longitude);
      const createdAt = new Date().toISOString();
      const photoPath = `/uploads/${path.basename(request.file.path)}`;

      const created = await run(
        `INSERT INTO road_reports (
          bus_id, driver_id, route_id, issue_type, confidence, prediction_count, pothole_count, max_pothole_diameter_cm,
          diameter_source, priority_score, priority_level, traffic_level, near_sensitive_site, repeated_reports, photo_path,
          model_mode, model_note, detections_json, latitude, longitude, ward_id, municipality_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          busId, driverId, routeId, issueType, confidence, detections.length, potholes.length, maxPotholeDiameterCm,
          diameterSource, priority.priorityScore, priority.priorityLevel, trafficLevel, nearSensitiveSite ? 1 : 0,
          repeatedReports, photoPath, cleanText(modelResult.modelMode) || 'roboflow', cleanText(modelResult.note) || null,
          JSON.stringify(detections), latitude, longitude, jurisdiction?.wardId ?? null, jurisdiction?.municipalityId ?? null,
          createdAt, createdAt,
        ],
      );
      const ticketId = `RD-${String(created.id).padStart(4, '0')}`;
      await run('UPDATE road_reports SET ticket_id = ? WHERE id = ?', [ticketId, created.id]);

      return response.status(201).json({
        ticketId,
        issueType: displayIssue(issueType),
        confidence: Math.round(confidence * 100),
        potholeCount: potholes.length,
        estimatedDiameterCm: maxPotholeDiameterCm,
        diameterSource,
        ...priority,
        status: 'open',
        municipality: jurisdiction ? {
          name: jurisdiction.municipalityName,
          wardNumber: jurisdiction.wardNumber,
          wardName: jurisdiction.wardName,
          department: jurisdiction.departmentName,
          contactName: jurisdiction.contactName,
        } : null,
        modelMode: modelResult.modelMode,
        note: modelResult.note || null,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/road-reports', async (request, response, next) => {
    try {
      return response.json({ updatedAt: new Date().toISOString(), roadReports: await listRoadReports(cleanText(request.query.status)) });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/road-reports/:ticketId', express.json(), async (request, response, next) => {
    try {
      const status = cleanText(request.body.status);
      const assignedTo = cleanText(request.body.assignedTo) || null;
      if (!STATUSES.has(status)) return response.status(400).json({ error: 'Use open, assigned, in_progress, or resolved status.' });
      const result = await run(
        'UPDATE road_reports SET status = ?, assigned_to = COALESCE(?, assigned_to), updated_at = ? WHERE ticket_id = ?',
        [status, assignedTo, new Date().toISOString(), request.params.ticketId],
      );
      if (!result.changes) return response.status(404).json({ error: 'Road report ticket was not found.' });
      const report = (await listRoadReports()).find((item) => item.ticketId === request.params.ticketId);
      return response.json({ message: 'Road report updated.', roadReport: report });
    } catch (error) {
      return next(error);
    }
  });

  return {
    router,
    uploadDirectory,
    listRoadReports,
    getOpenRoadIssueCount: async () => Number((await get("SELECT COUNT(*) AS count FROM road_reports WHERE status != 'resolved'"))?.count ?? 0),
  };
}

module.exports = { createRoadIntelligence };
