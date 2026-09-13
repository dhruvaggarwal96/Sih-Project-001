export type ShiftStatus = 'not_started' | 'active' | 'paused' | 'ended';
export type SyncStatus = 'pending' | 'synced';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type VehicleHealth = 'Good' | 'Needs Attention' | 'Critical';

export interface Driver {
  id: number;
  name: string;
  driver_code: string;
  phone: string | null;
  assigned_bus_id: number;
  assigned_route_id: number;
  is_logged_in: number;
}

export interface DriverProfile extends Driver {
  bus_number: string;
  vehicle_type: string;
  fuel_type: string;
  fuel_or_battery_level: number;
  health_status: VehicleHealth;
  route_number: string;
  route_name: string;
  start_stop: string;
  end_stop: string;
}

export interface Trip {
  id: number;
  driver_id: number;
  bus_id: number;
  route_id: number;
  start_time: string;
  end_time: string | null;
  status: ShiftStatus;
  total_distance_km: number;
}

export interface LocationLog {
  id: number;
  trip_id: number;
  latitude: number;
  longitude: number;
  speed_kmph: number | null;
  recorded_at: string;
  sync_status: SyncStatus;
}

export interface IssueReport {
  id: number;
  trip_id: number | null;
  driver_id: number;
  issue_type: string;
  severity: Severity;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  reported_at: string;
  sync_status: SyncStatus;
  is_emergency: number;
}

export interface VehicleInspection {
  id: number;
  bus_id: number;
  driver_id: number;
  fuel_or_battery_level: number | null;
  engine_temperature: number | null;
  tyre_condition: string;
  brake_condition: string;
  lights_condition: string;
  fault_description: string | null;
  health_status: VehicleHealth;
  inspected_at: string;
  sync_status: SyncStatus;
}

export interface DashboardData {
  trip: Trip | null;
  totalDistanceKm: number;
  reportsToday: number;
  lastLocationAt: string | null;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  speedKmph?: number | null;
}
