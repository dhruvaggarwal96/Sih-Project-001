import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo, Notice, SectionTitle } from '@/components/transit-ui';
import { colors, serviceAlerts } from '@/constants/transit';
import { getBooleanPreference, getReadAlertIds, markAlertRead, setBooleanPreference } from '@/database/transit-db';
import { syncCitizenEvent } from '@/services/dashboard-sync';

export default function AlertsScreen() {
  const db = useSQLiteContext();
  const [serviceUpdates, setServiceUpdates] = useState(true);
  const [crowdUpdates, setCrowdUpdates] = useState(true);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      getBooleanPreference(db, 'service_updates', true),
      getBooleanPreference(db, 'crowd_updates', true),
      getReadAlertIds(db),
    ]).then(([service, crowd, reads]) => {
      setServiceUpdates(service);
      setCrowdUpdates(crowd);
      setReadIds(reads);
    }).catch(() => undefined);
  }, [db]);

  async function changePreference(key: string, value: boolean, update: (value: boolean) => void) {
    update(value);
    try {
      await setBooleanPreference(db, key, value);
      void syncCitizenEvent({
        type: 'preference_changed',
        title: `Citizen ${value ? 'enabled' : 'disabled'} notifications`,
        detail: key === 'service_updates' ? 'Route and delay updates' : 'Crowd-level updates',
      });
    } catch {
      update(!value);
    }
  }

  async function readAlert(id: string) {
    if (!readIds.includes(id)) {
      setReadIds((ids) => [...ids, id]);
      try {
        await markAlertRead(db, id);
        const alert = serviceAlerts.find((item) => item.id === id);
        void syncCitizenEvent({
          type: 'alert_read',
          title: 'Citizen reviewed a travel alert',
          detail: alert?.type ?? 'Travel alert',
        });
      } catch {
        setReadIds((ids) => ids.filter((readId) => readId !== id));
      }
    }
  }

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}><AppLogo /><View style={styles.alertCount}><Text style={styles.alertCountText}>3</Text></View></View>
          <Text style={styles.title}>Travel alerts</Text>
          <Text style={styles.subtitle}>Important updates for your saved places and routes.</Text>

          <SectionTitle title="Latest updates" />
          <View style={styles.alertList}>
            {serviceAlerts.map((alert) => {
              const isRead = readIds.includes(alert.id);
              const tone = alert.tone === 'warning' ? { icon: '!', bg: colors.orangePale, text: colors.orange } : alert.tone === 'success' ? { icon: '✓', bg: colors.greenPale, text: colors.green } : { icon: 'i', bg: colors.bluePale, text: colors.blue };
              return (
                <Pressable key={alert.id} style={[styles.alertCard, isRead && styles.alertCardRead]} onPress={() => readAlert(alert.id)}>
                  <View style={[styles.alertIcon, { backgroundColor: tone.bg }]}><Text style={[styles.alertIconText, { color: tone.text }]}>{tone.icon}</Text></View>
                  <View style={styles.alertContent}><Text style={styles.alertType}>{alert.type}</Text><Text style={styles.alertTitle}>{alert.title}</Text><Text style={styles.alertDetail}>{alert.detail}</Text><Text style={styles.alertTime}>{isRead ? 'Read · ' : ''}{alert.time}</Text></View>
                </Pressable>
              );
            })}
          </View>

          <SectionTitle title="Your alert settings" />
          <View style={styles.settingsCard}>
            <SettingRow label="Route and delay updates" detail="For routes you have saved" value={serviceUpdates} onChange={(value) => changePreference('service_updates', value, setServiceUpdates)} />
            <View style={styles.settingDivider} />
            <SettingRow label="Crowd-level updates" detail="When your next bus is busy" value={crowdUpdates} onChange={(value) => changePreference('crowd_updates', value, setCrowdUpdates)} />
          </View>
          <Notice tone="blue">Your choices are saved securely on this device.</Notice>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SettingRow({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.settingRow}><View style={styles.settingText}><Text style={styles.settingLabel}>{label}</Text><Text style={styles.settingDetail}>{detail}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{ false: '#CAD6E0', true: '#8AC1D7' }} thumbColor={value ? colors.blueDark : '#FFFFFF'} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 112 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertCount: { minWidth: 29, height: 29, borderRadius: 15, backgroundColor: colors.redPale, alignItems: 'center', justifyContent: 'center' },
  alertCountText: { color: colors.red, fontSize: 13, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.6, marginTop: 27 },
  subtitle: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 6, lineHeight: 20 },
  alertList: { gap: 11 },
  alertCard: { backgroundColor: '#FFFFFF', borderRadius: 19, padding: 15, flexDirection: 'row', gap: 12, shadowColor: colors.ink, shadowOpacity: 0.04, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
  alertCardRead: { opacity: 0.62 },
  alertIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  alertIconText: { fontSize: 16, fontWeight: '900' },
  alertContent: { flex: 1 },
  alertType: { color: colors.muted, fontSize: 10, letterSpacing: 0.5, fontWeight: '900', textTransform: 'uppercase' },
  alertTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 4 },
  alertDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 5 },
  alertTime: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 8 },
  settingsCard: { backgroundColor: '#FFFFFF', borderRadius: 19, paddingHorizontal: 16, marginBottom: 15 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, gap: 10 },
  settingText: { flex: 1 },
  settingLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  settingDetail: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 4 },
  settingDivider: { height: 1, backgroundColor: '#EAF0F5' },
});
