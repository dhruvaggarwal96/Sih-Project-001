import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  Coordinates,
  DashboardData,
  DriverProfile,
  IssueReport,
  LocationLog,
  Severity,
  ShiftStatus,
  SyncStatus,
  Trip,
  VehicleHealth,
  VehicleInspection,
} from '@/types';

const pending: SyncStatus = 'pending';

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);

async function addToSyncQueue(
  db: SQLiteDatabase,
  entityType: string,
  entityId: number,
  actionType = 'create'
) {
  // Future government-server API sync will read pending items from this queue.
  await db.runAsync(
    `INSERT INTO sync_queue (entity_type, entity_id, action_type, created_at, sync_status)
     VALUES (?, ?, ?, ?, ?)`,
    entityType,
    entityId,
    actionType,
    now(),
    pending
  );
}

export async function getActiveDriverProfile(db: SQLiteDatabase) {
  return db.getFirstAsync<DriverProfile>(
    `SELECT d.*, b.bus_number, b.vehicle_type, b.fuel_type, b.fuel_or_battery_level, b.health_status,
            r.route_number, r.route_name, r.start_stop, r.end_stop
     FROM drivers d
     JOIN buses b ON b.id = d.assigned_bus_id
     JOIN routes r ON r.id = d.assigned_route_id
     WHERE d.is_logged_in = ?
     LIMIT 1`,
    1
  );
}

export async function loginDemo(db: SQLiteDatabase, driverCode: string, password: string) {
  const normalizedCode = driverCode.trim().toUpperCase();
  if (normalizedCode !== 'DRV-101' || password !== '1234') {
    throw new Error('Use demo ID DRV-101 and password 1234.');
  }

  const driver = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM drivers WHERE driver_code = ?',
    normalizedCode
  );
  if (!driver) throw new Error('Demo driver is not available.');

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('UPDATE drivers SET is_logged_in = ?', 0);
    await txn.runAsync('UPDATE drivers SET is_logged_in = ? WHERE id = ?', 1, driver.id);
  });
}

export async function logout(db: SQLiteDatabase) {
  await db.runAsync('UPDATE drivers SET is_logged_in = ?', 0);
}

export async function getOpenTrip(db: SQLiteDatabase, driverId: number) {
  return db.getFirstAsync<Trip>(
    `SELECT * FROM trips
     WHERE driver_id = ? AND status IN ('active', 'paused')
     ORDER BY id DESC LIMIT 1`,
    driverId
  );
}

export async function getLatestTrip(db: SQLiteDatabase, driverId: number) {
  return db.getFirstAsync<Trip>('SELECT * FROM trips WHERE driver_id = ? ORDER BY id DESC LIMIT 1', driverId);
}

export async function startShift(db: SQLiteDatabase, profile: DriverProfile) {
  const current = await getOpenTrip(db, profile.id);
  if (current) {
    if (current.status === 'paused') {
      await updateTripStatus(db, current.id, 'active');
    }
    return current.id;
  }

  const result = await db.runAsync(
    `INSERT INTO trips (driver_id, bus_id, route_id, start_time, status, total_distance_km)
     VALUES (?, ?, ?, ?, ?, ?)`,
    profile.id,
    profile.assigned_bus_id,
    profile.assigned_route_id,
    now(),
    'active',
    0
  );
  const tripId = Number(result.lastInsertRowId);
  await addToSyncQueue(db, 'trip', tripId);
  return tripId;
}

export async function updateTripStatus(db: SQLiteDatabase, tripId: number, status: ShiftStatus) {
  const endTime = status === 'ended' ? now() : null;
  await db.runAsync('UPDATE trips SET status = ?, end_time = ? WHERE id = ?', status, endTime, tripId);
  await addToSyncQueue(db, 'trip', tripId, 'update');
}

export async function getDashboardData(db: SQLiteDatabase, driverId: number): Promise<DashboardData> {
  const [trip, distance, reportCount, lastLocation] = await Promise.all([
    getOpenTrip(db, driverId),
    db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(total_distance_km), 0) AS total
       FROM trips WHERE driver_id = ? AND substr(start_time, 1, 10) = ?`,
      driverId,
      today()
    ),
    db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM issue_reports
       WHERE driver_id = ? AND substr(reported_at, 1, 10) = ?`,
      driverId,
      today()
    ),
    db.getFirstAsync<{ recorded_at: string }>(
      `SELECT l.recorded_at FROM location_logs l
       JOIN trips t ON t.id = l.trip_id
       WHERE t.driver_id = ? ORDER BY l.id DESC LIMIT 1`,
      driverId
    ),
  ]);

  return {
    trip: trip ?? null,
    totalDistanceKm: Number(distance?.total ?? 0),
    reportsToday: Number(reportCount?.total ?? 0),
    lastLocationAt: lastLocation?.recorded_at ?? null,
  };
}

function distanceInKm(first: Coordinates, second: Coordinates) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDistance = rad(second.latitude - first.latitude);
  const longitudeDistance = rad(second.longitude - first.longitude);
  const a =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(rad(first.latitude)) * Math.cos(rad(second.latitude)) * Math.sin(longitudeDistance / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function recordLocation(db: SQLiteDatabase, tripId: number, coordinates: Coordinates) {
  const previous = await db.getFirstAsync<LocationLog>(
    'SELECT * FROM location_logs WHERE trip_id = ? ORDER BY id DESC LIMIT 1',
    tripId
  );
  const result = await db.runAsync(
    `INSERT INTO location_logs (trip_id, latitude, longitude, speed_kmph, recorded_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    tripId,
    coordinates.latitude,
    coordinates.longitude,
    coordinates.speedKmph ?? null,
    now(),
    pending
  );
  const locationId = Number(result.lastInsertRowId);
  if (previous) {
    const additionalDistance = distanceInKm(previous, coordinates);
    await db.runAsync(
      'UPDATE trips SET total_distance_km = total_distance_km + ? WHERE id = ?',
      additionalDistance,
      tripId
    );
  }
  await addToSyncQueue(db, 'location_log', locationId);
  return locationId;
}

async function markSynced(db: SQLiteDatabase, table: 'location_logs' | 'issue_reports' | 'vehicle_inspections', entityType: string, id: number) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(`UPDATE ${table} SET sync_status = ? WHERE id = ?`, 'synced', id);
    await txn.runAsync(
      'UPDATE sync_queue SET sync_status = ? WHERE entity_type = ? AND entity_id = ?',
      'synced',
      entityType,
      id
    );
  });
}

export function markLocationSynced(db: SQLiteDatabase, id: number) {
  return markSynced(db, 'location_logs', 'location_log', id);
}

export async function getLastLocation(db: SQLiteDatabase, driverId: number) {
  return db.getFirstAsync<LocationLog>(
    `SELECT l.* FROM location_logs l
     JOIN trips t ON t.id = l.trip_id
     WHERE t.driver_id = ? ORDER BY l.id DESC LIMIT 1`,
    driverId
  );
}

export async function saveIssueReport(
  db: SQLiteDatabase,
  input: {
    driverId: number;
    tripId?: number | null;
    issueType: string;
    severity: Severity;
    description?: string;
    latitude?: number | null;
    longitude?: number | null;
    isEmergency?: boolean;
  }
) {
  const result = await db.runAsync(
    `INSERT INTO issue_reports
      (trip_id, driver_id, issue_type, severity, description, latitude, longitude, reported_at, sync_status, is_emergency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.tripId ?? null,
    input.driverId,
    input.issueType,
    input.severity,
    input.description?.trim() || null,
    input.latitude ?? null,
    input.longitude ?? null,
    now(),
    pending,
    input.isEmergency ? 1 : 0
  );
  const reportId = Number(result.lastInsertRowId);
  await addToSyncQueue(db, 'issue_report', reportId);
  return reportId;
}

export function markIssueReportSynced(db: SQLiteDatabase, id: number) {
  return markSynced(db, 'issue_reports', 'issue_report', id);
}

export async function getIssueReports(
  db: SQLiteDatabase,
  driverId: number,
  issueType = 'All',
  syncStatus = 'All'
) {
  const where = ['driver_id = ?'];
  const params: (number | string)[] = [driverId];
  if (issueType !== 'All') {
    where.push('issue_type = ?');
    params.push(issueType);
  }
  if (syncStatus !== 'All') {
    where.push('sync_status = ?');
    params.push(syncStatus);
  }
  return db.getAllAsync<IssueReport>(
    `SELECT * FROM issue_reports WHERE ${where.join(' AND ')} ORDER BY id DESC`,
    ...params
  );
}

function calculateHealth(
  tyreCondition: string,
  brakeCondition: string,
  lightsCondition: string,
  fuelLevel: number | null,
  engineTemperature: number | null
): VehicleHealth {
  if (
    brakeCondition === 'Poor' ||
    tyreCondition === 'Poor' ||
    engineTemperature !== null && engineTemperature >= 105 ||
    fuelLevel !== null && fuelLevel <= 10
  ) {
    return 'Critical';
  }
  if (
    brakeCondition === 'Fair' ||
    tyreCondition === 'Fair' ||
    lightsCondition === 'Faulty' ||
    engineTemperature !== null && engineTemperature >= 95 ||
    fuelLevel !== null && fuelLevel <= 25
  ) {
    return 'Needs Attention';
  }
  return 'Good';
}

export async function saveInspection(
  db: SQLiteDatabase,
  input: {
    busId: number;
    driverId: number;
    fuelLevel: number | null;
    engineTemperature: number | null;
    tyreCondition: string;
    brakeCondition: string;
    lightsCondition: string;
    faultDescription?: string;
  }
) {
  const health = calculateHealth(
    input.tyreCondition,
    input.brakeCondition,
    input.lightsCondition,
    input.fuelLevel,
    input.engineTemperature
  );
  const result = await db.runAsync(
    `INSERT INTO vehicle_inspections
      (bus_id, driver_id, fuel_or_battery_level, engine_temperature, tyre_condition, brake_condition,
       lights_condition, fault_description, health_status, inspected_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.busId,
    input.driverId,
    input.fuelLevel,
    input.engineTemperature,
    input.tyreCondition,
    input.brakeCondition,
    input.lightsCondition,
    input.faultDescription?.trim() || null,
    health,
    now(),
    pending
  );
  const inspectionId = Number(result.lastInsertRowId);
  await db.runAsync(
    `UPDATE buses
     SET fuel_or_battery_level = COALESCE(?, fuel_or_battery_level), health_status = ?
     WHERE id = ?`,
    input.fuelLevel,
    health,
    input.busId
  );
  await addToSyncQueue(db, 'vehicle_inspection', inspectionId);
  return { health, inspectionId };
}

export function markInspectionSynced(db: SQLiteDatabase, id: number) {
  return markSynced(db, 'vehicle_inspections', 'vehicle_inspection', id);
}

export async function getInspectionHistory(db: SQLiteDatabase, driverId: number) {
  return db.getAllAsync<VehicleInspection>(
    'SELECT * FROM vehicle_inspections WHERE driver_id = ? ORDER BY id DESC LIMIT 8',
    driverId
  );
}
