import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton, Card, Field, LoadingState, Screen } from '@/components/driver-ui';
import { AppColors } from '@/constants/app-theme';
import { useDriverApp } from '@/context/driver-app-context';

export default function LoginScreen() {
  const { profile, isLoading, login } = useDriverApp();
  const [driverCode, setDriverCode] = useState('DRV-101');
  const [password, setPassword] = useState('1234');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Loading offline data..." />
      </Screen>
    );
  }
  if (profile) return <Redirect href={'/(tabs)' as never} />;

  async function handleLogin() {
    setIsSubmitting(true);
    try {
      await login(driverCode, password);
    } catch (error) {
      Alert.alert('Could not log in', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        <View style={styles.brandWrap}>
          <View style={styles.logoCircle}><Text style={styles.logoText}>BUS</Text></View>
          <Text style={styles.appName}>Driver Connect</Text>
          <Text style={styles.tagline}>Public transport driver app</Text>
        </View>
        <Card style={styles.loginCard}>
          <Text style={styles.welcome}>Welcome, driver</Text>
          <Text style={styles.help}>Log in to start your shift and report important road or vehicle issues.</Text>
          <Field label="Driver ID" value={driverCode} onChangeText={setDriverCode} placeholder="Example: DRV-101" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter password" />
          <AppButton label="Log in" onPress={handleLogin} loading={isSubmitting} />
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Demo login</Text>
            <Text style={styles.demoText}>Driver ID: DRV-101   Password: 1234</Text>
          </View>
        </Card>
        <Text style={styles.privacy}>This app stores trip and vehicle data only for public transport operations.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 24, paddingBottom: 24 },
  brandWrap: { alignItems: 'center', gap: 5 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: AppColors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  logoText: { color: AppColors.white, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  appName: { color: AppColors.navy, fontSize: 29, fontWeight: '900' },
  tagline: { color: AppColors.muted, fontSize: 14 },
  loginCard: { gap: 16 },
  welcome: { fontSize: 20, fontWeight: '800', color: AppColors.navy },
  help: { color: AppColors.muted, fontSize: 14, lineHeight: 20, marginTop: -8 },
  demoBox: { backgroundColor: AppColors.navySoft, padding: 12, borderRadius: 10, gap: 3 },
  demoTitle: { color: AppColors.navy, fontSize: 13, fontWeight: '800' },
  demoText: { color: AppColors.navy, fontSize: 12 },
  privacy: { color: AppColors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18, paddingHorizontal: 14 },
});
