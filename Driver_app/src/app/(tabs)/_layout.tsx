import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { AppColors } from '@/constants/app-theme';

const tabIcon = (icon: string) => ({ color }: { color: ColorValue }) => (
  <Text style={{ color, fontSize: 17, fontWeight: '800' }}>{icon}</Text>
);

export default function DriverTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: AppColors.green,
        tabBarInactiveTintColor: AppColors.muted,
        tabBarStyle: { height: 68, paddingTop: 6, borderTopColor: AppColors.border, backgroundColor: AppColors.white },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', paddingBottom: 5 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('⌂') }} />
      <Tabs.Screen name="trip" options={{ title: 'Live trip', tabBarIcon: tabIcon('●') }} />
      <Tabs.Screen name="report" options={{ title: 'Report', tabBarIcon: tabIcon('!') }} />
      <Tabs.Screen name="sos" options={{ title: 'SOS', tabBarIcon: tabIcon('SOS') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: tabIcon('☰') }} />
    </Tabs>
  );
}
