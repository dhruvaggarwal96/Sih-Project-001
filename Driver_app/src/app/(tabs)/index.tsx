import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton, Card, LoadingState, PageTitle, Screen, Stat, StatusPill, formatDateTime } from '@/components/driver-ui';
import { AppColors } from '@/constants/app-theme';
import { useDriverApp } from '@/context/driver-app-context';
import { getDashboardData, startShift, updateTripStatus } from '@/db/service';
import type { DashboardData, ShiftStatus } from '@/types';

const statusLabel: Record<ShiftStatus, string> = {
  not_started: 'Not started', active: 'Active', paused: 'Paused', ended: 'Ended',
};

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const { profile } = useDriverApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (profile) setData(await getDashboardData(db, profile.id));
  }, [db, profile]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!profile || !data) return <Screen scroll={false}><LoadingState label="Loading dashboard..." /></Screen>;
  const driver = profile;
  const dashboard = data;
  const status = dashboard.trip?.status ?? 'not_started';
  const tone = status === 'active' ? 'green' : status === 'paused' ? 'orange' : 'gray';

  async function changeShift(action: 'start' | 'pause' | 'resume' | 'end') {
    setBusy(true);
    try {
      if (action === 'start') await startShift(db, driver);
      else if (dashboard.trip) await updateTripStatus(db, dashboard.trip.id, action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'ended');
      await load();
    } catch {
      Alert.alert('Could not update shift', 'Please try again.');
    } finally { setBusy(false); }
  }

  return (
    <Screen>
      <PageTitle title={`Hello, ${driver.name.split(' ')[0]}`} subtitle={`Driver ID: ${driver.driver_code}`} />
      <Card>
        <View style={styles.routeTop}><View><Text style={styles.bus}>{driver.bus_number}</Text><Text style={styles.route}>Route {driver.route_number} · {driver.route_name}</Text></View><StatusPill label={statusLabel[status]} tone={tone} /></View>
        <Text style={styles.stops}>{driver.start_stop} → {driver.end_stop}</Text>
      </Card>
      <Card><Text style={styles.cardTitle}>Today’s shift</Text><View style={styles.stats}><Stat value={`${dashboard.totalDistanceKm.toFixed(1)} km`} label="Trip distance" /><View style={styles.divider} /><Stat value={String(dashboard.reportsToday)} label="Reports sent" /><View style={styles.divider} /><Stat value={dashboard.lastLocationAt ? 'Updated' : '—'} label={dashboard.lastLocationAt ? formatDateTime(dashboard.lastLocationAt).split(',')[1]?.trim() ?? 'Location' : 'Last location'} /></View></Card>
      <Card style={styles.actionCard}>
        <Text style={styles.cardTitle}>Shift controls</Text>
        {status === 'not_started' && <AppButton label="Start shift" onPress={() => changeShift('start')} loading={busy} />}
        {status === 'active' && <View style={styles.actionRow}><View style={styles.flex}><AppButton label="Pause shift" variant="outline" onPress={() => changeShift('pause')} disabled={busy} /></View><View style={styles.flex}><AppButton label="End shift" variant="danger" onPress={() => changeShift('end')} disabled={busy} /></View></View>}
        {status === 'paused' && <View style={styles.actionRow}><View style={styles.flex}><AppButton label="Resume shift" onPress={() => changeShift('resume')} loading={busy} /></View><View style={styles.flex}><AppButton label="End shift" variant="danger" onPress={() => changeShift('end')} disabled={busy} /></View></View>}
      </Card>
      <Card style={styles.info}><Text style={styles.infoTitle}>Offline ready</Text><Text style={styles.infoText}>Your trip points, reports, and inspections are safely saved on this phone. Pending items can be sent to the control room when cloud sync is added.</Text></Card>
    </Screen>
  );
}
const styles = StyleSheet.create({
  routeTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, bus: { color: AppColors.navy, fontWeight: '900', fontSize: 18 }, route: { color: AppColors.text, marginTop: 5, fontWeight: '700', fontSize: 13, maxWidth: 230 }, stops: { color: AppColors.muted, marginTop: 13, fontSize: 13, lineHeight: 19 }, cardTitle: { color: AppColors.navy, fontSize: 16, fontWeight: '800', marginBottom: 14 }, stats: { flexDirection: 'row', alignItems: 'stretch' }, divider: { width: 1, backgroundColor: AppColors.border, marginHorizontal: 9 }, actionCard: { gap: 4 }, actionRow: { flexDirection: 'row', gap: 10 }, flex: { flex: 1 }, info: { backgroundColor: AppColors.blueSoft, borderColor: '#CFE3F2', gap: 5 }, infoTitle: { color: AppColors.blue, fontWeight: '800', fontSize: 15 }, infoText: { color: AppColors.text, fontSize: 13, lineHeight: 19 },
});
