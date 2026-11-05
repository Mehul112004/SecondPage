import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications'

if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
})
export async function enableAlerts() {
  if (Platform.OS === 'web') throw Error('Device alerts are available in the iOS and Android app. In-app alerts remain available here.')
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('trades', { name: 'Position exits', importance: AndroidImportance.DEFAULT })
  const permission = await Notifications.requestPermissionsAsync()
  if (!permission.granted && permission.ios?.status !== IosAuthorizationStatus.PROVISIONAL) throw Error('Alerts were not enabled. You can allow notifications in your device settings.')
}
export async function notifyExit(id: string, message: string) {
  if (Platform.OS === 'web') return
  await Notifications.scheduleNotificationAsync({ identifier: id, content: { title: 'SecondPage · Position closed', body: message }, trigger: null })
}
