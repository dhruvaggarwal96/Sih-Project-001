import { Redirect } from 'expo-router';

import { LoadingState, Screen } from '@/components/driver-ui';
import { useDriverApp } from '@/context/driver-app-context';

export default function IndexScreen() {
  const { profile, isLoading } = useDriverApp();
  if (isLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Preparing your driver app..." />
      </Screen>
    );
  }
  return <Redirect href={profile ? ('/(tabs)' as never) : '/login'} />;
}
