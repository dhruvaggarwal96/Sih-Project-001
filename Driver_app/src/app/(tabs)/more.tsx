import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, PageTitle, Screen, StatusPill } from '@/components/driver-ui';
import { AppColors } from '@/constants/app-theme';
import { useDriverApp } from '@/context/driver-app-context';

const items = [
  { title: 'Road-condition camera', detail: 'Photo + GPS AI ticket for the correct municipality', route: '/road-condition', icon: '◉' },
  { title: 'Vehicle inspection', detail: 'Check fuel, tyres, brakes, lights and faults', route: '/inspection', icon: '✓' },
  { title: 'Report history', detail: 'See submitted issues and sync status', route: '/history', icon: '≡' },
  { title: 'Profile & settings', detail: 'View assignment, privacy and log out', route: '/profile', icon: '●' },
];

export default function MoreScreen() {
  const { profile } = useDriverApp();
  return <Screen><PageTitle title="More" subtitle="Tools for your bus and shift" />
    {profile && <Card style={styles.vehicle}><View><Text style={styles.bus}>{profile.bus_number}</Text><Text style={styles.vehicleText}>{profile.vehicle_type} · {profile.fuel_or_battery_level}% {profile.fuel_type}</Text></View><StatusPill label={profile.health_status} tone={profile.health_status === 'Good' ? 'green' : profile.health_status === 'Critical' ? 'red' : 'orange'} /></Card>}
    <View style={styles.list}>{items.map((item) => <Pressable key={item.title} onPress={() => router.push(item.route as never)} style={({ pressed }) => pressed && styles.pressed}><Card style={styles.item}><View style={styles.icon}><Text style={styles.iconText}>{item.icon}</Text></View><View style={styles.copy}><Text style={styles.title}>{item.title}</Text><Text style={styles.detail}>{item.detail}</Text></View><Text style={styles.arrow}>›</Text></Card></Pressable>)}</View>
  </Screen>;
}
const styles = StyleSheet.create({ vehicle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, bus: { color: AppColors.navy, fontWeight: '900', fontSize: 18 }, vehicleText: { color: AppColors.muted, fontSize: 13, marginTop: 4 }, list: { gap: 10 }, item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 }, icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: AppColors.navySoft, alignItems: 'center', justifyContent: 'center' }, iconText: { color: AppColors.navy, fontWeight: '900' }, copy: { flex: 1, gap: 4 }, title: { color: AppColors.navy, fontWeight: '800', fontSize: 15 }, detail: { color: AppColors.muted, fontSize: 12, lineHeight: 17 }, arrow: { color: AppColors.green, fontSize: 30, lineHeight: 30, fontWeight: '400', paddingHorizontal: 4 }, pressed: { opacity: 0.78 }, });
