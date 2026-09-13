import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { getActiveDriverProfile, loginDemo, logout as clearLogin } from '@/db/service';
import type { DriverProfile } from '@/types';

type DriverAppContextValue = {
  profile: DriverProfile | null;
  isLoading: boolean;
  error: string | null;
  login: (driverCode: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const DriverAppContext = createContext<DriverAppContextValue | null>(null);

export function DriverAppProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    setError(null);
    try {
      setProfile((await getActiveDriverProfile(db)) ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load driver information.');
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const value = useMemo<DriverAppContextValue>(
    () => ({
      profile,
      isLoading,
      error,
      refreshProfile,
      login: async (driverCode, password) => {
        await loginDemo(db, driverCode, password);
        await refreshProfile();
      },
      logout: async () => {
        await clearLogin(db);
        await refreshProfile();
      },
    }),
    [db, error, isLoading, profile, refreshProfile]
  );

  return <DriverAppContext.Provider value={value}>{children}</DriverAppContext.Provider>;
}

export function useDriverApp() {
  const context = useContext(DriverAppContext);
  if (!context) throw new Error('useDriverApp must be used inside DriverAppProvider.');
  return context;
}
