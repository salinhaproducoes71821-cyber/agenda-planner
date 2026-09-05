import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { validDate, validTime } from './dates';

let owner = null, generation = 0, initialized = false, pending = Promise.resolve();
const serial = work => {
  const result = pending.then(work);
  pending = result.catch(() => {});
  return result;
};
export function setNotificationSession(uid) {
  if (owner === uid && initialized) return pending;
  owner = uid; initialized = false; const revision = ++generation;
  return serial(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (revision === generation) initialized = true;
  });
}
export function cancelEventNotification(id) {
  const uid = owner;
  return serial(() => uid ? Notifications.cancelScheduledNotificationAsync(`${uid}:${id}`) : undefined);
}
export function reconcileNotifications(events, month) {
  const uid = owner, revision = generation;
  return serial(async () => {
    if (!uid || owner !== uid || generation !== revision) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.content.data?.userId === uid && (!month || item.content.data?.date?.startsWith(month))) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
    for (const event of events) {
      if (owner !== uid || generation !== revision) return;
      if (!event.lembrete || !validDate(event.data) || !validTime(event.hora)) continue;
      const [y,m,d] = event.data.split('-').map(Number), [h,min] = event.hora.split(':').map(Number);
      const date = new Date(y,m-1,d,h,min);
      if (date <= new Date()) continue;
      const sound = ['birds','piano','classic','vibrate'].includes(event.alarmSound) ? event.alarmSound : 'classic';
      await Notifications.scheduleNotificationAsync({
        identifier: `${uid}:${event.id}`,
        content: { title: event.titulo, body: `Agora • ${event.hora}`, sound: sound === 'vibrate' ? null : `${sound}.mp3`, data: {userId:uid,date:event.data} },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date,
          ...(Platform.OS === 'android' ? {channelId:`lembrete-${sound}`} : {}) },
      });
    }
  });
}
