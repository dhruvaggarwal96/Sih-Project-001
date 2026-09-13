import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton, Card, ChoicePills, Field, LoadingState, PageTitle, Screen, SectionLabel, StatusPill } from '@/components/driver-ui';
import { AppColors } from '@/constants/app-theme';
import { useDriverApp } from '@/context/driver-app-context';
import { getLastLocation } from '@/db/service';
import { submitRoadCondition, type RoadTicket } from '@/services/transport-api';

const trafficLevels = ['Low', 'Medium', 'High'] as const;
const demoIssueTypes = ['pothole', 'garbage', 'flooding', 'road_blockage', 'accident'] as const;

type Photo = { uri: string; fileName: string | null; mimeType: string | null };

export default function RoadConditionScreen() {
  const db = useSQLiteContext();
  const { profile } = useDriverApp();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [trafficLevel, setTrafficLevel] = useState<(typeof trafficLevels)[number]>('Medium');
  const [nearSensitiveSite, setNearSensitiveSite] = useState(false);
  const [diameter, setDiameter] = useState('');
  const [demoIssueType, setDemoIssueType] = useState<(typeof demoIssueTypes)[number]>('pothole');
  const [sending, setSending] = useState(false);
  const [ticket, setTicket] = useState<RoadTicket | null>(null);

  async function useImage(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, fileName: asset.fileName ?? null, mimeType: asset.mimeType ?? null });
    setTicket(null);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Camera permission needed', 'Allow camera access to report a road issue with a photo.');
    try {
      await useImage(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 }));
    } catch {
      Alert.alert('Camera unavailable', 'Try selecting a road photo from the gallery.');
    }
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo permission needed', 'Allow photo access to select a road-condition image.');
    await useImage(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 }));
  }

  async function submit() {
    if (!profile || !photo) return Alert.alert('Road photo needed', 'Take or select a clear photo of the road issue first.');
    const manualDiameter = diameter.trim() ? Number(diameter) : null;
    if (manualDiameter !== null && (!Number.isFinite(manualDiameter) || manualDiameter <= 0 || manualDiameter > 500)) {
      return Alert.alert('Check diameter', 'Enter a pothole diameter from 1 to 500 cm, or leave it empty.');
    }

    setSending(true);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.granted) {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        }
      } catch { /* Use the last saved trip position below. */ }
      if (latitude === null || longitude === null) {
        const lastLocation = await getLastLocation(db, profile.id);
        latitude = lastLocation?.latitude ?? 28.6139;
        longitude = lastLocation?.longitude ?? 77.209;
      }
      const response = await submitRoadCondition({
        busId: profile.bus_number,
        driverId: profile.driver_code,
        routeId: profile.route_number,
        latitude,
        longitude,
        photoUri: photo.uri,
        photoName: photo.fileName,
        photoMimeType: photo.mimeType,
        trafficLevel,
        nearSensitiveSite,
        potholeDiameterCm: manualDiameter,
        demoIssueType,
      });
      setTicket(response);
      Alert.alert('Municipal ticket created', `${response.ticketId} was routed to ${response.municipality?.name ?? 'the review queue'}.`);
    } catch (error) {
      Alert.alert('Could not analyse photo', error instanceof Error ? error.message : 'Check the backend and road-model service, then try again.');
    } finally {
      setSending(false);
    }
  }

  if (!profile) return <Screen scroll={false}><LoadingState label="Loading road report..." /></Screen>;
  return <Screen><PageTitle title="Road-condition camera" subtitle="Photo + GPS creates a municipal maintenance ticket." />
    <Card style={styles.photoCard}>{photo ? <Image source={{ uri: photo.uri }} style={styles.image} /> : <View style={styles.photoEmpty}><Text style={styles.photoIcon}>◉</Text><Text style={styles.photoTitle}>Add a clear road photo</Text><Text style={styles.photoDetail}>Keep the pothole, garbage, flooding, or blockage in the frame.</Text></View>}
      <View style={styles.photoActions}><AppButton label="Take photo" onPress={takePhoto} variant="primary" /><AppButton label="Choose photo" onPress={pickPhoto} variant="outline" /></View></Card>
    <Card style={styles.form}><SectionLabel>Traffic level</SectionLabel><ChoicePills values={trafficLevels} selected={trafficLevel} onChange={setTrafficLevel} color={trafficLevel === 'High' ? 'red' : 'green'} />
      <Field label="Pothole diameter in cm (optional field measurement)" value={diameter} onChangeText={setDiameter} keyboardType="decimal-pad" placeholder="Example: 45" />
      <View style={styles.switchRow}><View><Text style={styles.switchTitle}>Near school, hospital, or crossing</Text><Text style={styles.switchDetail}>Adds safety priority to the municipal ticket.</Text></View><Switch value={nearSensitiveSite} onValueChange={setNearSensitiveSite} trackColor={{ false: AppColors.border, true: '#98CEB9' }} thumbColor={nearSensitiveSite ? AppColors.green : AppColors.white} /></View>
      <View style={styles.demo}><Text style={styles.demoTitle}>Demo fallback only</Text><Text style={styles.demoDetail}>Used only when Roboflow is not configured. It is clearly marked as demo, not AI.</Text><ChoicePills values={demoIssueTypes} selected={demoIssueType} onChange={setDemoIssueType} color="navy" /></View>
      <AppButton label="Analyse and create ticket" onPress={submit} loading={sending} disabled={!photo} /></Card>
    {ticket && <Card style={styles.ticket}><View style={styles.ticketTop}><View><Text style={styles.ticketId}>{ticket.ticketId}</Text><Text style={styles.ticketIssue}>{ticket.issueType}</Text></View><StatusPill label={`${ticket.priorityLevel} · ${ticket.priorityScore}/100`} tone={ticket.priorityLevel === 'Critical' ? 'red' : ticket.priorityLevel === 'High' ? 'orange' : 'green'} /></View>
      <Text style={styles.ticketText}>{ticket.confidence}% confidence · {ticket.potholeCount} pothole{ticket.potholeCount === 1 ? '' : 's'} found</Text>
      {ticket.estimatedDiameterCm ? <Text style={styles.ticketText}>Diameter: {ticket.estimatedDiameterCm} cm ({ticket.diameterSource})</Text> : <Text style={styles.ticketText}>Diameter: {ticket.diameterSource}</Text>}
      <Text style={styles.ticketText}>Ward {ticket.municipality?.wardNumber ?? 'review required'} · {ticket.municipality?.name ?? 'No ward boundary matched'}</Text>
      <Text style={styles.ticketNote}>{ticket.modelMode === 'demo' ? ticket.note : 'AI result and GPS were sent to the government dashboard.'}</Text></Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  photoCard: { gap: 12 }, image: { width: '100%', height: 205, borderRadius: 12, resizeMode: 'cover' }, photoEmpty: { minHeight: 180, borderRadius: 12, backgroundColor: AppColors.navySoft, borderWidth: 1, borderColor: '#D3E2ED', alignItems: 'center', justifyContent: 'center', padding: 22 }, photoIcon: { color: AppColors.blue, fontSize: 32, fontWeight: '900' }, photoTitle: { color: AppColors.navy, fontSize: 16, fontWeight: '900', marginTop: 7 }, photoDetail: { color: AppColors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 5 }, photoActions: { flexDirection: 'row', gap: 9 }, form: { gap: 14 }, switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, backgroundColor: AppColors.navySoft, padding: 12, borderRadius: 10 }, switchTitle: { color: AppColors.navy, fontWeight: '800', fontSize: 13 }, switchDetail: { color: AppColors.muted, fontSize: 12, marginTop: 3, maxWidth: 240 }, demo: { gap: 8, backgroundColor: AppColors.orangeSoft, borderRadius: 10, padding: 12 }, demoTitle: { color: AppColors.orange, fontWeight: '900', fontSize: 13 }, demoDetail: { color: AppColors.text, fontSize: 12, lineHeight: 17 }, ticket: { gap: 8, backgroundColor: AppColors.greenSoft, borderColor: '#CBE7D8' }, ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, ticketId: { color: AppColors.green, fontWeight: '900', fontSize: 14 }, ticketIssue: { color: AppColors.navy, fontWeight: '900', fontSize: 17, marginTop: 3 }, ticketText: { color: AppColors.text, fontSize: 12, lineHeight: 18 }, ticketNote: { color: AppColors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
