import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { colors } from '@/constants/transit';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor="#FFFFFF"
      indicatorColor={colors.bluePale}
      iconColor={{ default: colors.muted, selected: colors.blueDark }}
      labelStyle={{ default: { color: colors.muted }, selected: { color: colors.blueDark } }}
      labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="live-map">
        <NativeTabs.Trigger.Label>Live map</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="routes">
        <NativeTabs.Trigger.Label>Routes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="alerts">
        <NativeTabs.Trigger.Label>Alerts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
