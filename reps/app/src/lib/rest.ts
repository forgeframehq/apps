// A phone notification when the rest timer ends, so it still reaches you with the screen off
// or another app open. Best effort: if notifications are unavailable or refused, the in-app timer still works.
import { Platform } from 'react-native';

let Notifications: typeof import('expo-notifications') | null = null;
let ready: Promise<boolean> | null = null;
let scheduled: string | null = null;

function setup(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(false);
  ready ??= (async () => {
    try {
      Notifications = require('expo-notifications');
      const N = Notifications!;
      // While the app is open the on-screen timer and a vibration are enough.
      N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }) });
      if (Platform.OS === 'android') {
        await N.setNotificationChannelAsync('rest', { name: 'Rest timer', importance: N.AndroidImportance.HIGH, vibrationPattern: [0, 300, 150, 300] });
      }
      let perm = await N.getPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) perm = await N.requestPermissionsAsync();
      return perm.granted;
    } catch {
      return false;
    }
  })();
  return ready;
}

export async function cancelRestAlert() {
  const id = scheduled;
  scheduled = null;
  if (id && Notifications) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export async function scheduleRestAlert(seconds: number, exerciseName: string) {
  await cancelRestAlert();
  if (seconds < 1 || !(await setup()) || !Notifications) return;
  try {
    scheduled = await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest over', body: `Next set: ${exerciseName}` },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds), channelId: 'rest' },
    });
  } catch {
    scheduled = null;
  }
}
