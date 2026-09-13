import { Platform } from 'react-native';

type CitizenEventType =
  | 'trip_saved'
  | 'trip_started'
  | 'trip_removed'
  | 'bus_tracking'
  | 'alert_read'
  | 'preference_changed';

type CitizenEvent = {
  type: CitizenEventType;
  title: string;
  detail: string;
};

// Replace this local dashboard URL with the secured production transport API when it is available.
// For a physical Android phone, set EXPO_PUBLIC_TRANSIT_API_URL to http://YOUR_COMPUTER_IP:4000/api.
const dashboardApiUrl =
  process.env.EXPO_PUBLIC_TRANSIT_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api');

export async function syncCitizenEvent(event: CitizenEvent) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const response = await fetch(`${dashboardApiUrl}/citizen/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    // Offline use remains supported because the citizen's important preferences and trips are in SQLite.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
