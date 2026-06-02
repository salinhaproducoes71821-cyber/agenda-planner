# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project structure

```
/mobile   — React Native / Expo app (run EAS builds from here)
/server   — Node.js / Express backend (deployed on Railway)
```

Each folder has its own `package.json` and `node_modules`. Run `npm install` inside each one separately.

## Commands

```bash
# Backend — run from /server
cd server
npm start          # production (node api.js)
npm run dev        # dev with auto-reload (nodemon)
npm test           # Jest

# Frontend — run from /mobile
cd mobile
npm run start:clear          # Expo dev server + QR code
npx expo start --tunnel      # if mobile can't reach local IP

# EAS Builds — run from /mobile
cd mobile
eas build --profile preview --platform android    # APK for testing
eas build --profile production --platform android # AAB for store
```

Before running the backend, copy `server/.env.example` → `server/.env` and fill in `MONGO_URI`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`. Generate secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Update the `API_BASE` constant in `mobile/api-service.js` with the machine's local IP when running locally (the mobile device can't resolve `localhost`).

## Architecture

### Backend (`server/api.js` + `server/database.js`)

**`api.js`** — Express REST API, all routes in one file:
- Auth routes (`/api/auth/*`): register, login, refresh, logout
- User routes (`/api/users/*`): profile update, avatar upload
- Event routes (`/api/events/*`): CRUD for calendar events
- Note routes (`/api/notes/*`): CRUD for notes
- Mood routes (`/api/moods/*`): mood tracking
- Static file serving at `/music` for lo-fi MP3s from `server/public/music/` (unauthenticated)
- Rate limiting: 100 req/15 min globally, 10 req/15 min on auth routes
- JWT: access tokens (15 min) + refresh tokens (7 days) with rotation on each refresh

**`database.js`** — Pluggable adapter pattern. `DB_TYPE=mongo` loads the Mongoose adapter; `DB_TYPE=mysql` loads Sequelize. Both expose an identical API so `api.js` never knows which is active. The MongoDB adapter is the default and primary target.

### Frontend (`mobile/App.js` + `mobile/api-service.js`)

**`App.js`** — The entire React Native app in a single ~3100-line file. No navigation library; navigation is a custom `NavContext` with a simple `screen` string state. All screens, components, and contexts live here.

Context providers (nested in `Root`):
- `ThemeProvider` — 10 built-in themes, 3 font families, 4 font sizes, 12 accent colors, high-contrast mode; persisted to AsyncStorage at `@ag_theme_prefs`
- `AuthProvider` — JWT token management, auto-refresh on 401, user profile
- `EventsProvider` — calendar events with local cache
- `MusicProvider` — lo-fi audio player via `expo-audio`, track queue, loop/prev/next
- `NavProvider` — current screen name

Screens:
- `AuthScreen` — login/register with password strength meter
- `CalendarScreen` — monthly calendar grid + event list
- `CronogramaScreen` — daily agenda/schedule view
- `NotasScreen` — notes with tags and search
- `HumorScreen` — mood tracking with emoji picker
- `MusicaScreen` — lo-fi player with sliders and track controls
- `ConfigScreen` — theme, font, alarm, and account settings

**`api-service.js`** — HTTP client used by the React Native app:
- Automatic token refresh on 401 (retries the original request)
- Offline queue: failed mutations are stored in AsyncStorage at `@ag_offline_queue` and replayed when connectivity returns
- Cached reads: GET responses are cached for immediate display while fetching fresh data

### Deployment

- Backend deployed on Railway at `https://agenda-planner-production.up.railway.app`
- Railway must use `/server` as the **Root Directory** in its settings
- `MUSIC_BASE` in `mobile/App.js` and `API_BASE` in `mobile/api-service.js` both point to the Railway URL in production
- Mobile app distributed via Expo Go (development) or EAS Build (production Android APK/AAB)
- EAS project ID: `7e187672-765e-4476-a72f-91aebcc549c2`, owner: `moonstarloves85`
