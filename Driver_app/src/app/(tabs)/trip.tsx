import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton, Card, LoadingState, PageTitle, Screen, SectionLabel, StatusPill, formatDateTime } from '@/components/driver-ui';
import { AppColors } from '@/constants/app-theme';
import { useDriverApp } from '@/context/driver-app-context';
import { getLastLocation, getOpenTrip, markLocationSynced, recordLocation } from '@/db/service';
import { syncLocation } from '@/services/transport-api';
import type { Coordinates, LocationLog, Trip } from '@/types';

export default function LiveTripScreen() {
  const db = useSQLiteContext();
  const { profile } = useDriverApp();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [lastLocation, setLastLocation] = useState<LocationLog | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(false);
  const subscription = useRef<Location.LocationSubscription | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [currentTrip, last] = await Promise.all([getOpenTrip(db, profile.id), getLastLocation(db, profile.id)]);
    setTrip(currentTrip ?? null); setLastLocation(last ?? null);
  }, [db, profile]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => () => { subscription.current?.remove(); }, []);

  async function savePoint(point: Coordinates) {
    if (!trip) { Alert.alert('Start your shift first', 'Location points can be saved after your shift starts.'); return; }
    const locationId = await recordLocation(db, trip.id, point);
    const synced = await syncLocation({
      busId: profile!.bus_number,
      driverId: profile!.driver_code,
      routeId: profile!.route_number,
      latitude: point.latitude,
      longitude: point.longitude,
      speedKmph: point.speedKmph ?? null,
    });
    if (synced) await markLocationSynced(db, locationId);
    await load();
  }
  async function updateLocation() {
    if (!trip) { Alert.alert('Start your shift first', 'Go to Home and start the shift before tracking.'); return; }
    setBusy(true); setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') { setLocationError('Location permission was not allowed. Use simulation for this demo.'); return; }
      const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await savePoint({ latitude: point.coords.latitude, longitude: point.coords.longitude, speedKmph: point.coords.speed ? point.coords.speed * 3.6 : 0 });
    } catch { setLocationError('Could not get a GPS point. Check that phone location is on, or use simulation.'); }
    finally { setBusy(false); }
  }
  async function toggleTracking() {
    if (tracking) { subscription.current?.remove(); subscription.current = null; setTracking(false); return; }
    if (!trip || trip.status !== 'active') { Alert.alert('Active shift needed', 'Resume or start the shift before live tracking.'); return; }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') { setLocationError('Location permission was not allowed. Use simulation for this demo.'); return; }
    setLocationError(null);
    subscription.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 20000 }, (point) => {
      void savePoint({ latitude: point.coords.latitude, longitude: point.coords.longitude, speedKmph: point.coords.speed ? point.coords.speed * 3.6 : 0 });
    });
    setTracking(true);
  }
  async function simulateLocation() {
    const baseLatitude = lastLocation?.latitude ?? 28.6139;
    const baseLongitude = lastLocation?.longitude ?? 77.209;
    setBusy(true);
    try { await savePoint({ latitude: baseLatitude + 0.0007, longitude: baseLongitude + 0.0009, speedKmph: 26 }); setLocationError(null); }
    finally { setBusy(false); }
  }

  if (!profile) return <Screen scroll={false}><LoadingState label="Loading trip..." /></Screen>;
  return <Screen><PageTitle title="Live trip" subtitle={`${profile.bus_number} · Route ${profile.route_number}`} />
    <Card style={styles.statusCard}><View><Text style={styles.statusTitle}>Location tracking</Text><Text style={styles.statusText}>{trip ? tracking ? 'Live tracking is on.' : 'Ready to update your location.' : 'Start a shift on Home to save location points.'}</Text></View><StatusPill label={tracking ? 'Tracking' : trip?.status === 'paused' ? 'Paused' : trip ? 'Ready' : 'No shift'} tone={tracking ? 'green' : trip?.status === 'paused' ? 'orange' : 'gray'} /></Card>
    <Card><SectionLabel>Latest location</SectionLabel>{lastLocation ? <View style={styles.location}><Text style={styles.coordinates}>{lastLocation.latitude.toFixed(5)}, {lastLocation.longitude.toFixed(5)}</Text><Text style={styles.locationText}>Speed: {Math.round(lastLocation.speed_kmph ?? 0)} km/h</Text><Text style={styles.locationText}>Updated: {formatDateTime(lastLocation.recorded_at)}</Text></View> : <Text style={styles.noLocation}>No location saved for this shift yet.</Text>}</Card>
    {locationError && <Card style={styles.error}><Text style={styles.errorTitle}>GPS is unavailable</Text><Text style={styles.errorText}>{locationError}</Text><AppButton label="Save simulated location" variant="outline" onPress={simulateLocation} loading={busy} /></Card>}
    <View style={styles.buttons}><AppButton label="Update location now" onPress={updateLocation} loading={busy} disabled={!trip} /><AppButton label={tracking ? 'Stop location tracking' : 'Start location tracking'} variant={tracking ? 'danger' : 'outline'} onPress={toggleTracking} disabled={!trip || busy} /></View>
    <Card style={styles.note}><Text style={styles.noteTitle}>Works offline</Text><Text style={styles.noteText}>Every location point is stored on this phone with a pending sync status. This version tracks only while the app is open.</Text></Card>
  </Screen>;
}
const styles = StyleSheet.create({ statusCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, statusTitle: { color: AppColors.navy, fontSize: 16, fontWeight: '800' }, statusText: { color: AppColors.muted, fontSize: 13, marginTop: 5, maxWidth: 235, lineHeight: 18 }, location: { gap: 7, marginTop: 11 }, coordinates: { color: AppColors.navy, fontSize: 22, fontWeight: '900' }, locationText: { color: AppColors.muted, fontSize: 13 }, noLocation: { color: AppColors.muted, marginTop: 11, fontSize: 14 }, buttons: { gap: 10 }, error: { backgroundColor: AppColors.orangeSoft, borderColor: '#F6D5A3', gap: 8 }, errorTitle: { color: AppColors.orange, fontWeight: '900' }, errorText: { color: AppColors.text, fontSize: 13, lineHeight: 19 }, note: { backgroundColor: AppColors.navySoft, borderColor: '#D3E2ED', gap: 5 }, noteTitle: { color: AppColors.navy, fontWeight: '800' }, noteText: { color: AppColors.text, lineHeight: 19, fontSize: 13 }, });
