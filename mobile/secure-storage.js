import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Publish a small manifest only after every encrypted chunk has been written.
// Never fall back to plaintext if the native secure store fails.
let pending = Promise.resolve();
const serial = operation => {
  const result = pending.then(operation);
  pending = result.catch(() => {});
  return result;
};
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
async function manifest(key) {
  const raw = await SecureStore.getItemAsync(key, options);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!/^[\w-]+$/.test(value.id) || !Number.isInteger(value.count) || value.count < 1 || value.count > 160) throw new Error('Sessão local inválida.');
  return value;
}
async function removeChunks(key, previous) {
  if (!previous) return;
  await Promise.all(Array.from({length:previous.count}, (_,i) => SecureStore.deleteItemAsync(`${key}.${previous.id}.${i}`, options)));
}
async function write(key, value) {
  if (value.length > 64000) throw new Error('Sessão excedeu o limite de armazenamento seguro.');
  const previous = await manifest(key);
  const id = Crypto.randomUUID();
  const count = Math.max(1, Math.ceil(value.length / 400));
  for (let i = 0; i < count; i++) await SecureStore.setItemAsync(`${key}.${id}.${i}`, value.slice(i*400,(i+1)*400), options);
  await SecureStore.setItemAsync(key, JSON.stringify({id,count}), options);
  await AsyncStorage.removeItem(key);
  await removeChunks(key, previous);
}
export const secureStorage = {
  getItem: key => serial(async () => {
    let saved = await manifest(key);
    if (!saved) {
      const legacy = await AsyncStorage.getItem(key);
      if (!legacy) return null;
      await write(key, legacy);
      saved = await manifest(key);
    }
    const chunks = await Promise.all(Array.from({length:saved.count}, (_,i) => SecureStore.getItemAsync(`${key}.${saved.id}.${i}`, options)));
    if (chunks.some(chunk => chunk === null)) throw new Error('Sessão local incompleta.');
    return chunks.join('');
  }),
  setItem: (key,value) => serial(() => write(key,value)),
  removeItem: key => serial(async () => {
    const previous = await manifest(key).catch(() => null);
    await SecureStore.deleteItemAsync(key, options);
    await AsyncStorage.removeItem(key);
    await removeChunks(key, previous);
  }),
};
