// ═══════════════════════════════════════════════════════════════════════════
// mobile/supabase.js — cliente Supabase (autenticação)
//
// O Supabase cuida de login/cadastro/sessão. A sessão (access + refresh token)
// é persistida no AsyncStorage e renovada automaticamente pelo próprio SDK.
//
// COMO PREENCHER:
//   SUPABASE_URL      → Supabase → Settings → API → Project URL
//   SUPABASE_ANON_KEY → Supabase → Settings → API → Project API keys → anon public
//
// A "anon key" é PÚBLICA por design (vai no app cliente) — pode ficar aqui.
// NUNCA coloque a "service_role" key no app.
// ═══════════════════════════════════════════════════════════════════════════

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://oxhtpcilvtqvfbshgjfq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94aHRwY2lsdnRxdmZic2hnamZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDc0MzgsImV4cCI6MjA5NzAyMzQzOH0.izAMuG83H2Poyv7XzRPffrTfD5WRMgukSrYiozx4000';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // app nativo não usa fluxo de URL
  },
});

export default supabase;
