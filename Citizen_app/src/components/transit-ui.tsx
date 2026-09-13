import { type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, crowdColors, type CrowdLevel } from '@/constants/transit';

export function AppLogo() {
  return (
    <View style={styles.logoRow}>
      <View style={styles.logoMark}>
        <Text style={styles.logoMarkText}>T</Text>
      </View>
      <View>
        <Text style={styles.logoName}>Transit Saathi</Text>
        <Text style={styles.logoSubtext}>CITY BUS · LIVE</Text>
      </View>
    </View>
  );
}

export function CrowdBadge({ crowd }: { crowd: CrowdLevel }) {
  const tone = crowdColors(crowd);
  return (
    <View style={[styles.crowdBadge, { backgroundColor: tone.background }]}>
      <View style={[styles.crowdDot, { backgroundColor: tone.text }]} />
      <Text style={[styles.crowdText, { color: tone.text }]}>{crowd}</Text>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Notice({ children, tone = 'blue' }: PropsWithChildren<{ tone?: 'blue' | 'orange' | 'green' }>) {
  const toneStyles = {
    blue: { backgroundColor: colors.bluePale, borderColor: '#C4E1ED', color: colors.blueDark },
    orange: { backgroundColor: colors.orangePale, borderColor: '#F3D39A', color: '#9A5A02' },
    green: { backgroundColor: colors.greenPale, borderColor: '#BCE8DB', color: '#116552' },
  }[tone];

  return (
    <View style={[styles.notice, { backgroundColor: toneStyles.backgroundColor, borderColor: toneStyles.borderColor }]}>
      <Text style={[styles.noticeText, { color: toneStyles.color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  logoName: { color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  logoSubtext: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginTop: 1 },
  crowdBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  crowdDot: { width: 6, height: 6, borderRadius: 3 },
  crowdText: { fontSize: 12, fontWeight: '800' },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 13 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  sectionAction: { color: colors.blue, fontSize: 13, fontWeight: '800' },
  notice: { borderWidth: 1, borderRadius: 16, padding: 14 },
  noticeText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
});
