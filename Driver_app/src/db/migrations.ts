import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

/** Creates the local, offline-first database and its small set of demo records. */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        driver_code TEXT NOT NULL UNIQUE,
        phone TEXT,
        assigned_bus_id INTEGER NOT NULL,
        assigned_route_id INTEGER NOT NULL,
        is_logged_in INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS buses (
        id INTEGER PRIMARY KEY NOT NULL,
        bus_number TEXT NOT NULL UNIQUE,
        vehicle_type TEXT NOT NULL,
        fuel_type TEXT NOT NULL,
        fuel_or_battery_level REAL NOT NULL,
        health_status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY NOT NULL,
        route_number TEXT NOT NULL,
        route_name TEXT NOT NULL,
        start_stop TEXT NOT NULL,
        end_stop TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY NOT NULL,
        driver_id INTEGER NOT NULL,
        bus_id INTEGER NOT NULL,
        route_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        status TEXT NOT NULL,
        total_distance_km REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (driver_id) REFERENCES drivers(id),
        FOREIGN KEY (bus_id) REFERENCES buses(id),
        FOREIGN KEY (route_id) REFERENCES routes(id)
      );

      CREATE TABLE IF NOT EXISTS location_logs (
        id INTEGER PRIMARY KEY NOT NULL,
        trip_id INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        speed_kmph REAL,
        recorded_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (trip_id) REFERENCES trips(id)
      );

      CREATE TABLE IF NOT EXISTS issue_reports (
        id INTEGER PRIMARY KEY NOT NULL,
        trip_id INTEGER,
        driver_id INTEGER NOT NULL,
        issue_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT,
        latitude REAL,
        longitude REAL,
        reported_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        is_emergency INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (trip_id) REFERENCES trips(id),
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
      );

      CREATE TABLE IF NOT EXISTS vehicle_inspections (
        id INTEGER PRIMARY KEY NOT NULL,
        bus_id INTEGER NOT NULL,
        driver_id INTEGER NOT NULL,
        fuel_or_battery_level REAL,
        engine_temperature REAL,
        tyre_condition TEXT NOT NULL,
        brake_condition TEXT NOT NULL,
        lights_condition TEXT NOT NULL,
        fault_description TEXT,
        health_status TEXT NOT NULL,
        inspected_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (bus_id) REFERENCES buses(id),
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS idx_reports_driver_date ON issue_reports(driver_id, reported_at);
      CREATE INDEX IF NOT EXISTS idx_location_trip_date ON location_logs(trip_id, recorded_at);
    `);
    currentVersion = 1;
  }

  if (currentVersion < DATABASE_VERSION) {
    // Add future safe migrations here, one version at a time.
    currentVersion = DATABASE_VERSION;
  }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
  await seedDemoData(db);
}

async function seedDemoData(db: SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM drivers');
  if ((existing?.count ?? 0) > 0) return;

  await db.runAsync(
    `INSERT INTO buses (id, bus_number, vehicle_type, fuel_type, fuel_or_battery_level, health_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    1,
    'DL 1PC 4821',
    'Electric city bus',
    'Battery',
    78,
    'Good'
  );
  await db.runAsync(
    `INSERT INTO routes (id, route_number, route_name, start_stop, end_stop)
     VALUES (?, ?, ?, ?, ?)`,
    1,
    '522',
    'ISBT Kashmiri Gate - Ambedkar Nagar',
    'ISBT Kashmiri Gate',
    'Ambedkar Nagar'
  );
  await db.runAsync(
    `INSERT INTO drivers (id, name, driver_code, phone, assigned_bus_id, assigned_route_id, is_logged_in)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    1,
    'Ravi Kumar',
    'DRV-101',
    null,
    1,
    1,
    0
  );

  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const trip = await db.runAsync(
    `INSERT INTO trips (driver_id, bus_id, route_id, start_time, end_time, status, total_distance_km)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    1,
    1,
    1,
    yesterday,
    yesterday,
    'ended',
    42.6
  );
  const tripId = Number(trip.lastInsertRowId);
  const report = await db.runAsync(
    `INSERT INTO issue_reports
       (trip_id, driver_id, issue_type, severity, description, latitude, longitude, reported_at, sync_status, is_emergency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    tripId,
    1,
    'Traffic congestion',
    'Medium',
    'Slow traffic near the bus stop.',
    28.641,
    77.218,
    yesterday,
    'synced',
    0
  );
  await db.runAsync(
    `INSERT INTO sync_queue (entity_type, entity_id, action_type, created_at, sync_status)
     VALUES (?, ?, ?, ?, ?)`,
    'issue_report',
    Number(report.lastInsertRowId),
    'create',
    yesterday,
    'synced'
  );
}
