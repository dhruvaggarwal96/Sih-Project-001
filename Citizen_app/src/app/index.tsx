import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo, CrowdBadge, Notice, SectionTitle } from '@/components/transit-ui';
import { colors, nearbyBuses } from '@/constants/transit';

export default function HomeScreen() {
  const router = useRouter();
  const firstBus = nearbyBuses[0];

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <AppLogo />
            <View style={styles.profile}><Text style={styles.profileText}>A</Text></View>
          </View>

          <Text style={styles.greeting}>Good morning, Ananya</Text>
          <Text style={styles.location}>●  Near Central Station</Text>

          <Pressable style={styles.searchBox} onPress={() => router.push('/routes' as Href)}>
            <Text style={styles.searchIcon}>⌕</Text>
            <Text style={styles.searchText}>Where do you want to go?</Text>
            <Text style={styles.searchArrow}>›</Text>
          </Pressable>

          <SectionTitle title="Your nearest bus" action="Live map" onAction={() => router.push('/live-map' as Href)} />
          <View style={styles.nearestCard}>
            <View style={styles.cardTopRow}>
              <View style={[styles.busNumber, { backgroundColor: firstBus.color }]}>
                <Text style={styles.busNumberText}>{firstBus.number}</Text>
              </View>
              <View style={styles.busRoute}>
                <Text style={styles.routeName}>{firstBus.name}</Text>
                <Text style={styles.routeDirection}>{firstBus.direction}</Text>
              </View>
              <CrowdBadge crowd={firstBus.crowd} />
            </View>
            <View style={styles.divider} />
            <View style={styles.arrivalRow}>
              <View>
                <Text style={styles.arrivalLabel}>Arrives in</Text>
                <Text style={styles.arrivalTime}>{firstBus.arrival}</Text>
              </View>
              <View style={styles.liveStatus}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE · {firstBus.distance}</Text>
              </View>
            </View>
            <Pressable style={styles.trackButton} onPress={() => router.push('/live-map' as Href)}>
              <Text style={styles.trackButtonText}>Track this bus</Text>
              <Text style={styles.trackArrow}>→</Text>
            </Pressable>
          </View>

          <View style={styles.quickRow}>
            <Pressable style={styles.quickAction} onPress={() => router.push('/live-map' as Href)}>
              <Text style={styles.quickIcon}>⌖</Text><Text style={styles.quickText}>Live map</Text>
            </Pressable>
            <Pressable style={styles.quickAction} onPress={() => router.push('/routes' as Href)}>
              <Text style={styles.quickIcon}>↗</Text><Text style={styles.quickText}>Plan trip</Text>
            </Pressable>
            <Pressable style={styles.quickAction} onPress={() => router.push('/alerts' as Href)}>
              <Text style={styles.quickIcon}>◌</Text><Text style={styles.quickText}>Alerts</Text>
            </Pressable>
          </View>

          <SectionTitle title="Coming soon" action="See routes" onAction={() => router.push('/routes' as Href)} />
          <View style={styles.busList}>
            {nearbyBuses.slice(1).map((bus) => (
              <Pressable key={bus.id} style={styles.busListRow} onPress={() => router.push('/live-map' as Href)}>
                <View style={[styles.busListNumber, { backgroundColor: bus.color }]}><Text style={styles.busListNumberText}>{bus.number}</Text></View>
                <View style={styles.busListInfo}>
                  <Text style={styles.busListName}>{bus.name}</Text>
                  <Text style={styles.busListDetails}>{bus.direction} · {bus.stops} stops</Text>
                </View>
                <View style={styles.busListArrival}>
                  <Text style={styles.busListTime}>{bus.arrival}</Text>
                  <CrowdBadge crowd={bus.crowd} />
                </View>
              </Pressable>
            ))}
          </View>

          <SectionTitle title="Service status" />
          <Notice tone="green">All services are running. Route 41 has a small diversion near Market Road.</Notice>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 114 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  profile: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.orangePale, alignItems: 'center', justifyContent: 'center' },
  profileText: { color: colors.orange, fontSize: 16, fontWeight: '800' },
  greeting: { color: colors.ink, fontSize: 25, fontWeight: '800', letterSpacing: -0.5, marginTop: 27 },
  location: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 6 },
  searchBox: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 17, paddingHorizontal: 16, height: 58, marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 11 },
  searchIcon: { color: colors.blue, fontSize: 27, lineHeight: 27, fontWeight: '700' },
  searchText: { color: colors.muted, fontSize: 14, fontWeight: '700', flex: 1 },
  searchArrow: { color: colors.blue, fontSize: 26, lineHeight: 27 },
  nearestCard: { backgroundColor: '#FFFFFF', borderRadius: 21, padding: 17, shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  busNumber: { minWidth: 49, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  busNumberText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  busRoute: { flex: 1 },
  routeName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  routeDirection: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 3 },
  divider: { height: 1, backgroundColor: '#EAF0F5', marginVertical: 17 },
  arrivalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  arrivalLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  arrivalTime: { color: colors.ink, fontSize: 25, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  liveStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  liveText: { color: colors.green, fontSize: 11, fontWeight: '800' },
  trackButton: { backgroundColor: colors.blueDark, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 14, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  trackArrow: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  quickAction: { flex: 1, minHeight: 84, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 17, gap: 6 },
  quickIcon: { color: colors.blue, fontSize: 23, lineHeight: 24, fontWeight: '800' },
  quickText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  busList: { backgroundColor: '#FFFFFF', borderRadius: 19, overflow: 'hidden' },
  busListRow: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 11 },
  busListNumber: { minWidth: 42, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 6 },
  busListNumberText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  busListInfo: { flex: 1 },
  busListName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  busListDetails: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 3 },
  busListArrival: { alignItems: 'flex-end', gap: 5 },
  busListTime: { color: colors.ink, fontSize: 14, fontWeight: '800' },
});
