import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const avatarKey = uid => `@ag_avatar_${uid}`;
export const getAvatar = uid => AsyncStorage.getItem(avatarKey(uid));
export async function saveAvatar(uid, uri) {
  if (!/^[0-9a-f-]{36}$/i.test(uid) || !uri.startsWith('file://')) throw new Error('Foto inválida.');
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory || info.size > 10 * 1024 * 1024) throw new Error('Foto deve ter até 10 MB.');
  const directory = `${FileSystem.documentDirectory}avatars/${uid}/`;
  await FileSystem.makeDirectoryAsync(directory, {intermediates:true});
  const target = `${directory}${Crypto.randomUUID()}.jpg`;
  await FileSystem.copyAsync({from:uri,to:target});
  await AsyncStorage.setItem(avatarKey(uid), target);
  return target;
}
