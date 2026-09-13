import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS saved_trips (
        id TEXT PRIMARY KEY NOT NULL,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        route_id TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY NOT NULL,
        value INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tracking_subscriptions (
        bus_id TEXT PRIMARY KEY NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS read_alerts (
        alert_id TEXT PRIMARY KEY NOT NULL,
        read_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO preferences (key, value) VALUES ('service_updates', 1);
      INSERT OR IGNORE INTO preferences (key, value) VALUES ('crowd_updates', 1);
    `);
    currentVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

export async function getBooleanPreference(db: SQLiteDatabase, key: string, fallback = false) {
  const row = await db.getFirstAsync<{ value: number }>('SELECT value FROM preferences WHERE key = ?', key);
  return row ? row.value === 1 : fallback;
}

export async function setBooleanPreference(db: SQLiteDatabase, key: string, value: boolean) {
  await db.runAsync(
    'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value ? 1 : 0,
  );
}

export async function isTripSaved(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM saved_trips WHERE id = ?', id);
  return Boolean(row);
}

export async function saveTrip(db: SQLiteDatabase, origin: string, destination: string, routeId: string, isActive = false) {
  await db.runAsync(
    'INSERT INTO saved_trips (id, origin, destination, route_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET origin = excluded.origin, destination = excluded.destination, route_id = excluded.route_id, is_active = excluded.is_active',
    routeId,
    origin,
    destination,
    routeId,
    isActive ? 1 : 0,
    new Date().toISOString(),
  );
}

export async function removeTrip(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM saved_trips WHERE id = ?', id);
}

export async function getBusTracking(db: SQLiteDatabase, busId: string) {
  const row = await db.getFirstAsync<{ enabled: number }>('SELECT enabled FROM tracking_subscriptions WHERE bus_id = ?', busId);
  return row?.enabled === 1;
}

export async function setBusTracking(db: SQLiteDatabase, busId: string, enabled: boolean) {
  await db.runAsync(
    'INSERT INTO tracking_subscriptions (bus_id, enabled) VALUES (?, ?) ON CONFLICT(bus_id) DO UPDATE SET enabled = excluded.enabled',
    busId,
    enabled ? 1 : 0,
  );
}

export async function getReadAlertIds(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ alert_id: string }>('SELECT alert_id FROM read_alerts');
  return rows.map((row) => row.alert_id);
}

export async function markAlertRead(db: SQLiteDatabase, alertId: string) {
  await db.runAsync('INSERT OR IGNORE INTO read_alerts (alert_id, read_at) VALUES (?, ?)', alertId, new Date().toISOString());
}
