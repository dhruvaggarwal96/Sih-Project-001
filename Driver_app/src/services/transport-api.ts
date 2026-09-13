import { Platform } from 'react-native';

const apiUrl =
  process.env.EXPO_PUBLIC_TRANSIT_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api');

type LocationPayload = {
  busId: string;
  driverId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  speedKmph: number | null;
};

type ReportPayload = {
  busId: string;
  driverId: string;
  routeId: string;
  issueType: string;
  severity: string;
  description?: string;
  latitude: number | null;
  longitude: number | null;
  isEmergency?: boolean;
};

type InspectionPayload = {
  busId: string;
  driverId: string;
  fuelBatteryLevel: number | null;
  engineTemperature: number | null;
  tyreCondition: string;
  brakeCondition: string;
  lightsCondition: string;
  faultDescription?: string;
};

export type RoadTicket = {
  ticketId: string;
  issueType: string;
  confidence: number;
  potholeCount: number;
  estimatedDiameterCm: number | null;
  diameterSource: string;
  priorityScore: number;
  priorityLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  status: string;
  municipality: { name: string; wardNumber: string; wardName: string; department: string; contactName: string } | null;
  modelMode: 'roboflow' | 'demo';
  note: string | null;
};

async function send(path: string, body: object) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function syncLocation(payload: LocationPayload) {
  return send('/location', payload);
}

export function syncReport(payload: ReportPayload) {
  return send('/report', payload);
}

export function syncInspection(payload: InspectionPayload) {
  return send('/inspection', payload);
}

export async function submitRoadCondition(input: {
  busId: string;
  driverId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  photoUri: string;
  photoName?: string | null;
  photoMimeType?: string | null;
  trafficLevel: 'Low' | 'Medium' | 'High';
  nearSensitiveSite: boolean;
  potholeDiameterCm?: number | null;
  demoIssueType?: string | null;
}) {
  const form = new FormData();
  form.append('busId', input.busId);
  form.append('driverId', input.driverId);
  form.append('routeId', input.routeId);
  form.append('latitude', String(input.latitude));
  form.append('longitude', String(input.longitude));
  form.append('trafficLevel', input.trafficLevel);
  form.append('nearSensitiveSite', String(input.nearSensitiveSite));
  if (input.potholeDiameterCm) form.append('potholeDiameterCm', String(input.potholeDiameterCm));
  if (input.demoIssueType) form.append('demoIssueType', input.demoIssueType);
  form.append('photo', {
    uri: input.photoUri,
    name: input.photoName || `road-photo-${Date.now()}.jpg`,
    type: input.photoMimeType || 'image/jpeg',
  } as never);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(`${apiUrl}/road-condition`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as RoadTicket & { error?: string; detail?: string };
    if (!response.ok) throw new Error(payload.error || payload.detail || 'Could not create the road-condition ticket.');
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}
