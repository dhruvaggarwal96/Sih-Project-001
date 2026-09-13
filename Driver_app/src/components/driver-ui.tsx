import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors } from '@/constants/app-theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const content = <View style={styles.screenContent}>{children}</View>;
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {scroll ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.pageHeading}>
      <Text style={styles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'muted';

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonStyles[variant],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !(disabled || loading) && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'muted' ? AppColors.navy : AppColors.white} />
      ) : (
        <Text style={[styles.buttonText, buttonTextStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

export function ChoicePills<T extends string>({
  values,
  selected,
  onChange,
  color = 'navy',
}: {
  values: readonly T[];
  selected: T;
  onChange: (value: T) => void;
  color?: 'navy' | 'green' | 'red';
}) {
  return (
    <View style={styles.pills}>
      {values.map((value) => {
        const isSelected = value === selected;
        return (
          <Pressable
            accessibilityRole="button"
            key={value}
            onPress={() => onChange(value)}
            style={({ pressed }) => [
              styles.pill,
              isSelected && pillStyles[color],
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>{value}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatusPill({ label, tone = 'green' }: { label: string; tone?: 'green' | 'orange' | 'red' | 'blue' | 'gray' }) {
  return (
    <View style={[styles.statusPill, statusPillStyles[tone]]}>
      <Text style={[styles.statusPillText, statusTextStyles[tone]]}>{label}</Text>
    </View>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </Card>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator color={AppColors.green} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function formatDateTime(value: string | null) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: AppColors.green },
  secondary: { backgroundColor: AppColors.navy },
  danger: { backgroundColor: AppColors.red },
  outline: { backgroundColor: AppColors.white, borderWidth: 1, borderColor: AppColors.navy },
  muted: { backgroundColor: AppColors.navySoft },
});

const buttonTextStyles = StyleSheet.create({
  primary: { color: AppColors.white },
  secondary: { color: AppColors.white },
  danger: { color: AppColors.white },
  outline: { color: AppColors.navy },
  muted: { color: AppColors.navy },
});

const pillStyles = StyleSheet.create({
  navy: { backgroundColor: AppColors.navy, borderColor: AppColors.navy },
  green: { backgroundColor: AppColors.green, borderColor: AppColors.green },
  red: { backgroundColor: AppColors.red, borderColor: AppColors.red },
});

const statusPillStyles = StyleSheet.create({
  green: { backgroundColor: AppColors.greenSoft },
  orange: { backgroundColor: AppColors.orangeSoft },
  red: { backgroundColor: AppColors.redSoft },
  blue: { backgroundColor: AppColors.blueSoft },
  gray: { backgroundColor: '#EEF2F6' },
});

const statusTextStyles = StyleSheet.create({
  green: { color: AppColors.green },
  orange: { color: AppColors.orange },
  red: { color: AppColors.red },
  blue: { color: AppColors.blue },
  gray: { color: AppColors.muted },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: AppColors.background },
  scrollContent: { paddingBottom: 118 },
  screenContent: { paddingHorizontal: 18, paddingTop: 14, gap: 14 },
  pageHeading: { gap: 4, marginBottom: 2 },
  pageTitle: { fontSize: 27, lineHeight: 33, fontWeight: '800', color: AppColors.navy },
  pageSubtitle: { fontSize: 14, lineHeight: 20, color: AppColors.muted },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 16,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: AppColors.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 },
  button: { minHeight: 50, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  fullWidth: { alignSelf: 'stretch' },
  buttonText: { fontSize: 16, fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
  fieldWrap: { gap: 7 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: AppColors.text },
  input: { minHeight: 48, borderWidth: 1, borderColor: AppColors.border, borderRadius: 10, paddingHorizontal: 13, backgroundColor: AppColors.white, color: AppColors.text, fontSize: 16 },
  multilineInput: { minHeight: 96, paddingTop: 12 },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { minHeight: 38, paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: AppColors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.white },
  pillText: { fontSize: 13, fontWeight: '700', color: AppColors.muted },
  pillTextSelected: { color: AppColors.white },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  stat: { flex: 1, gap: 3 },
  statValue: { fontSize: 21, lineHeight: 25, color: AppColors.navy, fontWeight: '800' },
  statLabel: { fontSize: 12, color: AppColors.muted, lineHeight: 16 },
  statHint: { fontSize: 11, color: AppColors.muted },
  emptyState: { alignItems: 'center', gap: 7, paddingVertical: 26 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: AppColors.navy },
  emptyText: { fontSize: 14, color: AppColors.muted, textAlign: 'center', lineHeight: 20 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 36 },
  loadingText: { color: AppColors.muted, fontSize: 15 },
});
