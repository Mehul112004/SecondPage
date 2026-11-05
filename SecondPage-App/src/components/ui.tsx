import type { PropsWithChildren, ReactNode } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type TextProps, type ViewStyle } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuth } from '../providers/AuthProvider'
import { useTrading } from '../providers/TradingProvider'

export const colors = { paper: '#f6f8fa', ink: '#192c3b', muted: '#73818b', line: '#e3e9ee', blue: '#275bb2', green: '#19765b', red: '#ba414b', paleBlue: '#edf2fc', white: '#ffffff' }
export function T({ style, ...props }: TextProps) { return <Text {...props} style={[styles.text, style]} /> }
export function Button({ title, onPress, disabled = false, primary = false, icon, style }: { title: string; onPress: () => void; disabled?: boolean; primary?: boolean; icon?: keyof typeof Ionicons.glyphMap; style?: ViewStyle }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, primary && styles.primary, pressed && !disabled && { opacity: 0.75 }, disabled && { opacity: 0.45 }, style]}>
    {icon && <Ionicons name={icon} size={17} color={primary ? colors.white : colors.blue} />}
    <T style={[styles.buttonText, primary && { color: colors.white }]}>{title}</T>
  </Pressable>
}
export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) { return <View style={[styles.card, style]}>{children}</View> }
export function Empty({ title, text }: { title: string; text: string }) { return <View style={styles.empty}><Ionicons name="bar-chart-outline" size={30} color="#91a9c6" /><T style={styles.emptyTitle}>{title}</T><T style={styles.emptyText}>{text}</T></View> }
export function Feedback() {
  const { error, message } = useTrading()
  return <>{error ? <View accessibilityRole="alert" style={[styles.feedback, { backgroundColor: '#fff0f0' }]}><T style={{ color: colors.red, lineHeight: 20 }}>{error}</T></View> : null}{message ? <View accessibilityLiveRegion="polite" style={[styles.feedback, { backgroundColor: '#eaf6f0' }]}><T style={{ color: colors.green, lineHeight: 20 }}>{message}</T></View> : null}</>
}
export function Screen({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) {
  const { demo, refreshing, refresh, busy } = useTrading()
  const { session, signOut } = useAuth()
  const { setError } = useTrading()
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <View style={styles.topbar}><Pressable accessibilityRole="link" accessibilityLabel="SecondPage practice desk" onPress={() => router.navigate('/')}><T style={styles.brand}>SecondPage<T style={{ color: colors.blue }}> ↗</T></T></Pressable><Button title={demo ? 'Sign in' : 'Sign out'} disabled={busy} onPress={() => {
      if (demo) router.push('/login')
      else void signOut().catch(issue => setError(issue instanceof Error ? issue.message : 'Could not sign out.'))
    }} /></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screenContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.blue} />}>
      <View style={{ gap: 8, marginBottom: 22 }}><T style={styles.title}>{title}</T><T style={styles.subtitle}>{subtitle}</T></View>
      {children}
      <View style={styles.footer}><T style={styles.small}>Practice with intention.</T><T style={styles.small}>{demo ? 'Synthetic data · Clears on reload' : `${session?.user.email || 'Private account'} · Upstox`}</T><T style={styles.small}>Long options only · No real orders</T></View>
    </ScrollView>
  </SafeAreaView>
}
export function Sheet({ visible, title, onClose, busy, children, footer }: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void; busy: boolean; footer?: ReactNode }>) {
  const insets = useSafeAreaInsets()
  return <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => { if (!busy) onClose() }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
      <Pressable accessibilityLabel="Dismiss dialog" accessibilityRole="button" disabled={busy} onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={[styles.sheet, { marginTop: insets.top + 16 }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.panelHeading}><T accessibilityRole="header" style={styles.sectionTitle}>{title}</T><Button title="Close" icon="close" onPress={onClose} disabled={busy} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 28 }}>{children}</ScrollView>
        {footer && <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View>}
      </View>
    </KeyboardAvoidingView>
  </Modal>
}
export function Loading() { return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, gap: 16 }}><ActivityIndicator color={colors.blue} /><T>Loading your workspace…</T></View> }
export const styles = StyleSheet.create({
  text: { fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'sans-serif', fontSize: 13, color: colors.ink },
  safe: { flex: 1, backgroundColor: colors.paper },
  topbar: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { fontWeight: '700', fontSize: 23, letterSpacing: -1 },
  screenContent: { padding: 16, paddingTop: 24, paddingBottom: 28, width: '100%', maxWidth: 940, alignSelf: 'center' },
  title: { fontSize: 28, letterSpacing: -1, fontWeight: '600' },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 21 },
  small: { fontSize: 11, color: colors.muted, lineHeight: 18 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 8, overflow: 'hidden', marginBottom: 18 },
  panelHeading: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: colors.line },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  button: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 5, borderWidth: 1, borderColor: '#dce3ed', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  buttonText: { fontSize: 12, color: '#536b82', fontWeight: '600' },
  primary: { backgroundColor: colors.blue, borderColor: colors.blue, minHeight: 48 },
  feedback: { padding: 14, borderRadius: 6, marginBottom: 16 },
  empty: { padding: 28, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyText: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  footer: { gap: 6, paddingTop: 12, alignItems: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#192c3b80' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '94%', width: '100%', maxWidth: 600, alignSelf: 'center', flexShrink: 1, overflow: 'hidden' },
  sheetHandle: { backgroundColor: '#c9d3dc', height: 4, width: 36, borderRadius: 4, marginTop: 10, alignSelf: 'center' },
  sheetFooter: { padding: 16, borderTopWidth: 1, borderTopColor: colors.line, gap: 12 },
  input: { borderWidth: 1, borderColor: '#d9e1e8', borderRadius: 5, padding: 12, minHeight: 48, fontSize: 16, color: colors.ink, backgroundColor: colors.white },
  label: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  number: { fontVariant: ['tabular-nums'] },
})
