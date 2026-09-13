import * as Location from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton, Card, ChoicePills, PageTitle, Screen, StatusPill, formatDateTime } from '@/components/driver-ui';
import { AppColors } from '@/constants/app-theme';
import { useDriverApp } from '@/context/driver-app-context';
import { getLastLocation, getOpenTrip, markIssueReportSynced, saveIssueReport } from '@/db/service';
import { syncReport } from '@/services/transport-api';

const emergencyTypes = ['Accident', 'Medical Emergency', 'Threat/Safety Issue', 'Vehicle Failure'] as const;

export default function SosScreen() {
  const db = useSQLiteContext();
  const { profile } = useDriverApp();
  const [type, setType] = useState<(typeof emergencyTypes)[number]>('Accident');
  const [sending, setSending] = useState(false);
  const [recordedAt, setRecordedAt] = useState<string | null>(null);

  async function createEmergency() {
    if (!profile) return;
    setSending(true);
    try {
      let latitude: number | null = null; let longitude: number | null = null;
      try { const permission = await Location.requestForegroundPermissionsAsync(); if (permission.status === 'granted') { const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); latitude = point.coords.latitude; longitude = point.coords.longitude; } } catch { /* fall through to last local point */ }
      if (latitude === null) { const last = await getLastLocation(db, profile.id); latitude = last?.latitude ?? 28.6139; longitude = last?.longitude ?? 77.209; }
      const trip = await getOpenTrip(db, profile.id);
      const issueType = `Emergency: ${type}`;
      const reportId = await saveIssueReport(db, { driverId: profile.id, tripId: trip?.id, issueType, severity: 'Critical', description: 'Emergency SOS created by driver.', latitude, longitude, isEmergency: true });
      const synced = await syncReport({ busId: profile.bus_number, driverId: profile.driver_code, routeId: profile.route_number, issueType, severity: 'Critical', description: 'Emergency SOS created by driver.', latitude, longitude, isEmergency: true });
      if (synced) await markIssueReportSynced(db, reportId);
      setRecordedAt(new Date().toISOString());
    } catch { Alert.alert('Could not record SOS', 'Please try again or contact your control room by phone.'); }
    finally { setSending(false); }
  }
  function confirmSos() { Alert.alert('Send emergency SOS?', `Record a critical ${type} alert with your current location?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Send SOS', style: 'destructive', onPress: () => void createEmergency() }]); }

  return <Screen><PageTitle title="Emergency SOS" subtitle="Use only for urgent safety or vehicle emergencies." />
    <Card style={styles.warning}><Text style={styles.warningTitle}>For urgent help</Text><Text style={styles.warningText}>This demo records a critical alert locally. A future version will send it immediately to the government control room.</Text></Card>
    <Text style={styles.label}>Emergency type</Text><ChoicePills values={emergencyTypes} selected={type} onChange={setType} color="red" />
    <View style={styles.sosArea}><View style={styles.outer}><AppButton label={sending ? 'Recording alert...' : 'SOS'} onPress={confirmSos} variant="danger" loading={sending} /></View><Text style={styles.sosHint}>Tap SOS, then confirm the emergency type.</Text></View>
    {recordedAt && <Card style={styles.success}><StatusPill label="Emergency alert recorded" tone="green" /><Text style={styles.successText}>{type} · {formatDateTime(recordedAt)}</Text><Text style={styles.successText}>Location has been saved with this alert.</Text></Card>}
  </Screen>;
}
const styles = StyleSheet.create({ warning: { backgroundColor: AppColors.orangeSoft, borderColor: '#F4D39B', gap: 5 }, warningTitle: { color: AppColors.orange, fontWeight: '900', fontSize: 16 }, warningText: { color: AppColors.text, fontSize: 13, lineHeight: 19 }, label: { color: AppColors.text, fontWeight: '800', fontSize: 14, marginTop: 4 }, sosArea: { alignItems: 'center', gap: 15, paddingVertical: 22 }, outer: { width: 184, height: 184, borderRadius: 92, padding: 18, borderWidth: 12, borderColor: '#FBD7D7', justifyContent: 'center' }, sosHint: { color: AppColors.muted, fontSize: 13, textAlign: 'center' }, success: { backgroundColor: AppColors.greenSoft, borderColor: '#CBE7D8', gap: 7 }, successText: { color: AppColors.text, fontSize: 13 }, });
