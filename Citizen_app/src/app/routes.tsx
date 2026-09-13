import { useEffect, useState } from 'react';
import { type Href, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo, CrowdBadge, Notice, SectionTitle } from '@/components/transit-ui';
import { colors, journeyOptions } from '@/constants/transit';
import { isTripSaved, removeTrip, saveTrip } from '@/database/transit-db';
import { syncCitizenEvent } from '@/services/dashboard-sync';

export default function RoutesScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [from, setFrom] = useState('Central Station');
  const [to, setTo] = useState('City Market');
  const [searched, setSearched] = useState(true);
  const [saved, setSaved] = useState(false);
  const [tripStarted, setTripStarted] = useState(false);

  useEffect(() => {
    isTripSaved(db, journeyOptions[0].id).then(setSaved).catch(() => setSaved(false));
  }, [db]);

  function searchRoutes() {
    setSearched(true);
    setTripStarted(false);
  }

  async function toggleSavedTrip() {
    const nextValue = !saved;
    setSaved(nextValue);
    try {
      if (nextValue) {
        await saveTrip(db, from, to, journeyOptions[0].id);
        void syncCitizenEvent({
          type: 'trip_saved',
          title: 'Citizen saved a bus trip',
          detail: `Route ${journeyOptions[0].id} · ${journeyOptions[0].label}`,
        });
      } else {
        await removeTrip(db, journeyOptions[0].id);
        void syncCitizenEvent({
          type: 'trip_removed',
          title: 'Citizen removed a saved trip',
          detail: `Route ${journeyOptions[0].id}`,
        });
      }
    } catch {
      setSaved(!nextValue);
    }
  }

  async function startTrip() {
    setTripStarted(true);
    setSaved(true);
    try {
      await saveTrip(db, from, to, journeyOptions[0].id, true);
      void syncCitizenEvent({
        type: 'trip_started',
        title: 'Citizen started a bus trip',
        detail: `Route ${journeyOptions[0].id} · ${journeyOptions[0].label}`,
      });
    } catch {
      setTripStarted(false);
    }
  }

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AppLogo />
          <Text style={styles.title}>Plan your trip</Text>
          <Text style={styles.subtitle}>Compare bus options before you leave.</Text>

          <View style={styles.searchPanel}>
            <View style={styles.routeLine} /><View style={styles.originDot} /><View style={styles.destinationDot} />
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>FROM</Text>
              <TextInput value={from} onChangeText={setFrom} style={styles.input} placeholder="Start location" placeholderTextColor={colors.muted} />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>TO</Text>
              <TextInput value={to} onChangeText={setTo} style={styles.input} placeholder="Destination" placeholderTextColor={colors.muted} />
            </View>
            <Pressable style={styles.searchButton} onPress={searchRoutes}><Text style={styles.searchButtonText}>Find buses</Text></Pressable>
          </View>

          {searched ? (
            <>
              <View style={styles.resultsHeader}>
                <SectionTitle title="Best options" />
                <Pressable onPress={toggleSavedTrip} hitSlop={8}>
                  <Text style={styles.saveText}>{saved ? '★ Saved' : '☆ Save trip'}</Text>
                </Pressable>
              </View>
              <View style={styles.routeOptions}>
                {journeyOptions.map((option, index) => (
                  <View key={option.id} style={[styles.routeCard, index === 0 && styles.routeCardPrimary]}>
                    <View style={styles.routeCardHeader}>
                      <View><Text style={[styles.optionLabel, index === 0 && styles.optionLabelPrimary]}>{option.label}</Text><Text style={[styles.duration, index === 0 && styles.durationPrimary]}>{option.duration}</Text></View>
                      <CrowdBadge crowd={option.crowd} />
                    </View>
                    <Text style={[styles.optionDetail, index === 0 && styles.optionDetailPrimary]}>{option.detail}</Text>
                    <View style={styles.optionFooter}><Text style={[styles.optionArrival, index === 0 && styles.optionArrivalPrimary]}>{option.arrival}</Text><View style={[styles.routeDot, { backgroundColor: option.accent }]} /></View>
                  </View>
                ))}
              </View>
              <Pressable style={[styles.startButton, tripStarted && styles.startButtonActive]} onPress={startTrip}>
                <Text style={styles.startButtonText}>{tripStarted ? 'Trip saved — alerts are on ✓' : 'Start this trip'}</Text>
              </Pressable>
              {tripStarted ? <Notice tone="green">We will notify you about the next bus, crowd level, and route changes.</Notice> : null}
              <Pressable style={styles.mapLink} onPress={() => router.push('/live-map' as Href)}><Text style={styles.mapLinkText}>See buses on the live map →</Text></Pressable>
            </>
          ) : null}

          <SectionTitle title="Helpful tip" />
          <Notice tone="blue">Choose the less crowded route when you have a flexible arrival time.</Notice>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 112 },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.6, marginTop: 27 },
  subtitle: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 6 },
  searchPanel: { backgroundColor: '#FFFFFF', borderRadius: 21, padding: 17, paddingLeft: 29, marginTop: 21, position: 'relative', shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  routeLine: { width: 2, backgroundColor: '#C9D6E1', height: 44, position: 'absolute', left: 20, top: 38 },
  originDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue, position: 'absolute', left: 16, top: 31 },
  destinationDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange, position: 'absolute', left: 16, top: 77 },
  fieldBlock: { minHeight: 47, justifyContent: 'center' },
  fieldLabel: { color: colors.muted, fontSize: 9, letterSpacing: 1, fontWeight: '900', marginBottom: 2 },
  input: { color: colors.ink, fontSize: 15, fontWeight: '800', padding: 0, height: 23 },
  fieldDivider: { backgroundColor: '#E6EDF3', height: 1, marginVertical: 6 },
  searchButton: { backgroundColor: colors.blueDark, borderRadius: 12, paddingVertical: 13, marginTop: 12, alignItems: 'center' },
  searchButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  saveText: { color: colors.blue, fontSize: 13, fontWeight: '900', marginBottom: 13 },
  routeOptions: { gap: 12 },
  routeCard: { backgroundColor: '#FFFFFF', borderRadius: 19, padding: 17, borderWidth: 1, borderColor: '#E5EDF3' },
  routeCardPrimary: { backgroundColor: colors.blueDark, borderColor: colors.blueDark },
  routeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  optionLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  optionLabelPrimary: { color: '#B9D8E7' },
  duration: { color: colors.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.5, marginTop: 3 },
  durationPrimary: { color: '#FFFFFF' },
  optionDetail: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 16 },
  optionDetailPrimary: { color: '#DAEAF2' },
  optionFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  optionArrival: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  optionArrivalPrimary: { color: '#B9D8E7' },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  startButton: { backgroundColor: colors.blue, borderRadius: 14, paddingVertical: 15, marginTop: 17, alignItems: 'center' },
  startButtonActive: { backgroundColor: colors.green },
  startButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  mapLink: { alignItems: 'center', paddingVertical: 18 },
  mapLinkText: { color: colors.blue, fontSize: 13, fontWeight: '900' },
});
