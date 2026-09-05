export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://agenda-planner-production-392f.up.railway.app';
if (!API_BASE.startsWith('https://')) throw new Error('A API deve usar HTTPS.');
export const MUSIC_BASE = `${API_BASE}/music`;
