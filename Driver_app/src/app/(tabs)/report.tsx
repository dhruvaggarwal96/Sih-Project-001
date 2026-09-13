import * as Location from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, Card, ChoicePills, Field, PageTitle, Screen, SectionLabel } from '@/components/driver-ui';
import { AppColors } from '@/constants/app-theme';
import { useDriverApp } from '@/context/driver-app-context';
import { getLastLocation, getOpenTrip, markIssueReportSynced, saveIssueReport } from '@/db/service';
import { syncReport } from '@/services/transport-api';
import type { Coordinates, Severity } from '@/types';

const issueTypes = ['Traffic congestion', 'Accident', 'Road damage / pothole', 'Flooding / waterlogging', 'Roadwork', 'Bus breakdown', 'Vehicle overheating', 'Low fuel / low battery', 'Other issue'] as const;
const icons = ['≋', '!', '◌', '≈', '⊞', '⚠', '♨', '▱', '+'];
const severities: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

export default function ReportIssueScreen() {
  const db = useSQLiteContext();
  const { profile } = useDriverApp();
  const [issueType, setIssueType] = useState<(typeof issueTypes)[number] | null>(null);
  const [severity, setSeverity] = useState<Severity>('Medium');
  const [description, setDescription] = useState('');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationText, setLocationText] = useState('Location will be added when you submit.');
  const [submitting, setSubmitting] = useState(false);

  async function findLocation() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const point = { latitude: result.coords.latitude, longitude: result.coords.longitude };
        setCoordinates(point); setLocationText(`${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`); return point;
      }
    } catch { /* Use last saved point below. */ }
    if (profile) {
      const previous = await getLastLocation(db, profile.id);
      if (previous) { const point = { latitude: previous.latitude, longitude: previous.longitude }; setCoordinates(point); setLocationText(`Last saved: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`); return point; }
    }
    const point = { latitude: 28.6139, longitude: 77.209 };
    setCoordinates(point); setLocationText('Demo location used: 28.61390, 77.20900'); return point;
  }
  async function submit() {
    if (!profile || !issueType) { Alert.alert('Choose an issue', 'Select the issue you want to report.'); return; }
    setSubmitting(true);
    try {
      const point = coordinates ?? await findLocation();
      const trip = await getOpenTrip(db, profile.id);
      const reportId = await saveIssueReport(db, { driverId: profile.id, tripId: trip?.id, issueType, severity, description, latitude: point.latitude, longitude: point.longitude });
      const synced = await syncReport({ busId: profile.bus_number, driverId: profile.driver_code, routeId: profile.route_number, issueType, severity, description, latitude: point.latitude, longitude: point.longitude });
      if (synced) await markIssueReportSynced(db, reportId);
      Alert.alert(synced ? 'Report sent' : 'Report saved', synced ? 'The government dashboard received your report.' : 'Your report was saved on this phone and will sync when the server is available.');
      setIssueType(null); setDescription(''); setCoordinates(null); setLocationText('Location will be added when you submit.');
    } catch { Alert.alert('Could not save report', 'Please try again.'); }
    finally { setSubmitting(false); }
  }
  return <Screen><PageTitle title="Report an issue" subtitle="Send a clear report to help operations." />
    <SectionLabel>Select issue</SectionLabel><View style={styles.grid}>{issueTypes.map((item, index) => <Pressable key={item} onPress={() => setIssueType(item)} style={({ pressed }) => [styles.issueCard, issueType === item && styles.issueSelected, pressed && styles.pressed]}><Text style={styles.issueIcon}>{icons[index]}</Text><Text style={[styles.issueText, issueType === item && styles.issueTextSelected]}>{item}</Text></Pressable>)}</View>
    {issueType && <Card style={styles.form}><Text style={styles.selected}>Selected: {issueType}</Text><SectionLabel>Severity</SectionLabel><ChoicePills values={severities} selected={severity} onChange={setSeverity} color={severity === 'Critical' ? 'red' : 'navy'} /><Field label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Explain what you see" multiline /><View style={styles.locationBox}><View><Text style={styles.locationLabel}>Current location</Text><Text style={styles.locationText}>{locationText}</Text></View><Text onPress={() => void findLocation()} style={styles.refresh}>Refresh</Text></View><AppButton label="Submit report" onPress={submit} loading={submitting} /></Card>}
  </Screen>;
}
const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, issueCard: { width: '31%', minHeight: 100, borderRadius: 14, borderWidth: 1, borderColor: AppColors.border, backgroundColor: AppColors.white, padding: 10, justifyContent: 'space-between' }, issueSelected: { backgroundColor: AppColors.green, borderColor: AppColors.green }, pressed: { opacity: 0.75 }, issueIcon: { color: AppColors.green, fontWeight: '900', fontSize: 20 }, issueText: { color: AppColors.text, fontSize: 12, lineHeight: 16, fontWeight: '700' }, issueTextSelected: { color: AppColors.white }, form: { gap: 14 }, selected: { color: AppColors.green, backgroundColor: AppColors.greenSoft, fontWeight: '800', padding: 10, borderRadius: 9, fontSize: 13 }, locationBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: AppColors.navySoft, padding: 12, borderRadius: 10, gap: 8 }, locationLabel: { color: AppColors.navy, fontWeight: '800', fontSize: 13 }, locationText: { color: AppColors.muted, fontSize: 12, marginTop: 3, maxWidth: 245 }, refresh: { color: AppColors.blue, fontWeight: '800', fontSize: 13, padding: 6 }, });
