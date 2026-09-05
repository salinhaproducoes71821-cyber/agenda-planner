import 'react-native-url-polyfill/auto';
import { normalizeHttpsBase } from './api-url';

export const API_BASE = normalizeHttpsBase(process.env.EXPO_PUBLIC_API_URL || 'https://5iqcsa5wa7y3xb7eueqtapx5zm0tzrri.lambda-url.us-east-1.on.aws');
export const MUSIC_BASE = `${API_BASE}/music`;
