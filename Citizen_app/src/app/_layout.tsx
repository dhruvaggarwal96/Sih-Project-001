import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';

import AppTabs from '@/components/app-tabs';
import { migrateDbIfNeeded } from '@/database/transit-db';

export default function TabLayout() {
  return (
    <SQLiteProvider databaseName="transit-saathi.db" onInit={migrateDbIfNeeded}>
      <StatusBar style="dark" />
      <AppTabs />
    </SQLiteProvider>
  );
}
