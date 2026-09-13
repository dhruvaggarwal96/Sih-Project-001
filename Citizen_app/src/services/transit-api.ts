import { Platform } from 'react-native';

import type { Bus, CrowdLevel } from '@/constants/transit';

const apiUrl =
  process.env.EXPO_PUBLIC_TRANSIT_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api');

type ApiBus = {
  busId: string;
  routeId: string | null;
  latitude: number | null;
  longitude: number | null;
  speedKmph: number | null;
  passengerCount: number | null;
  crowdLevel: string | null;
  healthStatus: string;
  status: string;
  lastSeenAt: string | null;
};

function crowdLevel(value: string | null): CrowdLevel {
  return value === 'High' ? 'High' : value === 'Low' ? 'Low' : 'Moderate';
}

function busColor(status: string, healthStatus: string) {
  if (status === 'Breakdown' || healthStatus === 'Critical') return '#DE5A55';
  if (healthStatus === 'Needs Attention') return '#F29A38';
  return '#208AEF';
}

export async function getLiveBuses(): Promise<Bus[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${apiUrl}/buses`, { signal: controller.signal });
    if (!response.ok) throw new Error('Live bus data could not be loaded.');
    const payload = (await response.json()) as { buses: ApiBus[] };

    return payload.buses.map((bus) => ({
      id: bus.busId,
      number: bus.routeId ?? bus.busId,
      name: `Route ${bus.routeId ?? 'not assigned'}`,
      direction: bus.status,
      arrival: bus.status === 'Breakdown' ? 'Service paused' : 'Live',
      distance: bus.speedKmph === null ? 'GPS update received' : `${Math.round(bus.speedKmph)} km/h`,
      crowd: crowdLevel(bus.crowdLevel),
      stops: bus.passengerCount ?? 0,
      color: busColor(bus.status, bus.healthStatus),
    }));
  } finally {
    clearTimeout(timeout);
  }
}
