import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { type Href } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { colors } from '@/constants/transit';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="live-map" href={'/live-map' as Href} asChild>
            <TabButton>Live map</TabButton>
          </TabTrigger>
          <TabTrigger name="routes" href={'/routes' as Href} asChild>
            <TabButton>Routes</TabButton>
          </TabTrigger>
          <TabTrigger name="alerts" href={'/alerts' as Href} asChild>
            <TabButton>Alerts</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.tabButton, isFocused && styles.tabButtonFocused, pressed && styles.pressed]}>
      <Text style={[styles.tabButtonText, isFocused && styles.tabButtonTextFocused]}>{children}</Text>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    bottom: 0,
    zIndex: 2,
  },
  innerContainer: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#102A43',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 13,
  },
  tabButtonFocused: {
    backgroundColor: colors.bluePale,
  },
  tabButtonText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  tabButtonTextFocused: { color: colors.blueDark },
  pressed: { opacity: 0.72 },
});
