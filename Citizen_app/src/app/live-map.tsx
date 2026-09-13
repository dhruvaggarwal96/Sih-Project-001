import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo, CrowdBadge, Notice, SectionTitle } from '@/components/transit-ui';
import { colors, nearbyBuses, type Bus } from '@/constants/transit';
import { getBusTracking, setBusTracking } from '@/database/transit-db';
import { syncCitizenEvent } from '@/services/dashboard-sync';
import { getLiveBuses } from '@/services/transit-api';

export default function LiveMapScreen() {
  const db = useSQLiteContext();
  const [selectedBus, setSelectedBus] = useState(nearbyBuses[0]);
  const [tracking, setTracking] = useState(false);
  const [buses, setBuses] = useState<Bus[]>(nearbyBuses);
  const [usingLiveData, setUsingLiveData] = useState(false);

  useEffect(() => {
    let active = true;
    async function refreshBuses() {
      try {
        const liveBuses = await getLiveBuses();
        if (!active || liveBuses.length === 0) return;
        setBuses(liveBuses);
        setUsingLiveData(true);
        setSelectedBus((current) => liveBuses.find((bus) => bus.id === current.id) ?? liveBuses[0]);
      } catch {
        if (active) setUsingLiveData(false);
      }
    }
    void refreshBuses();
    const timer = setInterval(() => void refreshBuses(), 15_000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    getBusTracking(db, selectedBus.id).then(setTracking).catch(() => setTracking(false));
  }, [db, selectedBus.id]);

  async function toggleTracking() {
    const nextValue = !tracking;
    setTracking(nextValue);
    try {
      await setBusTracking(db, selectedBus.id, nextValue);
      void syncCitizenEvent({
        type: 'bus_tracking',
        title: `Bus ${selectedBus.number} tracking ${nextValue ? 'enabled' : 'disabled'}`,
        detail: `${selectedBus.name} · ${selectedBus.crowd} crowd level`,
      });
    } catch {
      setTracking(!nextValue);
    }
  }

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}><AppLogo /><Text style={styles.liveLabel}>● LIVE</Text></View>
          <Text style={styles.title}>Live bus map</Text>
          <Text style={styles.subtitle}>Buses near Central Station update every few seconds.</Text>

          <View style={styles.mapCard}>
            <View style={styles.mapTopRow}>
              <View style={styles.mapLegend}><View style={styles.legendDot} /><Text style={styles.mapLegendText}>{buses.length} buses reporting</Text></View>
              <Text style={styles.demoLabel}>{usingLiveData ? 'LIVE API' : 'DEMO FALLBACK'}</Text>
            </View>
            <View style={styles.mapArea}>
              <View style={[styles.road, styles.roadOne]} />
              <View style={[styles.road, styles.roadTwo]} />
              <View style={[styles.road, styles.roadThree]} />
              <View style={[styles.routeLine, { backgroundColor: selectedBus.color }]} />
              <View style={styles.station}><View style={styles.stationCore} /><Text style={styles.stationText}>Central{`\n`}Station</Text></View>
              {buses.slice(0, 3).map((bus, index) => <BusMarker key={bus.id} top={[66, 148, 201][index]} left={['66%', '37%', '76%'][index] as `${number}%`} bus={bus} active={selectedBus.id === bus.id} />)}
              <Text style={styles.mapLabelOne}>Park Street</Text><Text style={styles.mapLabelTwo}>Lake Road</Text><Text style={styles.mapLabelThree}>City Market</Text>
            </View>
          </View>

          <SectionTitle title="Buses around you" />
          <View style={styles.busList}>
            {buses.map((bus) => (
              <Pressable key={bus.id} style={[styles.busRow, selectedBus.id === bus.id && styles.busRowActive]} onPress={() => setSelectedBus(bus)}>
                <View style={[styles.busNumber, { backgroundColor: bus.color }]}><Text style={styles.busNumberText}>{bus.number}</Text></View>
                <View style={styles.busInfo}>
                  <Text style={styles.busName}>{bus.name}</Text>
                  <Text style={styles.busDirection}>{bus.direction} · {bus.stops} stops</Text>
                </View>
                <View style={styles.busRight}><Text style={styles.busArrival}>{bus.arrival}</Text><CrowdBadge crowd={bus.crowd} /></View>
              </Pressable>
            ))}
          </View>

          <View style={styles.selectedCard}>
            <View style={styles.selectedTopRow}>
              <View><Text style={styles.selectedEyebrow}>SELECTED BUS</Text><Text style={styles.selectedTitle}>Bus {selectedBus.number} · {selectedBus.name}</Text></View>
              <CrowdBadge crowd={selectedBus.crowd} />
            </View>
            <Text style={styles.selectedDetail}>It is {selectedBus.distance} and reaches Central Station in {selectedBus.arrival}.</Text>
            <Pressable style={[styles.followButton, tracking && styles.followButtonActive]} onPress={toggleTracking}>
              <Text style={styles.followButtonText}>{tracking ? 'Tracking is on ✓' : 'Notify me when it is near'}</Text>
            </Pressable>
          </View>

          <Notice tone={usingLiveData ? 'green' : 'blue'}>{usingLiveData ? 'Live bus data is connected to the shared transport server.' : 'Waiting for a driver GPS update. Showing sample positions until the server receives one.'}</Notice>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function BusMarker({ top, left, bus, active }: { top: number; left: `${number}%`; bus: Bus; active: boolean }) {
  return (
    <View style={[styles.busMarker, { top, left, borderColor: bus.color }, active && styles.busMarkerActive]}>
      <Text style={[styles.busMarkerText, { color: bus.color }]}>{bus.number}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 112 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  liveLabel: { color: colors.green, fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.6, marginTop: 26 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 6 },
  mapCard: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 22, marginTop: 21, shadowColor: colors.ink, shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  mapTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 5, paddingBottom: 12 },
  mapLegend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  mapLegendText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  demoLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  mapArea: { height: 275, overflow: 'hidden', borderRadius: 15, backgroundColor: '#E9F0EC', position: 'relative' },
  road: { position: 'absolute', height: 28, width: '145%', backgroundColor: '#FFFFFF', opacity: 0.95 },
  roadOne: { top: 40, left: -55, transform: [{ rotate: '-13deg' }] },
  roadTwo: { top: 134, left: -65, transform: [{ rotate: '24deg' }] },
  roadThree: { top: 212, left: -42, transform: [{ rotate: '-5deg' }] },
  routeLine: { position: 'absolute', width: 7, height: 270, left: '52%', top: 10, borderRadius: 8, transform: [{ rotate: '26deg' }], opacity: 0.86 },
  station: { position: 'absolute', top: 110, left: '45%', alignItems: 'center' },
  stationCore: { width: 20, height: 20, borderWidth: 5, borderColor: colors.blueDark, borderRadius: 12, backgroundColor: '#FFFFFF' },
  stationText: { color: colors.blueDark, fontSize: 10, fontWeight: '900', lineHeight: 12, textAlign: 'center', marginTop: 4 },
  busMarker: { position: 'absolute', minWidth: 38, height: 30, borderRadius: 10, borderWidth: 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  busMarkerActive: { transform: [{ scale: 1.13 }], shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 7, shadowOffset: { width: 0, height: 3 } },
  busMarkerText: { fontSize: 12, fontWeight: '900' },
  mapLabelOne: { position: 'absolute', top: 20, left: 18, color: colors.muted, fontSize: 10, fontWeight: '800' },
  mapLabelTwo: { position: 'absolute', top: 230, left: 23, color: colors.muted, fontSize: 10, fontWeight: '800' },
  mapLabelThree: { position: 'absolute', bottom: 22, right: 16, color: colors.muted, fontSize: 10, fontWeight: '800' },
  busList: { backgroundColor: '#FFFFFF', borderRadius: 19, overflow: 'hidden' },
  busRow: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 11, borderBottomColor: '#EDF2F7', borderBottomWidth: 1 },
  busRowActive: { backgroundColor: '#F2F8FA' },
  busNumber: { minWidth: 43, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  busNumberText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  busInfo: { flex: 1 },
  busName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  busDirection: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 3 },
  busRight: { alignItems: 'flex-end', gap: 5 },
  busArrival: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  selectedCard: { backgroundColor: colors.blueDark, borderRadius: 21, padding: 18, marginTop: 20 },
  selectedTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  selectedEyebrow: { color: '#B9D8E7', fontSize: 10, letterSpacing: 1, fontWeight: '900' },
  selectedTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 5 },
  selectedDetail: { color: '#DBECF4', fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 14 },
  followButton: { borderRadius: 12, backgroundColor: '#FFFFFF', paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  followButtonActive: { backgroundColor: '#CFF4E8' },
  followButtonText: { color: colors.blueDark, fontSize: 13, fontWeight: '900' },
});
