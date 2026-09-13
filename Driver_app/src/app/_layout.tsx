import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { DriverAppProvider } from '@/context/driver-app-context';
import { migrateDbIfNeeded } from '@/db/migrations';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="urban-driver.db" onInit={migrateDbIfNeeded}>
      <DriverAppProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      </DriverAppProvider>
    </SQLiteProvider>
  );
}
