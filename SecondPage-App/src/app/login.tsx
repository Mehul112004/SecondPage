import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, Redirect } from 'expo-router'
import { useAuth } from '../providers/AuthProvider'
import { Button, Loading, T, colors, styles } from '../components/ui'
import { configurationError } from '../lib/config'
export default function LoginScreen() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function submit() {
    if (pending) return
    setPending(true); setError('')
    try { await auth.signIn(email, password) }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not sign in.') }
    finally { setPending(false) }
  }
  if (!auth.ready) return <Loading />
  if (auth.session) return <Redirect href="/" />
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#e5edf9' }} edges={['top', 'bottom', 'left', 'right']}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
    <View style={{ padding: 28, paddingBottom: 34 }}><T style={styles.brand}>SecondPage<T style={{ color: colors.blue }}> ↗</T></T><T style={{ fontSize: 12, color: '#26446d', marginTop: 32 }}>Your private practice desk</T><T style={{ color: '#26446d', fontSize: 38, lineHeight: 46, fontWeight: '600', letterSpacing: -1.7, marginTop: 12 }}>Make room{ '\n' }for the next trade.</T><T style={{ color: '#44628b', fontSize: 13, lineHeight: 23, marginTop: 16 }}>Explore options. Build a process.{ '\n' }Keep the learning, leave the risk.</T></View>
    <View style={{ backgroundColor: colors.white, flex: 1, padding: 28, paddingTop: 32 }}><View style={{ maxWidth: 440, width: '100%', alignSelf: 'center' }}><T style={styles.small}>Access by invitation</T><T style={{ fontSize: 30, fontWeight: '600', letterSpacing: -0.8, marginVertical: 12 }}>Welcome back.</T><T style={styles.subtitle}>Sign in with the account created for you.</T>
      <View style={{ marginTop: 28, gap: 20 }}><View><T style={styles.label}>Email</T><TextInput accessibilityLabel="Email" autoComplete="email" textContentType="username" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} editable={!pending && !auth.demo && !configurationError} style={styles.input} /></View><View><T style={styles.label}>Password</T><TextInput accessibilityLabel="Password" secureTextEntry autoComplete="current-password" textContentType="password" value={password} onChangeText={setPassword} editable={!pending && !auth.demo && !configurationError} style={styles.input} onSubmitEditing={() => void submit()} returnKeyType="go" /></View>
        {(error || auth.error) ? <T accessibilityRole="alert" style={{ color: colors.red, lineHeight: 21 }}>{error || auth.error}</T> : null}
        <Button primary title={pending ? 'Signing in…' : 'Sign in'} onPress={() => void submit()} disabled={pending || auth.demo || !!configurationError} />
        {auth.demo && <><T style={styles.small}>Supabase isn’t connected yet.</T><Link href="/" style={{ color: colors.blue, fontSize: 13, paddingVertical: 12 }}>Explore the demo workspace →</Link></>}
      </View><T style={[styles.small, { marginTop: 24 }]}>Need access or a password reset? Contact the account owner.</T><T style={[styles.small, { marginTop: 20 }]}>Virtual capital. No real orders.</T>
    </View></View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>
}
