// ═══════════════════════════════════════════════════════════════════════════
// App.js — AGENDA APP v3.0
// Acessível · Seguro · Personalizável · Música Lo-Fi · Alarmes
//
// DEPENDÊNCIAS:
//   npm install @react-native-async-storage/async-storage
//   npm install react-native-vector-icons
//   npm install react-native-image-picker
//   npm install react-native-sound
//   npm install react-native-push-notification
//   npm install axios
//   cd ios && pod install
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  ScrollView, Modal, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar, Animated, Dimensions, Easing,
  TouchableWithoutFeedback, Image, Switch, AccessibilityInfo,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import api from './api-service';

// Exibe notificações mesmo com o app em primeiro plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const { width: SW } = Dimensions.get('window');

// ─── Acessibilidade global ──────────────────────────────────────────────────
const a11y = (label, hint) => ({
  accessible: true,
  accessibilityLabel: label,
  accessibilityHint: hint || undefined,
});

// ═══════════════════════════════════════════════════════════════════════════
// SISTEMA DE TEMAS EXPANDIDO — 10 paletas
// ═══════════════════════════════════════════════════════════════════════════

const THEMES = {
  slate:    { id:'slate',    name:'Ardósia',        description:'Cinza sofisticado moderno',   bg:'#111418', bg2:'#181c22', bg3:'#1e242c', bg4:'#252d38', border:'rgba(120,140,160,0.16)',border2:'rgba(120,140,160,0.28)',text:'#dde4ec', text2:'#8c9aaa', text3:'#525e6e', accent:'#58a6e0', accentBg:'rgba(88,166,224,0.14)',  success:'#4ec994', warn:'#e8b840', danger:'#e05858', lineColor:'rgba(120,140,160,0.10)'},
  classic:  { id:'classic',  name:'Clássico',       description:'Couro e papel envelhecido',   bg:'#1a1208', bg2:'#221809', bg3:'#2c200d', bg4:'#342712', border:'rgba(180,140,60,0.18)', border2:'rgba(180,140,60,0.32)', text:'#f0e6cc', text2:'#b8a47a', text3:'#7a6645', accent:'#c9923a', accentBg:'rgba(201,146,58,0.15)', success:'#7fb069', warn:'#d4a437', danger:'#c45c3a', lineColor:'rgba(180,140,60,0.12)' },
  ivory:    { id:'ivory',    name:'Marfim',         description:'Papel premium creme',         bg:'#f5f0e8', bg2:'#ede8dc', bg3:'#e3ddd0', bg4:'#d8d1c2', border:'rgba(100,80,40,0.15)',  border2:'rgba(100,80,40,0.28)',  text:'#2c2318', text2:'#6b5a3e', text3:'#9c8866', accent:'#7a4f1e', accentBg:'rgba(122,79,30,0.12)',   success:'#4a7c3f', warn:'#b8860b', danger:'#8b2e1a', lineColor:'rgba(100,80,40,0.10)'  },
  midnight: { id:'midnight', name:'Meia-noite',     description:'Veludo escuro elegante',      bg:'#0e0d16', bg2:'#141322', bg3:'#1a192c', bg4:'#201f36', border:'rgba(140,120,200,0.15)',border2:'rgba(140,120,200,0.28)',text:'#e8e4f4', text2:'#9b94c4', text3:'#5c5680', accent:'#9b7fe8', accentBg:'rgba(155,127,232,0.15)',success:'#5ab88a', warn:'#d4a437', danger:'#e05555', lineColor:'rgba(140,120,200,0.09)'},
  forest:   { id:'forest',   name:'Floresta',       description:'Verde musgo e madeira',       bg:'#0f1a10', bg2:'#152017', bg3:'#1b271d', bg4:'#223024', border:'rgba(100,160,80,0.16)', border2:'rgba(100,160,80,0.28)', text:'#e4edd8', text2:'#8ab475', text3:'#4d7040', accent:'#6db856', accentBg:'rgba(109,184,86,0.14)', success:'#6db856', warn:'#c8a840', danger:'#c0513e', lineColor:'rgba(100,160,80,0.09)'  },
  rose:     { id:'rose',     name:'Rosa Antigo',    description:'Delicado e refinado',         bg:'#1f1218', bg2:'#281820', bg3:'#321e28', bg4:'#3c2432', border:'rgba(200,120,140,0.16)',border2:'rgba(200,120,140,0.28)',text:'#f4e4ea', text2:'#c9909e', text3:'#7a5060', accent:'#e0728a', accentBg:'rgba(224,114,138,0.14)',success:'#78b870', warn:'#d4a437', danger:'#e05555', lineColor:'rgba(200,120,140,0.09)'},
  ocean:    { id:'ocean',    name:'Oceano',         description:'Azul profundo sereno',        bg:'#071520', bg2:'#0c1f30', bg3:'#102840', bg4:'#163250', border:'rgba(60,140,200,0.18)', border2:'rgba(60,140,200,0.32)', text:'#d8eef8', text2:'#7ab8d8', text3:'#3d6a88', accent:'#3ab5e8', accentBg:'rgba(58,181,232,0.14)',  success:'#4dcfa0', warn:'#f0c040', danger:'#e05060', lineColor:'rgba(60,140,200,0.11)' },
  sepia:    { id:'sepia',    name:'Sépia',          description:'Vintage caramelo quente',     bg:'#211508', bg2:'#2b1c0a', bg3:'#38240e', bg4:'#452d12', border:'rgba(200,150,80,0.18)', border2:'rgba(200,150,80,0.32)', text:'#f2ddb8', text2:'#c4975a', text3:'#7a5c30', accent:'#e8a030', accentBg:'rgba(232,160,48,0.14)',  success:'#80b858', warn:'#e8c030', danger:'#d04830', lineColor:'rgba(200,150,80,0.12)' },
  lavender: { id:'lavender', name:'Lavanda',        description:'Lilás suave e elegante',      bg:'#130f1e', bg2:'#1a1428', bg3:'#221a34', bg4:'#2c2240', border:'rgba(160,130,210,0.18)',border2:'rgba(160,130,210,0.32)',text:'#ece4f8', text2:'#b09cd8', text3:'#6a5890', accent:'#c890f0', accentBg:'rgba(200,144,240,0.14)',success:'#68c890', warn:'#e8b840', danger:'#e06080', lineColor:'rgba(160,130,210,0.10)'},
  nordic:   { id:'nordic',   name:'Nórdico',        description:'Branco neve e gelo',          bg:'#f0f4f8', bg2:'#e4eaf0', bg3:'#d8e0ea', bg4:'#ccd6e2', border:'rgba(80,100,130,0.15)', border2:'rgba(80,100,130,0.28)', text:'#1a2030', text2:'#4a5a72', text3:'#8090a8', accent:'#2860c0', accentBg:'rgba(40,96,192,0.12)',   success:'#2a8050', warn:'#c07010', danger:'#c02830', lineColor:'rgba(80,100,130,0.10)'  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FONTES EXPANDIDAS — 8 opções
// ═══════════════════════════════════════════════════════════════════════════

const FONT_FAMILIES = {
  serif:     { id:'serif',     label:'Serifada',      family:'serif',      sample:'Agenda Clássica' },
  sansserif: { id:'sansserif', label:'Sem serifa',    family:'sans-serif', sample:'Agenda Moderna'  },
  mono:      { id:'mono',      label:'Monospace',     family:'monospace',  sample:'Agenda Máquina'  },
};

const FONT_SIZES = {
  small:   { id:'small',   name:'Pequena',     base:13 },
  medium:  { id:'medium',  name:'Normal',      base:15 },
  large:   { id:'large',   name:'Grande',      base:17 },
  xlarge:  { id:'xlarge',  name:'Muito grande', base:20 },
};

const ACCENT_COLORS = [
  { id:'amber',    name:'Âmbar',    color:'#c9923a' },
  { id:'gold',     name:'Ouro',     color:'#d4a437' },
  { id:'copper',   name:'Cobre',    color:'#b5704e' },
  { id:'sage',     name:'Sálvia',   color:'#6db856' },
  { id:'violet',   name:'Violeta',  color:'#9b7fe8' },
  { id:'rose',     name:'Rosa',     color:'#e0728a' },
  { id:'sky',      name:'Céu',      color:'#4a9fd4' },
  { id:'teal',     name:'Teal',     color:'#3aaa8c' },
  { id:'crimson',  name:'Carmesim', color:'#c0303a' },
  { id:'indigo',   name:'Índigo',   color:'#4050c8' },
  { id:'mint',     name:'Hortelã',  color:'#38c8a8' },
  { id:'orange',   name:'Laranja',  color:'#e87030' },
];

// ═══════════════════════════════════════════════════════════════════════════
// MÚSICA LO-FI — URLs de streams públicos (substitua por seus assets)
// ═══════════════════════════════════════════════════════════════════════════

const MUSIC_BASE = 'https://agenda-planner-production.up.railway.app/music';

const LOFI_TRACKS = [
  { id:'lofi1', name:'lukrembo — rose',    icon:'moon',    bpm:'Lo-Fi', url:`${MUSIC_BASE}/rose.mp3`    },
  { id:'lofi2', name:'lukrembo — wine',    icon:'coffee',  bpm:'Lo-Fi', url:`${MUSIC_BASE}/wine.mp3`    },
  { id:'lofi3', name:'lukrembo — butter',  icon:'feather', bpm:'Lo-Fi', url:`${MUSIC_BASE}/butter.mp3`  },
  { id:'lofi4', name:'lukrembo — teapot',  icon:'coffee',  bpm:'Lo-Fi', url:`${MUSIC_BASE}/teapot.mp3`  },
  { id:'lofi5', name:'lukrembo — rudolph', icon:'tree',    bpm:'Lo-Fi', url:`${MUSIC_BASE}/rudolph.mp3` },
];

const ALARM_SOUNDS = [
  { id:'gentle',   name:'Suave',      icon:'bell',       description:'Acorda devagar' },
  { id:'birds',    name:'Pássaros',   icon:'feather',    description:'Sons da natureza' },
  { id:'piano',    name:'Piano',      icon:'music',      description:'Notas delicadas' },
  { id:'classic',  name:'Clássico',   icon:'clock',      description:'Tradicional' },
  { id:'vibrate',  name:'Vibração',   icon:'smartphone', description:'Apenas vibrar' },
];

// ═══════════════════════════════════════════════════════════════════════════
// ÍCONES — mapeamento para Ionicons (SVG via @expo/vector-icons)
// ═══════════════════════════════════════════════════════════════════════════

const ICON_MAP = {
  menu:         'menu',
  calendar:     'calendar-outline',
  schedule:     'time-outline',
  notes:        'document-text-outline',
  mood:         'happy-outline',
  settings:     'settings-outline',
  logout:       'log-out-outline',
  back:         'arrow-back-outline',
  add:          'add',
  edit:         'pencil-outline',
  delete:       'close-outline',
  bell:         'notifications-outline',
  bellOff:      'notifications-off-outline',
  check:        'checkmark',
  close:        'close',
  user:         'person-outline',
  lock:         'lock-closed-outline',
  mail:         'mail-outline',
  eye:          'eye-outline',
  eyeOff:       'eye-off-outline',
  music:        'musical-notes-outline',
  play:         'play',
  pause:        'pause',
  stop:         'stop-circle-outline',
  next:         'play-forward',
  prev:         'play-back',
  alarm:        'alarm-outline',
  photo:        'image-outline',
  palette:      'color-palette-outline',
  font:         'text-outline',
  search:       'search-outline',
  chevronRight: 'chevron-forward',
  star:         'star',
  info:         'information-circle-outline',
  shield:       'shield-outline',
  error:        'alert-circle-outline',
  feather:      'leaf-outline',
  clock:        'time-outline',
  smartphone:   'phone-portrait-outline',
  moon:         'moon-outline',
  tree:         'leaf-outline',
  train:        'train-outline',
  coffee:       'cafe-outline',
  repeat:       'repeat-outline',
};

function Icon({ name, size = 16, color, style }) {
  return (
    <Ionicons
      name={ICON_MAP[name] || 'ellipse-outline'}
      size={size}
      color={color}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// THEME CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const ThemeContext = createContext(null);

function ThemeProvider({ children }) {
  const [themeId,      setThemeId]      = useState('slate');
  const [fontFamily,   setFontFamily]   = useState('sansserif');
  const [fontSize,     setFontSize]     = useState('medium');
  const [accentId,     setAccentId]     = useState(null);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('@ag_theme_prefs');
        if (saved) {
          const p = JSON.parse(saved);
          if (p.themeId)      setThemeId(p.themeId);
          if (p.fontFamily)   setFontFamily(p.fontFamily);
          if (p.fontSize)     setFontSize(p.fontSize);
          if (p.accentId !== undefined) setAccentId(p.accentId);
          if (p.highContrast !== undefined) setHighContrast(p.highContrast);
        }
      } catch (e) {
        // silencia erro de leitura; usa padrões
      }
    })();
  }, []);

  const persist = useCallback(async (patch) => {
    try {
      const current = { themeId, fontFamily, fontSize, accentId, highContrast };
      await AsyncStorage.setItem('@ag_theme_prefs', JSON.stringify({ ...current, ...patch }));
    } catch (e) {
      // silencia erro de escrita
    }
  }, [themeId, fontFamily, fontSize, accentId, highContrast]);

  const setTheme  = (id) => { setThemeId(id);    persist({ themeId: id }); };
  const setFont   = (id) => { setFontFamily(id); persist({ fontFamily: id }); };
  const setSize   = (id) => { setFontSize(id);   persist({ fontSize: id }); };
  const setAccent = (id) => { setAccentId(id);   persist({ accentId: id }); };
  // CORREÇÃO: toggleHC usava closure stale — corrigido com callback funcional
  const toggleHC  = () => {
    setHighContrast(prev => {
      const next = !prev;
      persist({ highContrast: next });
      return next;
    });
  };

  const base         = THEMES[themeId] || THEMES.slate;
  const customAccent = accentId ? ACCENT_COLORS.find(a => a.id === accentId)?.color : null;
  const baseC        = customAccent ? { ...base, accent: customAccent, accentBg: customAccent + '22' } : base;
  const isDarkTheme  = parseInt(baseC.bg.slice(1, 3), 16) < 128;
  const C            = highContrast ? {
    ...baseC,
    text:    isDarkTheme ? '#ffffff' : '#000000',
    text2:   isDarkTheme ? '#e8e8e8' : '#111111',
    text3:   isDarkTheme ? '#b8b8b8' : '#444444',
    border:  isDarkTheme ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.28)',
    border2: isDarkTheme ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.50)',
  } : baseC;
  const fs           = FONT_SIZES[fontSize]?.base || 15;
  const ff           = FONT_FAMILIES[fontFamily]?.family || 'sans-serif';

  // Escala tipográfica acessível (mínimo 13px em qualquer configuração)
  const T = {
    xs:     { fontSize: Math.max(13, fs - 3), fontFamily: ff },
    sm:     { fontSize: Math.max(13, fs - 1), fontFamily: ff },
    base:   { fontSize: Math.max(14, fs),     fontFamily: ff },
    md:     { fontSize: Math.max(15, fs + 1), fontFamily: ff },
    lg:     { fontSize: Math.max(16, fs + 3), fontFamily: ff },
    xl:     { fontSize: Math.max(18, fs + 5), fontFamily: ff },
    '2xl':  { fontSize: Math.max(22, fs + 9), fontFamily: ff },
    '3xl':  { fontSize: Math.max(28, fs + 15), fontFamily: ff },
    label:  { fontSize: Math.max(12, fs - 3), fontFamily: ff, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
    h1:     { fontSize: Math.max(24, fs + 10), fontFamily: ff, fontWeight: '800' },
    h2:     { fontSize: Math.max(20, fs + 6),  fontFamily: ff, fontWeight: '700' },
    h3:     { fontSize: Math.max(16, fs + 2),  fontFamily: ff, fontWeight: '600' },
    body:   { fontSize: Math.max(15, fs),      fontFamily: ff, lineHeight: Math.max(22, fs * 1.6) },
    caption:{ fontSize: Math.max(12, fs - 3),  fontFamily: ff, lineHeight: Math.max(18, (fs - 2) * 1.5) },
  };

  return (
    <ThemeContext.Provider value={{ C, T, themeId, fontFamily, fontSize, accentId, highContrast, setTheme, setFont, setSize, setAccent, toggleHC }}>
      {children}
    </ThemeContext.Provider>
  );
}

const useTheme = () => useContext(ThemeContext);

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES E DADOS MOCK
// ═══════════════════════════════════════════════════════════════════════════

const MESES       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['D','S','T','Q','Q','S','S'];
const DIAS_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const HUMOR_LEVELS = [
  { nivel:1, humorIcon:'sad',                   label:'Péssimo', color:'#c45c3a' },
  { nivel:2, humorIcon:'sad-outline',           label:'Ruim',    color:'#d4a437' },
  { nivel:3, humorIcon:'remove-circle-outline', label:'Ok',      color:'#8892a4' },
  { nivel:4, humorIcon:'happy-outline',         label:'Bem',     color:'#7fb069' },
  { nivel:5, humorIcon:'happy',                 label:'Ótimo',   color:'#4f7fff' },
];

const EVENT_COLORS = ['#c9923a','#7fb069','#d4a437','#c45c3a','#9b7fe8','#e0728a','#4a9fd4','#3aaa8c'];
const TAG_COLORS   = ['#c9923a','#7fb069','#9b7fe8','#d4a437','#e0728a'];
const getTagColor  = (t) => TAG_COLORS[Math.abs(t.charCodeAt(0) + t.length) % TAG_COLORS.length];

const _hoje = new Date();
const _a    = _hoje.getFullYear();
const _m    = String(_hoje.getMonth() + 1).padStart(2, '0');

const mockEvents = [
  { id:1, titulo:'Reunião de equipe',    data:`${_a}-${_m}-12`, hora:'10:00', cor:'#c9923a', lembrete:true,  alarmSound:'gentle' },
  { id:2, titulo:'Dentista',             data:`${_a}-${_m}-15`, hora:'14:30', cor:'#d4a437', lembrete:true,  alarmSound:'birds'  },
  { id:3, titulo:'Academia',             data:`${_a}-${_m}-05`, hora:'07:00', cor:'#7fb069', lembrete:false, alarmSound:'piano'  },
  { id:4, titulo:'Happy Hour',           data:`${_a}-${_m}-22`, hora:'18:00', cor:'#9b7fe8', lembrete:false, alarmSound:'classic'},
  { id:5, titulo:'Apresentação projeto', data:`${_a}-${_m}-18`, hora:'09:00', cor:'#e0728a', lembrete:true,  alarmSound:'gentle' },
];

const mockNotas = [
  { id:1, titulo:'Lista de compras',      conteudo:'Pão, leite, ovos, frutas\nLimpar casa na sexta',          tags:['pessoal'],       updatedAt:`${_a}-${_m}-04` },
  { id:2, titulo:'Ideias para o projeto', conteudo:'Usar React Native\nZustand para estado\nSistema de temas', tags:['trabalho','dev'], updatedAt:`${_a}-${_m}-03` },
  { id:3, titulo:'Livros para ler',       conteudo:'1. Duna\n2. O Hobbit\n3. Sapiens',                         tags:['pessoal'],       updatedAt:`${_a}-${_m}-01` },
];

const mockHumor = (() => {
  const h = [];
  for (let i = 13; i >= 1; i--) {
    const d = new Date(_hoje);
    d.setDate(_hoje.getDate() - i);
    h.push({ data: d.toISOString().split('T')[0], nivel: Math.floor(Math.random() * 4) + 2 });
  }
  h.push({ data: _hoje.toISOString().split('T')[0], nivel: 0 });
  return h;
})();

// ═══════════════════════════════════════════════════════════════════════════
// VALIDAÇÕES DE SEGURANÇA
// ═══════════════════════════════════════════════════════════════════════════

const SECURITY = {
  // CORREÇÃO: regex de senha mantida, escapamento corrigido para evitar lint warnings
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]).{8,}$/,
  emailRegex:     /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  validatePassword(pwd) {
    const erros = [];
    if (pwd.length < 8)                         erros.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(pwd))                     erros.push('Uma letra maiúscula');
    if (!/[a-z]/.test(pwd))                     erros.push('Uma letra minúscula');
    if (!/\d/.test(pwd))                        erros.push('Um número');
    if (!/[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]/.test(pwd)) erros.push('Um caractere especial');
    return erros;
  },

  passwordStrength(pwd) {
    if (!pwd) return { level: 0, label: '', color: '' };
    const score = [
      pwd.length >= 8,
      /[A-Z]/.test(pwd),
      /[a-z]/.test(pwd),
      /\d/.test(pwd),
      /[!@#$%^&*]/.test(pwd),
      pwd.length >= 12,
    ].filter(Boolean).length;

    if (score <= 2) return { level: 1, label: 'Muito fraca', color: '#e05555' };
    if (score <= 3) return { level: 2, label: 'Fraca',       color: '#e8903a' };
    if (score <= 4) return { level: 3, label: 'Razoável',    color: '#d4a437' };
    if (score <= 5) return { level: 4, label: 'Forte',       color: '#7fb069' };
    return               { level: 5, label: 'Muito forte',   color: '#34c77b' };
  },

  // CORREÇÃO: sanitize expandido para cobrir mais caracteres perigosos
  sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>"'`]/g, '').trim();
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICAÇÕES — agenda/cancela lembretes locais
// ═══════════════════════════════════════════════════════════════════════════

async function scheduleEventNotification(event) {
  if (!event?.lembrete || event._offline) return;
  try {
    await cancelEventNotification(event.id);
    const [y, mo, d] = event.data.split('-').map(Number);
    const [h, m]     = event.hora.split(':').map(Number);
    const trigger    = new Date(y, mo - 1, d, h, m, 0);
    trigger.setMinutes(trigger.getMinutes() - 10);
    if (trigger <= new Date()) return; // já passou
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: event.titulo,
        body: `Em 10 minutos • ${event.hora}`,
        sound: event.alarmSound !== 'vibrate',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
        ...(Platform.OS === 'android' && { channelId: 'lembretes' }),
      },
    });
    const stored = JSON.parse(await AsyncStorage.getItem('@ag_notif_ids') || '{}');
    stored[String(event.id)] = notifId;
    await AsyncStorage.setItem('@ag_notif_ids', JSON.stringify(stored));
  } catch (_) {}
}

async function cancelEventNotification(eventId) {
  try {
    const stored = JSON.parse(await AsyncStorage.getItem('@ag_notif_ids') || '{}');
    const notifId = stored[String(eventId)];
    if (notifId) {
      await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
      delete stored[String(eventId)];
      await AsyncStorage.setItem('@ag_notif_ids', JSON.stringify(stored));
    }
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading,   setIsLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token   = await AsyncStorage.getItem('@ag_token');
        const userStr = await AsyncStorage.getItem('@ag_user');
        if (token && userStr) setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        // sessão corrompida — não bloqueia
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const saveSession = async (token, refresh, user) => {
    await AsyncStorage.setItem('@ag_token',   token);
    await AsyncStorage.setItem('@ag_refresh', refresh);
    await AsyncStorage.setItem('@ag_user',    JSON.stringify(user));
    setCurrentUser(user);
  };

  const login = async (email, password) => {
    const d = await api.login(email, password);
    await saveSession(d.accessToken, d.refreshToken, d.user);
  };

  const register = async (name, email, pwd, confirmPwd) => {
    const d = await api.register(name, email, pwd, confirmPwd);
    await saveSession(d.accessToken, d.refreshToken, d.user);
  };

  const logout = async () => {
    const refresh = await AsyncStorage.getItem('@ag_refresh');
    try { await api.logout(refresh); } catch (_) {}
    await AsyncStorage.multiRemove(['@ag_token', '@ag_refresh', '@ag_user']);
    setCurrentUser(null);
  };

  const updateAvatar = async (uri) => {
    const updated = await api.updateAvatar(uri);
    const u = { ...currentUser, avatar: updated.avatar };
    await AsyncStorage.setItem('@ag_user', JSON.stringify(u));
    setCurrentUser(u);
  };

  const updateProfile = async (name) => {
    const updated = await api.updateProfile(SECURITY.sanitize(name));
    const u = { ...currentUser, name: updated.name };
    await AsyncStorage.setItem('@ag_user', JSON.stringify(u));
    setCurrentUser(u);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, register, logout, updateAvatar, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
const useAuth = () => useContext(AuthContext);

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS CONTEXT — estado compartilhado entre Calendário e Cronograma
// ═══════════════════════════════════════════════════════════════════════════

const EventsContext = createContext(null);

function EventsProvider({ children }) {
  const [events,    setEvents]    = useState([]);
  const [isOffline, setIsOffline] = useState(false);

  const applyEvents = (data, mes) => {
    if (mes) {
      setEvents(prev => {
        const others = prev.filter(e => !e.data.startsWith(mes));
        return [...others, ...data];
      });
    } else {
      setEvents(data);
    }
  };

  const load = useCallback(async (mes) => {
    try {
      const data = await api.getEvents(mes);
      setIsOffline(false);
      applyEvents(data, mes);
      // Tenta sincronizar operações pendentes agora que estamos online
      api.flushQueue(() => load(mes)).catch(() => {});
    } catch (_) {
      setIsOffline(true);
      const cached = await api.getCachedEvents(mes);
      if (cached?.length) applyEvents(cached, mes);
    }
  }, []);

  const addEvent = async (payload) => {
    const ev = await api.createEvent(payload);
    setEvents(prev => [...prev, ev]);
    scheduleEventNotification(ev).catch(() => {});
    return ev;
  };

  const editEvent = async (id, payload) => {
    const ev = await api.updateEvent(id, payload);
    setEvents(prev => prev.map(e => e.id === id ? ev : e));
    cancelEventNotification(id).catch(() => {});
    scheduleEventNotification(ev).catch(() => {});
    return ev;
  };

  const removeEvent = async (id) => {
    await api.deleteEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    cancelEventNotification(id).catch(() => {});
  };

  return (
    <EventsContext.Provider value={{ events, load, addEvent, editEvent, removeEvent, isOffline }}>
      {children}
    </EventsContext.Provider>
  );
}
const useEvents = () => useContext(EventsContext);

// ═══════════════════════════════════════════════════════════════════════════
// MÚSICA CONTEXT — Player Lo-Fi
// ═══════════════════════════════════════════════════════════════════════════

const MusicContext = createContext(null);

function MusicProvider({ children }) {
  const [playing,      setPlaying]      = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [volume,       setVolume]       = useState(0.6);
  const [position,     setPosition]     = useState(0);
  const [duration,     setDuration]     = useState(0);
  const soundRef        = useRef(null);
  const seekTargetRef   = useRef(null);
  const genRef          = useRef(0);
  const currentTrackRef = useRef(null);
  const [looping,    setLooping]    = useState(false);
  const loopingRef = useRef(false);

  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { loopingRef.current = looping; }, [looping]);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true }).catch(() => {});
    AsyncStorage.getItem('@ag_music_volume').then(v => {
      if (v !== null) setVolume(parseFloat(v));
    }).catch(() => {});
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  useEffect(() => {
    soundRef.current?.setVolumeAsync(volume).catch(() => {});
    AsyncStorage.setItem('@ag_music_volume', String(volume)).catch(() => {});
  }, [volume]);

  const play = async (track) => {
    const gen = ++genRef.current;
    const prev = soundRef.current;
    soundRef.current = null;
    try {
      if (prev) await prev.unloadAsync().catch(() => {});
      if (gen !== genRef.current) return; // outra chamada de play() chegou, abandona
      setPosition(0); setDuration(0); seekTargetRef.current = null;
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.url },
        { shouldPlay: true, volume },
      );
      if (gen !== genRef.current) { sound.unloadAsync().catch(() => {}); return; }
      soundRef.current = sound;
      setCurrentTrack(track);
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate(s => {
        if (gen !== genRef.current) return; // callback de som antigo, ignora
        if (s.isLoaded) {
          if (seekTargetRef.current !== null) return; // seek em andamento, ignora todos os updates
          const pos = (s.positionMillis || 0) / 1000;
          setPosition(pos);
          if (s.durationMillis) setDuration(s.durationMillis / 1000);
        }
        if (s.didJustFinish) {
          setPlaying(false);
          setPosition(0);
          if (loopingRef.current) {
            soundRef.current?.setPositionAsync(0)
              .then(() => soundRef.current?.playAsync())
              .then(() => setPlaying(true))
              .catch(() => {});
          } else {
            const cur = currentTrackRef.current;
            if (cur) {
              const idx = LOFI_TRACKS.findIndex(t => t.id === cur.id);
              play(LOFI_TRACKS[(idx + 1) % LOFI_TRACKS.length]);
            }
          }
        }
      });
    } catch (_) {
      if (gen === genRef.current) Alert.alert('Erro', 'Não foi possível reproduzir esta faixa.');
    }
  };

  const pause  = async () => { await soundRef.current?.pauseAsync().catch(() => {}); setPlaying(false); };
  const resume = async () => { await soundRef.current?.playAsync().catch(() => {});  setPlaying(true);  };
  const stop   = async () => {
    genRef.current++; // invalida qualquer play() em andamento
    const prev = soundRef.current;
    soundRef.current = null; seekTargetRef.current = null;
    if (prev) { await prev.stopAsync().catch(() => {}); await prev.unloadAsync().catch(() => {}); }
    setPlaying(false); setCurrentTrack(null); setPosition(0); setDuration(0);
  };
  const seekTo = async (secs) => {
    try {
      seekTargetRef.current = secs;
      await soundRef.current?.setPositionAsync(Math.round(secs * 1000));
      seekTargetRef.current = null;
      setPosition(secs);
    } catch (_) { seekTargetRef.current = null; }
  };

  const next = async () => {
    if (!currentTrackRef.current) return;
    const idx = LOFI_TRACKS.findIndex(t => t.id === currentTrackRef.current.id);
    await play(LOFI_TRACKS[(idx + 1) % LOFI_TRACKS.length]);
  };

  const prev = async () => {
    if (!currentTrackRef.current) return;
    if (position > 3) { await seekTo(0); return; }
    const idx = LOFI_TRACKS.findIndex(t => t.id === currentTrackRef.current.id);
    await play(LOFI_TRACKS[(idx - 1 + LOFI_TRACKS.length) % LOFI_TRACKS.length]);
  };

  return (
    <MusicContext.Provider value={{ playing, currentTrack, volume, setVolume, play, pause, resume, stop, next, prev, looping, setLooping, position, duration, seekTo }}>
      {children}
    </MusicContext.Provider>
  );
}
const useMusic = () => useContext(MusicContext);

// ═══════════════════════════════════════════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

const NavContext = createContext(null);
function NavProvider({ children }) {
  const [screen, setScreen] = useState('Calendario');
  return (
    <NavContext.Provider value={{ screen, navigate: setScreen }}>
      {children}
    </NavContext.Provider>
  );
}
const useNav = () => useContext(NavContext);

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES BASE ACESSÍVEIS
// ═══════════════════════════════════════════════════════════════════════════

function Ornament({ style }) {
  const { C } = useTheme();
  return (
    <View style={[{ flexDirection:'row', alignItems:'center', gap:6 }, style]}>
      <View style={{ flex:1, height:1, backgroundColor:C.border2 }}/>
      <Ionicons name="star-outline" size={10} color={C.text3} accessibilityElementsHidden importantForAccessibility="no"/>
      <View style={{ flex:1, height:1, backgroundColor:C.border2 }}/>
    </View>
  );
}

// Botão acessível com tamanho mínimo de toque 44x44pt (WCAG 2.5.5)
function Btn({ onPress, style, children, label, hint, disabled, variant = 'default' }) {
  const { C } = useTheme();
  const bg = variant === 'primary' ? C.accent
           : variant === 'danger'  ? C.danger
           : variant === 'ghost'   ? 'transparent'
           : C.bg3;
  return (
    <TouchableOpacity
      style={[{
        minHeight: 48,
        minWidth:  48,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        opacity: disabled ? 0.5 : 1,
        borderWidth: variant === 'ghost' ? 1 : 0,
        borderColor: C.border2,
      }, style]}
      onPress={onPress}
      disabled={disabled}
      {...a11y(label || '', hint)}
    >
      {children}
    </TouchableOpacity>
  );
}

// Input acessível
function Input({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, error, hint, right, ...props }) {
  const { C, T } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[T.label, { color: C.text3 }]}>{label}</Text> : null}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.bg3,
        borderWidth: 1.5,
        borderColor: error ? C.danger : focused ? C.accent : C.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        minHeight: 52,
      }}>
        <TextInput
          style={[T.base, { flex:1, color: C.text, paddingVertical: 0 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.text3}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'none'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          accessibilityHint={hint}
          // CORREÇÃO: autoCorrect desabilitado em campos de senha por segurança
          autoCorrect={secureTextEntry ? false : props.autoCorrect}
          {...props}
        />
        {right}
      </View>
      {error ? (
        <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <Icon name="error" size={12} color={C.danger}/>
          <Text style={[T.caption, { color: C.danger }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Barra de força da senha
function PasswordStrengthBar({ password }) {
  const { C, T } = useTheme();
  const strength = SECURITY.passwordStrength(password);
  if (!password) return null;
  // CORREÇÃO: validatePassword chamado uma vez só em vez de duas
  const requisitos = SECURITY.validatePassword(password);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection:'row', gap:4 }}>
        {[1,2,3,4,5].map(i => (
          <View key={i} style={{
            flex:1, height:4, borderRadius:2,
            backgroundColor: i <= strength.level ? strength.color : C.bg4,
          }}/>
        ))}
      </View>
      <Text style={[T.caption, { color: strength.color, fontWeight:'600' }]}>
        {strength.label}
      </Text>
      {requisitos.length > 0 && (
        <View style={{ gap:3 }}>
          {requisitos.map((req, i) => (
            <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
              <Text style={{ fontSize:10, color:C.warn }}>• </Text>
              <Text style={[T.caption, { color:C.text3 }]}>{req}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MINI PLAYER DE MÚSICA — aparece em todas as telas
// ═══════════════════════════════════════════════════════════════════════════

function MiniPlayer() {
  const { C, T } = useTheme();
  const { playing, currentTrack, pause, resume, next, prev, position, duration } = useMusic();
  const insets = useSafeAreaInsets();
  if (!currentTrack) return null;
  const miniBottom = 16 + insets.bottom;
  const fmtTime = (secs) => {
    const s = Math.floor(secs);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const progressRatio = duration > 0 ? Math.min(1, position / duration) : 0;
  return (
    <View style={{
      position: 'absolute',
      bottom: miniBottom, left: 16, right: 16,
      backgroundColor: C.bg2,
      borderRadius: 14,
      borderWidth: 1, borderColor: C.border2,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      shadowColor: '#000',
      shadowOffset: { width:0, height:4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
      gap: 12,
      zIndex: 50,
      overflow: 'hidden',
    }}
    {...a11y('Player de música', 'Controles da música lo-fi')}
    >
      {/* Barra de progresso na base do card */}
      <View style={{
        position:'absolute', bottom:0, left:0, right:0, height:2,
        backgroundColor:'rgba(128,128,128,0.15)',
        borderBottomLeftRadius:14, borderBottomRightRadius:14,
      }}>
        <View style={{
          width:`${Math.round(progressRatio * 100)}%`,
          height:'100%',
          backgroundColor: C.accent,
          borderBottomLeftRadius:14,
        }}/>
      </View>

      {/* Ícone */}
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: C.accentBg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="music" size={16} color={C.accent}/>
      </View>

      {/* Nome + tempo */}
      <View style={{ flex: 1 }}>
        <Text style={[T.sm, { color: C.text, fontWeight:'700' }]} numberOfLines={1}>{currentTrack.name}</Text>
        <Text style={[T.xs, { color: C.text3, marginTop:1 }]}>
          {duration > 0 ? `${fmtTime(position)} / ${fmtTime(duration)}` : `${currentTrack.bpm} · Lo-Fi`}
        </Text>
      </View>

      {/* Prev */}
      <TouchableOpacity onPress={prev} style={{ padding:8, minWidth:36, minHeight:36, alignItems:'center', justifyContent:'center' }} {...a11y('Faixa anterior')}>
        <Icon name="prev" size={16} color={C.text2}/>
      </TouchableOpacity>

      {/* Play / Pause */}
      <TouchableOpacity onPress={playing ? pause : resume} style={{ padding:8, minWidth:36, minHeight:36, alignItems:'center', justifyContent:'center' }} {...a11y(playing ? 'Pausar' : 'Retomar')}>
        <Icon name={playing ? 'pause' : 'play'} size={18} color={C.accent}/>
      </TouchableOpacity>

      {/* Next */}
      <TouchableOpacity onPress={next} style={{ padding:8, minWidth:36, minHeight:36, alignItems:'center', justifyContent:'center' }} {...a11y('Próxima faixa')}>
        <Icon name="next" size={16} color={C.text2}/>
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════════════════════════

function TopBar({ onMenuPress, title, subtitle, right }) {
  const { C, T } = useTheme();
  // Aplica apenas o inset superior manualmente para evitar que SafeAreaView
  // adicione também inset inferior dentro da barra de navegação
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border2 }}>
      <StatusBar
        barStyle={C.bg === '#f5f0e8' || C.bg === '#f0f4f8' ? 'dark-content' : 'light-content'}
        backgroundColor={C.bg}
        translucent={false}
      />
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, minHeight:56 }}>
        <TouchableOpacity
          style={{ width:48, height:48, alignItems:'center', justifyContent:'center' }}
          onPress={onMenuPress}
          {...a11y('Menu lateral', 'Abre o menu de navegação')}
        >
          <View style={{ gap: 5 }}>
            {[20, 14, 20].map((w, i) => (
              <View key={i} style={{ width:w, height:2, borderRadius:1, backgroundColor:C.text2 }}/>
            ))}
          </View>
        </TouchableOpacity>

        <View style={{ alignItems:'center', flex:1, paddingHorizontal:8 }}>
          <Text style={[T.h3, { color:C.text, letterSpacing:0.3 }]} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={[T.caption, { color:C.text3, marginTop:2, letterSpacing:0.6 }]}>{subtitle}</Text> : null}
        </View>

        <View style={{ width:48, alignItems:'flex-end' }}>
          {right || <View style={{ width:48 }}/>}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAWER
// ═══════════════════════════════════════════════════════════════════════════

function Drawer({ visible, onClose }) {
  const { navigate, screen } = useNav();
  const { currentUser, logout } = useAuth();
  const { C, T } = useTheme();
  const { playing } = useMusic();
  const drawerW = SW * 0.78;
  const anim         = useRef(new Animated.Value(-drawerW)).current;
  const overlayAnim  = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(false);

  // Monta o componente antes de animar a abertura
  useEffect(() => {
    if (visible && !rendered) setRendered(true);
  }, [visible]);

  // Anima abertura/fechamento após montar
  useEffect(() => {
    if (!rendered) return;
    if (visible) {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: -drawerW,
          duration: 230,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 210,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, rendered]);

  const navItems = [
    { name:'Calendario', label:'Calendário',   iconName:'calendar' },
    { name:'Cronograma', label:'Cronograma',   iconName:'schedule' },
    { name:'Notas',      label:'Notas',        iconName:'notes'    },
    { name:'Humor',      label:'Humor',        iconName:'mood'     },
    { name:'Musica',     label:'Música Lo-Fi', iconName:'music'    },
    { name:'Config',     label:'Personalizar', iconName:'settings' },
  ];

  const initials = currentUser?.name
    ? currentUser.name.split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : '?';

  if (!rendered) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor:'rgba(0,0,0,0.65)', opacity: overlayAnim }]}/>
      </TouchableWithoutFeedback>

      <Animated.View style={{
        position:'absolute', left:0, top:0, bottom:0, width:drawerW,
        backgroundColor:C.bg2, zIndex:100, elevation:20,
        borderRightWidth:1, borderRightColor:C.border2,
        transform:[{ translateX:anim }],
      }}>
        <SafeAreaView edges={['top','bottom']} style={{ flex:1 }}>
          {/* Header */}
          <View style={{ padding:24, paddingBottom:16 }}>
            <Text style={[T.h2, { color:C.accent, letterSpacing:1.5 }]}>AGENDA</Text>
            <Text style={[T.caption, { color:C.text3, letterSpacing:2.5, marginTop:2 }]}>SEU TEMPO, ORGANIZADO</Text>
          </View>

          <Ornament style={{ marginHorizontal:16, marginBottom:14 }}/>

          {/* Perfil */}
          <TouchableOpacity
            style={{ flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingBottom:14 }}
            onPress={() => { navigate('Config'); onClose(); }}
            {...a11y('Perfil', 'Abrir configurações de perfil')}
          >
            {currentUser?.avatar
              ? <Image source={{ uri: currentUser.avatar }} style={{ width:48, height:48, borderRadius:24, borderWidth:1.5, borderColor:C.accent }}/>
              : (
                <View style={{
                  width:48, height:48, borderRadius:24,
                  backgroundColor:C.accentBg,
                  borderWidth:1.5, borderColor:C.accent,
                  alignItems:'center', justifyContent:'center',
                }}>
                  <Text style={[T.lg, { color:C.accent, fontWeight:'700' }]}>{initials}</Text>
                </View>
              )
            }
            <View style={{ flex:1 }}>
              <Text style={[T.base, { color:C.text, fontWeight:'700' }]}>{currentUser?.name || 'Usuário'}</Text>
              <Text style={[T.caption, { color:C.text3, marginTop:1 }]}>{currentUser?.email || ''}</Text>
            </View>
            <Icon name="chevronRight" size={14} color={C.text3}/>
          </TouchableOpacity>

          <Ornament style={{ marginHorizontal:16, marginBottom:12 }}/>

          {/* Itens de nav */}
          <ScrollView style={{ flex:1, paddingHorizontal:10 }}>
            {navItems.map(item => {
              const active = screen === item.name;
              return (
                <TouchableOpacity
                  key={item.name}
                  style={{
                    flexDirection:'row', alignItems:'center', gap:14,
                    paddingVertical:13, paddingHorizontal:14,
                    borderRadius:10, marginBottom:2,
                    backgroundColor: active ? C.accentBg : 'transparent',
                    borderWidth: active ? 1 : 0,
                    borderColor: C.border2,
                    minHeight: 48,
                  }}
                  onPress={() => { navigate(item.name); onClose(); }}
                  {...a11y(item.label, `Ir para ${item.label}`)}
                >
                  <Icon name={item.iconName} size={17} color={active ? C.accent : C.text3}/>
                  <Text style={[T.base, { flex:1, fontWeight: active ? '700' : '500', color: active ? C.accent : C.text2 }]}>
                    {item.label}
                  </Text>
                  {item.name === 'Musica' && playing && (
                    <View style={{ width:8, height:8, borderRadius:4, backgroundColor:C.accent }}/>
                  )}
                  {active && <Text style={{ fontSize:8, color:C.accent }} accessibilityElementsHidden>●</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Ornament style={{ marginHorizontal:16, marginVertical:10 }}/>

          <TouchableOpacity
            style={{ flexDirection:'row', alignItems:'center', gap:12, padding:16, marginBottom:8, minHeight:48 }}
            onPress={() => { logout(); onClose(); }}
            {...a11y('Sair da conta', 'Encerra a sessão atual')}
          >
            <Icon name="logout" size={17} color={C.danger}/>
            <Text style={[T.base, { color:C.danger, fontWeight:'600' }]}>Sair da conta</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TELA — AUTH (segurança aprimorada)
// ═══════════════════════════════════════════════════════════════════════════

function AuthScreen() {
  const { C, T } = useTheme();
  const { login, register } = useAuth();

  const [mode,        setMode]        = useState('login');
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [senha,       setSenha]       = useState('');
  const [confirma,    setConfirma]    = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [erro,        setErro]        = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [accepted,    setAccepted]    = useState(false);
  const [attempts,    setAttempts]    = useState(0);
  const [blocked,     setBlocked]     = useState(false);
  const blockTimer = useRef(null);

  const switchMode = (m) => {
    setMode(m); setErro(''); setName(''); setEmail('');
    setSenha(''); setConfirma(''); setFieldErrors({});
    setShowPwd(false); setShowConfirm(false);
  };

  const validateFields = () => {
    const erros = {};
    if (mode === 'register' && name.trim().length < 2) erros.name = 'Nome muito curto';
    if (!SECURITY.emailRegex.test(email))              erros.email = 'E-mail inválido';
    if (mode === 'login' && senha.length < 1)          erros.senha = 'Informe a senha';
    if (mode === 'register') {
      const pwdErros = SECURITY.validatePassword(senha);
      if (pwdErros.length > 0) erros.senha = pwdErros[0];
      if (senha !== confirma)  erros.confirma = 'As senhas não coincidem';
      if (!accepted)           erros.terms = 'Aceite os termos para continuar';
    }
    setFieldErrors(erros);
    return Object.keys(erros).length === 0;
  };

  const submit = async () => {
    if (blocked) { setErro('Aguarde antes de tentar novamente.'); return; }
    if (!validateFields()) return;

    setErro(''); setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), senha);
        setAttempts(0);
      } else {
        await register(name.trim(), email.trim().toLowerCase(), senha, confirma);
      }
    } catch (e) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setErro(e.message || 'Erro ao autenticar');
      if (newAttempts >= 5) {
        setBlocked(true);
        setErro('Muitas tentativas. Aguarde 30 segundos.');
        blockTimer.current = setTimeout(() => { setBlocked(false); setAttempts(0); }, 30000);
      }
    } finally {
      setLoading(false);
    }
  };

  // CORREÇÃO: cleanup do timer no unmount
  useEffect(() => () => clearTimeout(blockTimer.current), []);

  return (
    <SafeAreaView edges={['top','bottom']} style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar
        barStyle={C.bg === '#f5f0e8' || C.bg === '#f0f4f8' ? 'dark-content' : 'light-content'}
        backgroundColor={C.bg}
      />
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow:1, justifyContent:'center', padding:28 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View style={{ alignItems:'center', marginBottom:40 }}>
            <Image
              source={require('./LogoNovaCorEnovosHighlightsNovo.png')}
              style={{ width:96, height:96, borderRadius:20, marginBottom:16 }}
              resizeMode="contain"
            />
            <Text style={[T.h1, { color:C.text, letterSpacing:2 }]}>AGENDA</Text>
            <Ornament style={{ width:200, marginTop:12 }}/>
            <Text style={[T.caption, { color:C.text3, marginTop:8, letterSpacing:3 }]}>
              SEU TEMPO, ORGANIZADO
            </Text>
          </View>

          {/* Card */}
          <View style={{
            backgroundColor:C.bg2, borderRadius:16,
            borderWidth:1, borderColor:C.border2, overflow:'hidden',
          }}>
            {/* Tabs */}
            <View style={{ flexDirection:'row', borderBottomWidth:1, borderBottomColor:C.border }} accessibilityRole="tablist">
              {[
                { m:'login',    label:'ENTRAR'    },
                { m:'register', label:'CADASTRAR' },
              ].map(({ m, label }) => (
                <TouchableOpacity key={m}
                  style={{
                    flex:1, minHeight:52, alignItems:'center', justifyContent:'center',
                    borderBottomWidth:2.5,
                    borderBottomColor: mode === m ? C.accent : 'transparent',
                    backgroundColor: mode === m ? C.accentBg : 'transparent',
                  }}
                  onPress={() => switchMode(m)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m }}
                  {...a11y(label)}
                >
                  <Text style={[T.sm, { fontWeight:'700', letterSpacing:1.2, color: mode === m ? C.accent : C.text3 }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ padding:24, gap:16 }}>
              {mode === 'register' && (
                <Input
                  label="NOME COMPLETO"
                  value={name}
                  onChangeText={setName}
                  placeholder="Seu nome completo"
                  autoCapitalize="words"
                  error={fieldErrors.name}
                  hint="Mínimo 2 caracteres"
                />
              )}

              <Input
                label="E-MAIL"
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                keyboardType="email-address"
                error={fieldErrors.email}
                hint="Informe um e-mail válido"
              />

              <Input
                label="SENHA"
                value={senha}
                onChangeText={setSenha}
                placeholder="••••••••"
                secureTextEntry={!showPwd}
                error={fieldErrors.senha}
                hint={mode === 'register' ? 'Mínimo 8 caracteres com maiúscula, número e símbolo' : ''}
                right={
                  <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={{ padding:4, minWidth:32, minHeight:32, alignItems:'center', justifyContent:'center' }} {...a11y(showPwd ? 'Ocultar senha' : 'Mostrar senha')}>
                    <Icon name={showPwd ? 'eyeOff' : 'eye'} size={18} color={C.text3}/>
                  </TouchableOpacity>
                }
              />

              {mode === 'register' && <PasswordStrengthBar password={senha}/>}

              {mode === 'register' && (
                <Input
                  label="CONFIRMAR SENHA"
                  value={confirma}
                  onChangeText={setConfirma}
                  placeholder="••••••••"
                  secureTextEntry={!showConfirm}
                  error={fieldErrors.confirma}
                  right={
                    <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={{ padding:4, minWidth:32, minHeight:32, alignItems:'center', justifyContent:'center' }} {...a11y(showConfirm ? 'Ocultar' : 'Mostrar')}>
                      <Icon name={showConfirm ? 'eyeOff' : 'eye'} size={18} color={C.text3}/>
                    </TouchableOpacity>
                  }
                />
              )}

              {/* Termos */}
              {mode === 'register' && (
                <TouchableOpacity
                  style={{ flexDirection:'row', alignItems:'flex-start', gap:10, minHeight:44 }}
                  onPress={() => setAccepted(v => !v)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accepted }}
                  {...a11y(`${accepted ? 'Desmarcar' : 'Marcar'} aceite dos termos`)}
                >
                  <View style={{
                    width:22, height:22, borderRadius:6, marginTop:1,
                    borderWidth:2, borderColor: accepted ? C.accent : C.border2,
                    backgroundColor: accepted ? C.accent : 'transparent',
                    alignItems:'center', justifyContent:'center',
                  }}>
                    {accepted && <Icon name="check" size={12} color="#fff"/>}
                  </View>
                  <Text style={[T.sm, { flex:1, color:C.text2, lineHeight:22 }]}>
                    Concordo com os{' '}
                    <Text style={{ color:C.accent, fontWeight:'700' }}>Termos de Uso</Text>
                    {' '}e{' '}
                    <Text style={{ color:C.accent, fontWeight:'700' }}>Política de Privacidade</Text>
                  </Text>
                </TouchableOpacity>
              )}

              {fieldErrors.terms && (
                <Text style={[T.caption, { color:C.danger }]}>{fieldErrors.terms}</Text>
              )}

              {!!erro && (
                <View style={{
                  backgroundColor:C.danger + '18', borderWidth:1,
                  borderColor:C.danger + '40', borderRadius:8,
                  padding:12, flexDirection:'row', alignItems:'flex-start', gap:8,
                }}>
                  <Icon name="error" size={16} color={C.danger}/>
                  <Text style={[T.sm, { flex:1, color:C.danger, lineHeight:20 }]}>{erro}</Text>
                </View>
              )}

              <TouchableOpacity
                style={{
                  backgroundColor: blocked ? C.bg4 : C.accent,
                  borderRadius:10, minHeight:52,
                  alignItems:'center', justifyContent:'center',
                  marginTop:4, opacity: loading ? 0.7 : 1,
                }}
                onPress={submit}
                disabled={loading || blocked}
                {...a11y(mode === 'login' ? 'Entrar na conta' : 'Criar nova conta')}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small"/>
                  : <Text style={[T.base, { color:'#fff', fontWeight:'700', letterSpacing:1.2 }]}>
                      {mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}
                    </Text>
                }
              </TouchableOpacity>

              {/* Indicador de tentativas */}
              {attempts > 0 && mode === 'login' && (
                <View style={{ flexDirection:'row', alignItems:'center', gap:6, justifyContent:'center' }}>
                  <Icon name="shield" size={12} color={C.warn}/>
                  <Text style={[T.caption, { color:C.warn }]}>
                    {attempts} tentativa{attempts > 1 ? 's' : ''} falha{attempts > 1 ? 's' : ''} · Bloqueio em {5 - attempts}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL DE EVENTO com seleção de alarme
// ═══════════════════════════════════════════════════════════════════════════

function EventModal({ visible, event, defaultDate, onSave, onDelete, onClose }) {
  const { C, T } = useTheme();
  const [titulo,     setTitulo]     = useState('');
  const [data,       setData]       = useState('');
  const [hora,       setHora]       = useState('09:00');
  const [cor,        setCor]        = useState(EVENT_COLORS[0]);
  const [lembrete,   setLembrete]   = useState(false);
  const [alarmSound, setAlarmSound] = useState('gentle');
  const [descricao,  setDescricao]  = useState('');

  useEffect(() => {
    if (visible) {
      setTitulo(event?.titulo      || '');
      setData(event?.data          || defaultDate || '');
      setHora(event?.hora          || '09:00');
      setCor(event?.cor            || EVENT_COLORS[0]);
      setLembrete(event?.lembrete  ?? false);
      setAlarmSound(event?.alarmSound || 'gentle');
      setDescricao(event?.descricao  || '');
    }
  }, [visible, event, defaultDate]);

  const save = () => {
    if (!titulo.trim()) { Alert.alert('Aviso', 'Informe um título.'); return; }
    if (!data)          { Alert.alert('Aviso', 'Informe a data.');    return; }
    // CORREÇÃO: validação básica de formato de data e hora
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { Alert.alert('Aviso', 'Data no formato AAAA-MM-DD.'); return; }
    if (!/^\d{2}:\d{2}$/.test(hora))        { Alert.alert('Aviso', 'Hora no formato HH:MM.');    return; }
    onSave({ titulo: SECURITY.sanitize(titulo), data, hora, cor, lembrete, alarmSound, descricao: SECURITY.sanitize(descricao) });
  };

  const del = () => Alert.alert('Excluir evento', 'Esta ação não pode ser desfeita.', [
    { text:'Cancelar', style:'cancel' },
    { text:'Excluir',  style:'destructive', onPress: () => onDelete(event.id) },
  ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.65)' }}/>
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView style={{ flex:1, justifyContent:'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{
          backgroundColor:C.bg2, borderTopLeftRadius:20, borderTopRightRadius:20,
          borderTopWidth:1, borderColor:C.border2, maxHeight:'92%',
        }}>
          <View style={{ width:40, height:4, borderRadius:2, backgroundColor:C.border2, alignSelf:'center', marginTop:12 }}/>

          <View style={{
            flexDirection:'row', alignItems:'center', justifyContent:'space-between',
            paddingHorizontal:20, paddingVertical:16,
            borderBottomWidth:1, borderBottomColor:C.border,
          }}>
            <Text style={[T.h3, { color:C.text }]} accessibilityRole="header">
              {event ? 'Editar evento' : 'Novo evento'}
            </Text>
            <TouchableOpacity style={{ width:36, height:36, borderRadius:18, backgroundColor:C.bg3, alignItems:'center', justifyContent:'center' }} onPress={onClose} {...a11y('Fechar modal')}>
              <Icon name="close" size={16} color={C.text2}/>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding:20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Input label="TÍTULO" value={titulo} onChangeText={setTitulo} placeholder="Nome do evento" autoCapitalize="sentences"/>

            <View style={{ flexDirection:'row', gap:12, marginTop:16 }}>
              <View style={{ flex:1 }}>
                {/* CORREÇÃO: placeholder mais claro para o formato de data */}
                <Input label="DATA" value={data} onChangeText={setData} placeholder="2025-12-31" keyboardType="numbers-and-punctuation"/>
              </View>
              <View style={{ flex:1 }}>
                <Input label="HORA" value={hora} onChangeText={setHora} placeholder="09:00" keyboardType="numbers-and-punctuation"/>
              </View>
            </View>

            <View style={{ marginTop:16 }}>
              <Input label="DESCRIÇÃO (OPCIONAL)" value={descricao} onChangeText={setDescricao} placeholder="Detalhes do evento..." autoCapitalize="sentences"/>
            </View>

            <Text style={[T.label, { color:C.text3, marginTop:20, marginBottom:10 }]}>COR DO EVENTO</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10 }}>
              {EVENT_COLORS.map(c => (
                <TouchableOpacity key={c}
                  style={{
                    width:36, height:36, borderRadius:18, backgroundColor:c,
                    borderWidth: cor === c ? 3 : 1.5,
                    borderColor: cor === c ? '#fff' : 'transparent',
                    transform:[{ scale: cor === c ? 1.15 : 1 }],
                  }}
                  onPress={() => setCor(c)}
                  {...a11y(`Cor ${c}`, cor === c ? 'Selecionada' : 'Selecionar esta cor')}
                />
              ))}
            </View>

            {/* Lembrete */}
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:16, marginTop:4 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:10, flex:1 }}>
                <Icon name="bell" size={18} color={lembrete ? C.accent : C.text3}/>
                <Text style={[T.base, { color:C.text, fontWeight:'600' }]}>Lembrete / Alarme</Text>
              </View>
              <Switch
                value={lembrete}
                onValueChange={setLembrete}
                trackColor={{ false:C.bg4, true:C.accent }}
                thumbColor="#fff"
                accessibilityLabel="Ativar lembrete"
              />
            </View>

            {/* Sons de alarme */}
            {lembrete && (
              <View style={{ marginTop:4, marginBottom:8 }}>
                <Text style={[T.label, { color:C.text3, marginBottom:10 }]}>SOM DO ALARME</Text>
                {ALARM_SOUNDS.map(s => (
                  <TouchableOpacity key={s.id}
                    style={{
                      flexDirection:'row', alignItems:'center', gap:12,
                      paddingVertical:10, paddingHorizontal:12,
                      borderRadius:8, marginBottom:6,
                      backgroundColor: alarmSound === s.id ? C.accentBg : C.bg3,
                      borderWidth:1.5, borderColor: alarmSound === s.id ? C.accent : C.border,
                      minHeight:48,
                    }}
                    onPress={() => setAlarmSound(s.id)}
                    {...a11y(s.name, s.description)}
                  >
                    <Icon name={s.icon} size={16} color={alarmSound === s.id ? C.accent : C.text3}/>
                    <View style={{ flex:1 }}>
                      <Text style={[T.sm, { color: alarmSound === s.id ? C.accent : C.text, fontWeight:'600' }]}>{s.name}</Text>
                      <Text style={[T.caption, { color:C.text3, marginTop:1 }]}>{s.description}</Text>
                    </View>
                    {alarmSound === s.id && <Icon name="check" size={14} color={C.accent}/>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={{ flexDirection:'row', gap:10, padding:16, borderTopWidth:1, borderTopColor:C.border }}>
            {event && (
              <Btn onPress={del} variant="danger" style={{ paddingHorizontal:16 }} label="Excluir evento" hint="Remove o evento permanentemente">
                <Icon name="delete" size={16} color="#fff"/>
              </Btn>
            )}
            <Btn onPress={save} variant="primary" style={{ flex:1 }} label="Salvar evento">
              <Text style={[T.base, { color:'#fff', fontWeight:'700', letterSpacing:0.5 }]}>Salvar</Text>
            </Btn>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TELA — CALENDÁRIO
// ═══════════════════════════════════════════════════════════════════════════

function CalendarScreen({ onMenu }) {
  const { C, T } = useTheme();
  const { events, load, addEvent, editEvent, removeEvent } = useEvents();
  const hoje    = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];
  const [ano,   setAno]   = useState(hoje.getFullYear());
  const [mes,   setMes]   = useState(hoje.getMonth());
  const [sel,   setSel]   = useState(hojeStr);
  const [modal, setModal] = useState(false);
  const [edit,  setEdit]  = useState(null);

  const mesStr = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const evs    = events.filter(e => e.data.startsWith(mesStr));

  useEffect(() => { load(mesStr); }, [ano, mes]);

  const dayEvs = evs.filter(e => e.data === sel).sort((a, b) => a.hora.localeCompare(b.hora));

  const changeMonth = (dir) => {
    let m = mes + dir, a = ano;
    if (m < 0)  { m = 11; a--; }
    if (m > 11) { m = 0;  a++; }
    setMes(m); setAno(a);
  };

  const buildCells = () => {
    const cells = [];
    const first = new Date(ano, mes, 1).getDay();
    const dim   = new Date(ano, mes + 1, 0).getDate();
    const dip   = new Date(ano, mes, 0).getDate();

    for (let i = first - 1; i >= 0; i--) {
      const d  = dip - i;
      const pm = mes === 0 ? 12 : mes;
      const pa = mes === 0 ? ano - 1 : ano;
      cells.push({ day:d, ds:`${pa}-${String(pm).padStart(2,'0')}-${String(d).padStart(2,'0')}`, other:true });
    }
    for (let d = 1; d <= dim; d++) {
      cells.push({ day:d, ds:`${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, other:false });
    }
    const rem = (first + dim) % 7 === 0 ? 0 : 7 - (first + dim) % 7;
    for (let d = 1; d <= rem; d++) {
      const nm = mes === 11 ? 1  : mes + 2;
      const na = mes === 11 ? ano + 1 : ano;
      cells.push({ day:d, ds:`${na}-${String(nm).padStart(2,'0')}-${String(d).padStart(2,'0')}`, other:true });
    }
    return cells;
  };

  const handleSave = async (payload) => {
    try {
      if (edit) await editEvent(edit.id, payload);
      else      await addEvent(payload);
    } catch (e) { Alert.alert('Erro', e.message); }
    setModal(false); setEdit(null);
  };

  const handleDel = async (id) => {
    try { await removeEvent(id); } catch (e) { Alert.alert('Erro', e.message); }
    setModal(false); setEdit(null);
  };

  const openModal = (e = null) => { setEdit(e); setModal(true); };

  const fmtLabel = () => {
    const [y, m, d] = sel.split('-');
    const dt = new Date(+y, +m - 1, +d);
    return `${DIAS_LABELS[dt.getDay()]}, ${d} de ${MESES[+m - 1]}`;
  };

  const cells = buildCells();

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <TopBar
        onMenuPress={onMenu}
        title="Agenda"
        subtitle={`${MESES[mes]} ${ano}`}
        right={
          <TouchableOpacity
            style={{ width:48, height:48, alignItems:'center', justifyContent:'center' }}
            onPress={() => openModal()}
            {...a11y('Novo evento', 'Adicionar um novo evento')}
          >
            <View style={{
              width:32, height:32, borderRadius:16,
              backgroundColor:C.accent, alignItems:'center', justifyContent:'center',
            }}>
              <Icon name="add" size={20} color="#fff"/>
            </View>
          </TouchableOpacity>
        }
      />

      {/* Nav do mês */}
      <View style={{
        backgroundColor:C.bg2, borderBottomWidth:1, borderBottomColor:C.border2,
        paddingHorizontal:20, paddingVertical:14,
        flexDirection:'row', alignItems:'center', justifyContent:'space-between',
      }}>
        <TouchableOpacity
          style={{ width:44, height:44, borderRadius:22, borderWidth:1, borderColor:C.border2, alignItems:'center', justifyContent:'center' }}
          onPress={() => changeMonth(-1)}
          {...a11y('Mês anterior')}
        >
          <Ionicons name="chevron-back" size={22} color={C.text2}/>
        </TouchableOpacity>

        <View style={{ alignItems:'center' }}>
          <Text style={[T.h2, { color:C.text }]}>{MESES[mes]}</Text>
          <Text style={[T.caption, { color:C.text3, letterSpacing:3, marginTop:2 }]}>{ano}</Text>
        </View>

        <TouchableOpacity
          style={{ width:44, height:44, borderRadius:22, borderWidth:1, borderColor:C.border2, alignItems:'center', justifyContent:'center' }}
          onPress={() => changeMonth(1)}
          {...a11y('Próximo mês')}
        >
          <Ionicons name="chevron-forward" size={22} color={C.text2}/>
        </TouchableOpacity>
      </View>

      {/* Dias da semana */}
      <View style={{ flexDirection:'row', backgroundColor:C.bg2, paddingHorizontal:6, borderBottomWidth:1, borderBottomColor:C.border }}>
        {DIAS_SEMANA.map((d, i) => (
          <Text key={i} style={[T.caption, {
            flex:1, textAlign:'center', fontWeight:'700', letterSpacing:0.5,
            color: i === 0 || i === 6 ? C.accent : C.text3,
            paddingVertical:8,
          }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Grade */}
      <FlatList
        data={cells}
        numColumns={7}
        keyExtractor={(_, i) => String(i)}
        scrollEnabled={false}
        style={{ backgroundColor:C.bg2, flexShrink:1 }}
        renderItem={({ item }) => {
          const dots      = events.filter(e => e.data === item.ds);
          const isToday   = item.ds === hojeStr;
          const isSel     = item.ds === sel;
          const dw        = new Date(item.ds + 'T00:00:00').getDay();
          const isWeekend = dw === 0 || dw === 6;
          return (
            <TouchableOpacity
              style={{
                flex:1, aspectRatio:1.3, alignItems:'center', justifyContent:'center',
                borderRadius:10, margin:2,
                backgroundColor: isSel && !isToday ? C.accentBg : 'transparent',
                borderWidth: isSel && !isToday ? 1 : 0, borderColor: C.border2,
              }}
              onPress={() => setSel(item.ds)}
              {...a11y(`${item.day} ${MESES[mes]}`, `${dots.length} evento(s)`)}
            >
              <View style={{
                width:30, height:30, borderRadius:15,
                backgroundColor: isToday ? C.accent : 'transparent',
                alignItems:'center', justifyContent:'center',
              }}>
                <Text style={[T.sm, {
                  fontWeight: isToday || isSel ? '700' : '400',
                  color: isToday ? '#fff' : item.other ? C.text3 : isWeekend ? C.accent : C.text,
                }]}>{item.day}</Text>
              </View>
              <View style={{ flexDirection:'row', gap:2, marginTop:1, height:6 }}>
                {dots.slice(0, 3).map((_, di) => (
                  <View key={di} style={{ width:5, height:5, borderRadius:3, backgroundColor:C.accent }}/>
                ))}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <Ornament style={{ marginHorizontal:20, marginVertical:6 }}/>

      {/* Painel do dia */}
      <View style={{ flex:1, minHeight:200, paddingHorizontal:20, paddingTop:4 }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <Text style={[T.label, { color:C.accent, letterSpacing:1.5 }]}>
            {fmtLabel().toUpperCase()}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor:C.accent, paddingHorizontal:16, paddingVertical:8, borderRadius:20, minHeight:36 }}
            onPress={() => openModal()}
            {...a11y('Novo evento neste dia')}
          >
            <Text style={[T.caption, { color:'#fff', fontWeight:'700', letterSpacing:1 }]}>+ EVENTO</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom:120 }}>
          {dayEvs.length === 0
            ? (
              <View style={{ paddingVertical:24, alignItems:'center' }}>
                <Icon name="calendar" size={32} color={C.text3} style={{ marginBottom:10 }}/>
                <Text style={[T.base, { color:C.text3 }]}>Nenhum evento neste dia</Text>
              </View>
            )
            : dayEvs.map(e => (
              <TouchableOpacity key={e.id}
                style={{
                  flexDirection:'row', alignItems:'center', gap:12,
                  paddingVertical:12, paddingHorizontal:14,
                  marginBottom:8, borderRadius:10,
                  backgroundColor:C.bg2,
                  borderWidth:1, borderColor:C.border,
                  borderLeftWidth:4, borderLeftColor:e.cor,
                  minHeight:56,
                }}
                onPress={() => openModal(e)}
                {...a11y(e.titulo, `${e.hora}${e.lembrete ? ' · Lembrete ativo' : ''}`)}
              >
                <View style={{
                  width:40, height:40, borderRadius:20,
                  backgroundColor:e.cor + '22', alignItems:'center', justifyContent:'center',
                }}>
                  <Text style={[T.caption, { color:e.cor, fontWeight:'700' }]}>{e.hora}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={[T.base, { color:C.text, fontWeight:'600' }]} numberOfLines={1}>{e.titulo}</Text>
                  {e.descricao ? <Text style={[T.caption, { color:C.text3, marginTop:2 }]} numberOfLines={1}>{e.descricao}</Text> : null}
                </View>
                {e.lembrete && <Icon name="bell" size={15} color={e.cor}/>}
              </TouchableOpacity>
            ))
          }
        </ScrollView>
      </View>

      <EventModal visible={modal} event={edit} defaultDate={sel} onSave={handleSave} onDelete={handleDel} onClose={() => { setModal(false); setEdit(null); }}/>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TELA — CRONOGRAMA
// ═══════════════════════════════════════════════════════════════════════════

const HOUR_H = 64;
const EVENT_OVERLAP_MINS = 50; // duração assumida para detectar sobreposição

// Distribui eventos sobrepostos em colunas side-by-side
function layoutDayEvents(evs) {
  if (!evs.length) return {};
  const toMins = (h) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
  const sorted = [...evs].sort((a, b) => toMins(a.hora) - toMins(b.hora));
  const cols = [];
  for (const ev of sorted) {
    const start = toMins(ev.hora);
    let placed = false;
    for (let ci = 0; ci < cols.length; ci++) {
      const last = cols[ci][cols[ci].length - 1];
      if (toMins(last.hora) + EVENT_OVERLAP_MINS <= start) {
        cols[ci].push(ev); placed = true; break;
      }
    }
    if (!placed) cols.push([ev]);
  }
  const result = {};
  cols.forEach((col, ci) => col.forEach(ev => { result[ev.id] = { col: ci, totalCols: cols.length }; }));
  return result;
}

function CronogramaScreen({ onMenu }) {
  const { C, T } = useTheme();
  const { events, load, addEvent, editEvent, removeEvent } = useEvents();
  const hoje = new Date();
  const weekDays = Array.from({ length:7 }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    return { label:DIAS_LABELS[d.getDay()], num:d.getDate(), ds:d.toISOString().split('T')[0] };
  });
  const [selDay, setSelDay] = useState(weekDays[0].ds);
  const [modal,  setModal]  = useState(false);
  const [edit,   setEdit]   = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const h = hoje.getHours();
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, (h - 2) * HOUR_H), animated:true });
    }, 200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selDay]);

  const mesStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  useEffect(() => { load(mesStr); }, []);
  const dayEvs = events.filter(e => e.data === selDay);
  const getTop = (hora) => {
    const [h, m] = hora.split(':').map(Number);
    return h * HOUR_H + (m / 60) * HOUR_H;
  };

  const handleSave = async (payload) => {
    try {
      if (edit) await editEvent(edit.id, payload);
      else      await addEvent(payload);
    } catch (e) { Alert.alert('Erro', e.message); }
    setModal(false); setEdit(null);
  };

  const handleDel = async (id) => {
    try { await removeEvent(id); } catch (e) { Alert.alert('Erro', e.message); }
    setModal(false); setEdit(null);
  };

  const openModal = (e = null) => { setEdit(e); setModal(true); };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <TopBar
        onMenuPress={onMenu}
        title="Cronograma"
        subtitle="Visão semanal"
        right={
          <TouchableOpacity
            style={{ width:48, height:48, alignItems:'center', justifyContent:'center' }}
            onPress={() => openModal()}
            {...a11y('Novo evento', 'Adicionar um novo evento')}
          >
            <View style={{
              width:32, height:32, borderRadius:16,
              backgroundColor:C.accent, alignItems:'center', justifyContent:'center',
            }}>
              <Icon name="add" size={20} color="#fff"/>
            </View>
          </TouchableOpacity>
        }
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ backgroundColor:C.bg2, borderBottomWidth:1, borderBottomColor:C.border2, maxHeight:68 }}
        contentContainerStyle={{ paddingHorizontal:10, paddingVertical:5, gap:6, alignItems:'center' }}
      >
        {weekDays.map(d => (
          <TouchableOpacity key={d.ds}
            style={{
              minWidth:52, paddingHorizontal:8, paddingVertical:4,
              borderRadius:10, alignItems:'center', borderWidth:1.5,
              backgroundColor: selDay === d.ds ? C.accentBg : 'transparent',
              borderColor: selDay === d.ds ? C.accent : 'transparent',
            }}
            onPress={() => setSelDay(d.ds)}
            {...a11y(`${d.label} ${d.num}`)}
          >
            <Text style={[T.caption, { fontWeight:'700', letterSpacing:0.8, color: selDay === d.ds ? C.accent : C.text3 }]}>
              {d.label.toUpperCase()}
            </Text>
            <Text style={{ fontSize:16, fontWeight:'700', color: selDay === d.ds ? C.accent : C.text, marginTop:1, fontFamily:T.base.fontFamily }}>{d.num}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView ref={scrollRef} style={{ flex:1 }} showsVerticalScrollIndicator={false}>
        <View style={{ position:'relative', height:24 * HOUR_H, marginLeft:56, marginRight:12 }}>
          {Array.from({ length:24 }, (_, h) => (
            <View key={h} style={{
              position:'absolute', left:-56, right:0,
              flexDirection:'row', alignItems:'flex-start',
              height:HOUR_H, top:h * HOUR_H,
            }}>
              <Text style={[T.caption, { width:48, textAlign:'right', paddingRight:10, paddingTop:3, color:C.text3, fontWeight:'600' }]}>
                {String(h).padStart(2, '0')}h
              </Text>
              <View style={{ flex:1, borderTopWidth:1, borderTopColor:C.lineColor, marginTop:8 }}/>
            </View>
          ))}

          {/* Linha de hora atual — só no dia de hoje */}
          {selDay === weekDays[0].ds && (
            <View style={{
              position:'absolute', left:0, right:0,
              top: hoje.getHours() * HOUR_H + (hoje.getMinutes() / 60) * HOUR_H,
              flexDirection:'row', alignItems:'center', zIndex:10,
            }}>
              <View style={{ width:10, height:10, borderRadius:5, backgroundColor:C.accent, marginLeft:-5 }}/>
              <View style={{ flex:1, height:2, backgroundColor:C.accent, opacity:0.9 }}/>
            </View>
          )}

          {(() => {
            const layout = layoutDayEvents(dayEvs);
            // marginLeft:56 + marginRight:12 = 68px de margens no container
            const containerW = SW - 68;
            const COL_GAP = 3;
            return dayEvs.map(e => {
              const { col, totalCols } = layout[e.id] || { col: 0, totalCols: 1 };
              const colW   = (containerW - (totalCols - 1) * COL_GAP) / totalCols;
              const evLeft = col * (colW + COL_GAP);
              const evRight = containerW - evLeft - colW;
              return (
                <TouchableOpacity key={e.id}
                  style={{
                    position:'absolute',
                    left: evLeft, right: Math.max(0, evRight),
                    top: getTop(e.hora), height: HOUR_H - 12,
                    borderLeftWidth:4, borderRadius:8,
                    paddingHorizontal:8, paddingVertical:6,
                    backgroundColor: e.cor + '1e', borderLeftColor: e.cor,
                  }}
                  onPress={() => { setEdit(e); setModal(true); }}
                  {...a11y(e.titulo, e.hora)}
                >
                  <Text style={[T.sm, { color:e.cor, fontWeight:'700' }]} numberOfLines={1}>{e.titulo}</Text>
                  <Text style={[T.caption, { color:e.cor, marginTop:2, opacity:0.8 }]}>{e.hora}</Text>
                </TouchableOpacity>
              );
            });
          })()}
        </View>
      </ScrollView>

      <EventModal visible={modal} event={edit} defaultDate={selDay} onSave={handleSave} onDelete={handleDel} onClose={() => { setModal(false); setEdit(null); }}/>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TELA — NOTAS
// ═══════════════════════════════════════════════════════════════════════════

function NotasScreen({ onMenu }) {
  const { C, T } = useTheme();
  const [notas,      setNotas]      = useState([]);
  const [query,      setQuery]      = useState('');
  const [activeTag,  setActiveTag]  = useState('');
  const [openNota,   setOpenNota]   = useState(null);
  const [editTitle,  setEditTitle]  = useState('');
  const [editBody,   setEditBody]   = useState('');
  const [editTags,   setEditTags]   = useState([]);
  const [tagInp,     setTagInp]     = useState('');
  const [saveSt,     setSaveSt]     = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    api.getNotes().then(setNotas).catch(() => {});
    return () => clearTimeout(timer.current);
  }, []);

  const allTags  = [...new Set(notas.flatMap(n => n.tags))];
  const filtered = notas.filter(n => {
    const mQ = !query || n.titulo.toLowerCase().includes(query.toLowerCase()) || n.conteudo.toLowerCase().includes(query.toLowerCase());
    const mT = !activeTag || n.tags.includes(activeTag);
    return mQ && mT;
  });

  const openEditor = (nota) => {
    clearTimeout(timer.current);
    setOpenNota(nota);
    setEditTitle(nota.titulo);
    setEditBody(nota.conteudo);
    setEditTags([...nota.tags]);
    setSaveSt('Salvo');
    setShowEditor(true);
  };

  const closeEditor = () => {
    clearTimeout(timer.current);
    setShowEditor(false);
    setOpenNota(null);
  };

  const createNota = async () => {
    try {
      const n = await api.createNote({ titulo: '', conteudo: '', tags: [] });
      setNotas(prev => [n, ...prev]);
      openEditor(n);
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  const autoSave = (title, body, tags) => {
    setSaveSt('Salvando...');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!openNota) return;
      try {
        const updated = await api.updateNote(openNota.id, {
          titulo:   SECURITY.sanitize(title),
          conteudo: body,
          tags,
        });
        setNotas(prev => prev.map(n => n.id === openNota.id ? updated : n));
        setSaveSt(updated._offline ? 'Salvo (offline)' : 'Salvo');
      } catch (_) { setSaveSt('Erro ao salvar'); }
    }, 1500);
  };

  const addTag = () => {
    const t = tagInp.trim().toLowerCase();
    if (!t || editTags.includes(t)) { setTagInp(''); return; }
    const nt = [...editTags, t];
    setEditTags(nt);
    setTagInp('');
    autoSave(editTitle, editBody, nt);
  };

  const delNota = () => Alert.alert('Excluir nota', 'Esta ação não pode ser desfeita.', [
    { text:'Cancelar', style:'cancel' },
    { text:'Excluir',  style:'destructive', onPress: async () => {
      try {
        await api.deleteNote(openNota.id);
        setNotas(prev => prev.filter(n => n.id !== openNota.id));
      } catch (e) { Alert.alert('Erro', e.message); }
      closeEditor();
    }},
  ]);

  if (showEditor) return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <TopBar onMenuPress={onMenu} title="Notas"
        right={
          <TouchableOpacity
            style={{ minWidth:64, minHeight:44, alignItems:'center', justifyContent:'center' }}
            onPress={closeEditor}
            {...a11y('Voltar para a lista de notas')}
          >
            <Text style={[T.caption, { color:C.accent, fontWeight:'700', letterSpacing:0.5 }]}>VOLTAR</Text>
          </TouchableOpacity>
        }
      />
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        <View style={{
          flexDirection:'row', alignItems:'center', justifyContent:'space-between',
          paddingHorizontal:20, paddingVertical:10,
          backgroundColor:C.bg2, borderBottomWidth:1, borderBottomColor:C.border,
        }}>
          <TouchableOpacity style={{ minHeight:44, justifyContent:'center' }} onPress={delNota} {...a11y('Excluir nota')}>
            <Text style={[T.caption, { color:C.danger, fontWeight:'700', letterSpacing:0.5 }]}>EXCLUIR</Text>
          </TouchableOpacity>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
            <View style={{ width:7, height:7, borderRadius:4, backgroundColor: saveSt === 'Salvo' ? C.success : C.warn }}/>
            <Text style={[T.caption, { color:C.text3 }]}>{saveSt}</Text>
          </View>
        </View>

        <TextInput
          style={[T.h2, { color:C.text, paddingHorizontal:20, paddingTop:18, paddingBottom:8 }]}
          placeholder="Sem título..."
          placeholderTextColor={C.text3}
          value={editTitle}
          onChangeText={v => { setEditTitle(v); autoSave(v, editBody, editTags); }}
          accessibilityLabel="Título da nota"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ maxHeight:44 }}
          contentContainerStyle={{ paddingHorizontal:20, alignItems:'center', gap:6 }}
        >
          {editTags.map(t => {
            const cl = getTagColor(t);
            return (
              <TouchableOpacity key={t}
                style={{ backgroundColor:cl + '22', paddingHorizontal:12, paddingVertical:6, borderRadius:20, minHeight:32 }}
                onPress={() => { const nt = editTags.filter(x => x !== t); setEditTags(nt); autoSave(editTitle, editBody, nt); }}
                {...a11y(`Remover etiqueta ${t}`)}
              >
                <Text style={[T.caption, { color:cl, fontWeight:'600' }]}>{t} ×</Text>
              </TouchableOpacity>
            );
          })}
          <TextInput
            style={[T.caption, { color:C.text2, minWidth:90, paddingVertical:6 }]}
            placeholder="+ etiqueta..."
            placeholderTextColor={C.text3}
            value={tagInp}
            onChangeText={setTagInp}
            onSubmitEditing={addTag}
            returnKeyType="done"
            blurOnSubmit={false}
            accessibilityLabel="Adicionar etiqueta"
          />
        </ScrollView>

        <Ornament style={{ marginHorizontal:20, marginVertical:10 }}/>

        <TextInput
          style={[T.body, { flex:1, color:C.text, paddingHorizontal:20, paddingBottom:16 }]}
          placeholder="Comece a escrever..."
          placeholderTextColor={C.text3}
          value={editBody}
          onChangeText={v => { setEditBody(v); autoSave(editTitle, v, editTags); }}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Conteúdo da nota"
        />
      </KeyboardAvoidingView>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <TopBar onMenuPress={onMenu} title="Notas" subtitle="Suas anotações"/>
      <View style={{ padding:16, paddingBottom:8 }}>
        <View style={{
          flexDirection:'row', alignItems:'center',
          backgroundColor:C.bg3, borderWidth:1.5, borderColor:C.border,
          borderRadius:10, paddingHorizontal:14, minHeight:52,
        }}>
          <Icon name="search" size={18} color={C.text3} style={{ marginRight:8 }}/>
          <TextInput
            style={[T.base, { flex:1, color:C.text }]}
            placeholder="Buscar notas..."
            placeholderTextColor={C.text3}
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Buscar notas"
          />
        </View>
      </View>

      {allTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ maxHeight:42 }}
          contentContainerStyle={{ paddingHorizontal:16, gap:6, alignItems:'center' }}
        >
          {allTags.map(t => (
            <TouchableOpacity key={t}
              style={{
                paddingHorizontal:14, paddingVertical:6, borderRadius:20, minHeight:34,
                backgroundColor: activeTag === t ? C.accentBg : C.bg3,
                borderWidth:1.5, borderColor: activeTag === t ? C.accent : C.border,
              }}
              onPress={() => setActiveTag(activeTag === t ? '' : t)}
              {...a11y(`${activeTag === t ? 'Remover' : 'Filtrar por'} etiqueta ${t}`)}
            >
              <Text style={[T.caption, { color:activeTag === t ? C.accent : C.text2, fontWeight:'600' }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding:16, gap:10, paddingBottom:120 }}
        ListHeaderComponent={() => (
          <TouchableOpacity
            style={{
              borderWidth:1.5, borderStyle:'dashed', borderColor:C.accent,
              borderRadius:10, paddingVertical:14, alignItems:'center', marginBottom:4, minHeight:52,
            }}
            onPress={createNota}
            {...a11y('Nova nota', 'Criar uma nova nota')}
          >
            <Text style={[T.base, { color:C.accent, fontWeight:'700', letterSpacing:0.5 }]}>+ Nova nota</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={{ paddingVertical:40, alignItems:'center' }}>
            <Icon name="notes" size={36} color={C.text3} style={{ marginBottom:12 }}/>
            <Text style={[T.base, { color:C.text3 }]}>Nenhuma nota encontrada</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              backgroundColor:C.bg2, borderRadius:10,
              borderWidth:1, borderColor:C.border,
              padding:16, gap:6,
            }}
            onPress={() => openEditor(item)}
            {...a11y(item.titulo || 'Sem título', item.conteudo?.substring(0, 80))}
          >
            <Text style={[T.h3, { color:C.text }]} numberOfLines={1}>{item.titulo || 'Sem título'}</Text>
            <Text style={[T.body, { color:C.text2 }]} numberOfLines={2}>{item.conteudo || ''}</Text>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:4 }}>
              <Text style={[T.caption, { color:C.text3, flexShrink:1, marginRight:8 }]} numberOfLines={1}>{item.updatedAt}</Text>
              <View style={{ flexDirection:'row', gap:4, flexShrink:1, maxWidth:'65%' }}>
                {item.tags.slice(0, 2).map(t => {
                  const cl = getTagColor(t);
                  return (
                    <View key={t} style={{ backgroundColor:cl + '22', paddingHorizontal:8, paddingVertical:3, borderRadius:20, flexShrink:1 }}>
                      <Text style={[T.caption, { color:cl, fontWeight:'600' }]} numberOfLines={1}>{t}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TELA — HUMOR
// ═══════════════════════════════════════════════════════════════════════════

function HumorScreen({ onMenu }) {
  const { C, T } = useTheme();
  const [historico, setHistorico] = useState([]);
  const [nivel,     setNivel]     = useState(0);

  useEffect(() => {
    api.getMoods(14).then(data => {
      setHistorico(data);
      const ts    = new Date().toISOString().split('T')[0];
      const entry = data.find(h => h.data === ts);
      if (entry) setNivel(entry.nivel);
    }).catch(() => {});
  }, []);

  const selectHumor = async (n) => {
    setNivel(n);
    const ts = new Date().toISOString().split('T')[0];
    try {
      await api.saveMood(n, ts);
      setHistorico(prev => {
        const others = prev.filter(h => h.data !== ts);
        return [...others, { data: ts, nivel: n }].sort((a, b) => a.data.localeCompare(b.data));
      });
    } catch (_) {}
  };

  const avg = historico.filter(h => h.nivel > 0).reduce((s, h, _, a) => s + h.nivel / a.length, 0);

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <TopBar onMenuPress={onMenu} title="Humor" subtitle="Acompanhamento de bem-estar"/>
      <ScrollView contentContainerStyle={{ padding:16, gap:16, paddingBottom:120 }}>

        {/* Seletor */}
        <View style={{ backgroundColor:C.bg2, borderRadius:14, borderWidth:1, borderColor:C.border2, padding:20 }}>
          <Text style={[T.label, { color:C.text3, marginBottom:18, textAlign:'center' }]}>COMO VOCÊ ESTÁ HOJE?</Text>
          <View style={{ flexDirection:'row', gap:6 }}>
            {HUMOR_LEVELS.map(({ nivel:n, humorIcon, label, color }) => {
              const sel = nivel === n;
              return (
                <TouchableOpacity key={n}
                  style={{
                    flex:1, paddingVertical:16, borderRadius:12,
                    borderWidth:2,
                    backgroundColor: sel ? color + '25' : C.bg3,
                    borderColor: sel ? color : C.border,
                    alignItems:'center', gap:6,
                    transform:[{ translateY: sel ? -5 : 0 }],
                  }}
                  onPress={() => selectHumor(n)}
                  {...a11y(`Humor ${label}`, sel ? 'Selecionado' : 'Selecionar')}
                >
                  <Ionicons name={humorIcon} size={28} color={sel ? color : C.text3}/>
                  <Text style={[T.caption, { fontWeight:'700', color: sel ? color : C.text3, letterSpacing:0.3 }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {nivel > 0 && (
            <>
              <Ornament style={{ marginTop:16, marginBottom:12 }}/>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 }}>
                <Ionicons name={HUMOR_LEVELS[nivel - 1]?.humorIcon} size={18} color={HUMOR_LEVELS[nivel - 1]?.color}/>
                <Text style={[T.base, { color:C.text2 }]}>
                  {HUMOR_LEVELS[nivel - 1]?.label} — registrado hoje
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Média */}
        {avg > 0 && (
          <View style={{ backgroundColor:C.bg2, borderRadius:14, borderWidth:1, borderColor:C.border2, padding:16, flexDirection:'row', alignItems:'center', gap:14 }}>
            <View style={{
              width:56, height:56, borderRadius:28,
              backgroundColor: HUMOR_LEVELS[Math.round(avg) - 1]?.color + '25',
              alignItems:'center', justifyContent:'center',
            }}>
              <Ionicons
                name={HUMOR_LEVELS[Math.round(avg) - 1]?.humorIcon || 'happy-outline'}
                size={26}
                color={HUMOR_LEVELS[Math.round(avg) - 1]?.color}
              />
            </View>
            <View style={{ flex:1 }}>
              <Text style={[T.caption, { color:C.text3, marginBottom:3 }]}>MÉDIA DOS ÚLTIMOS 14 DIAS</Text>
              <Text style={[T.h3, { color:C.text }]}>{avg.toFixed(1)} — {HUMOR_LEVELS[Math.round(avg) - 1]?.label}</Text>
            </View>
          </View>
        )}

        {/* Gráfico */}
        <View style={{ backgroundColor:C.bg2, borderRadius:14, borderWidth:1, borderColor:C.border2, padding:18 }}>
          <Text style={[T.label, { color:C.text3, marginBottom:16 }]}>ÚLTIMOS 14 DIAS</Text>
          <View style={{
            height:100, flexDirection:'row', alignItems:'flex-end', gap:3,
            borderBottomWidth:1, borderBottomColor:C.border,
          }}>
            {historico.map((entry, i) => {
              const h  = entry.nivel ? (entry.nivel / 5) * 96 : 4;
              const cl = entry.nivel ? HUMOR_LEVELS[entry.nivel - 1]?.color : C.border2;
              return (
                <View key={i} style={{ flex:1, alignItems:'center', justifyContent:'flex-end' }}>
                  <View style={{ width:'80%', borderRadius:4, height:h, minHeight:4, backgroundColor:cl }}/>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection:'row', gap:3, marginTop:4 }}>
            {historico.map((entry, i) => {
              const d = new Date(entry.data + 'T00:00:00');
              return (
                <View key={i} style={{ flex:1, alignItems:'center' }}>
                  <Text style={{ color:C.text3, fontSize:9 }}>{d.getDate()}</Text>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection:'row', justifyContent:'center', gap:14, marginTop:12 }}>
            {HUMOR_LEVELS.map(({ nivel:n, humorIcon, color }) => (
              <View key={n} style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
                <View style={{ width:8, height:8, borderRadius:4, backgroundColor:color }}/>
                <Ionicons name={humorIcon} size={14} color={color}/>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Slider reutilizável (responder system, sem libs extras) ────────────────
function TrackSlider({ value, max, onChange, onChanging, color, showTooltip = false, formatTooltip = v => String(Math.round(v)) }) {
  const [w, setW]             = useState(300);
  const [display, setDisplay] = useState(value);
  const [dragging, setDragging] = useState(false);
  const wRef        = useRef(300);
  const displayRef  = useRef(value);
  const draggingRef = useRef(false);
  const gestureRef  = useRef({ startPageX:0, startPageY:0, startVal:0, dir:null });

  useEffect(() => {
    if (!draggingRef.current) {
      displayRef.current = value;
      setDisplay(value);
    }
  }, [value]);

  const ratio    = max > 0 ? Math.min(1, Math.max(0, display / max)) : 0;
  const thumbLeft = Math.max(0, Math.min(ratio * w - 9, w - 18));

  const snapVal = (locationX) =>
    Math.max(0, Math.min(max, (locationX / wRef.current) * max));

  const valFromDx = (pageX) => {
    const delta = ((pageX - gestureRef.current.startPageX) / wRef.current) * max;
    return Math.max(0, Math.min(max, gestureRef.current.startVal + delta));
  };

  return (
    <View
      style={{ height:44, justifyContent:'center' }}
      onLayout={e => {
        wRef.current = e.nativeEvent.layout.width;
        setW(e.nativeEvent.layout.width);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => gestureRef.current.dir === 'v'}
      onResponderGrant={e => {
        draggingRef.current = true;
        setDragging(true);
        const snapped = snapVal(e.nativeEvent.locationX);
        displayRef.current = snapped;
        setDisplay(snapped);
        onChanging?.(snapped);
        gestureRef.current = {
          startPageX: e.nativeEvent.pageX,
          startPageY: e.nativeEvent.pageY,
          startVal:   snapped,
          dir:        null,
        };
      }}
      onResponderMove={e => {
        const dx = Math.abs(e.nativeEvent.pageX - gestureRef.current.startPageX);
        const dy = Math.abs(e.nativeEvent.pageY - gestureRef.current.startPageY);
        if (!gestureRef.current.dir && (dx > 3 || dy > 3)) {
          gestureRef.current.dir = dy > dx * 2 ? 'v' : 'h';
        }
        if (gestureRef.current.dir !== 'v') {
          const v = valFromDx(e.nativeEvent.pageX);
          displayRef.current = v;
          setDisplay(v);
          onChanging?.(v);
        }
      }}
      onResponderRelease={e => {
        if (gestureRef.current.dir !== 'v') {
          const v = valFromDx(e.nativeEvent.pageX);
          displayRef.current = v;
          setDisplay(v);
          onChanging?.(v);
          onChange(v);
        }
        draggingRef.current = false;
        setDragging(false);
      }}
      onResponderTerminate={() => {
        draggingRef.current = false;
        setDragging(false);
        gestureRef.current.dir = null;
      }}
    >
      {/* Tooltip de tempo — visível apenas durante drag */}
      {showTooltip && dragging && (
        <View style={{
          position:'absolute', top:0,
          left: Math.max(0, thumbLeft - 12),
          backgroundColor: color,
          paddingHorizontal:6, paddingVertical:2,
          borderRadius:4, zIndex:10,
        }}>
          <Text style={{ color:'#fff', fontSize:10, fontWeight:'700' }}>
            {formatTooltip(display)}
          </Text>
        </View>
      )}

      {/* Track */}
      <View style={{ height:6, borderRadius:3, backgroundColor:'rgba(128,128,128,0.25)', overflow:'hidden' }}>
        <View style={{ width:`${Math.round(ratio * 100)}%`, height:'100%', backgroundColor:color }}/>
      </View>

      {/* Thumb */}
      <View style={{
        position:'absolute', top:13,
        left: thumbLeft,
        width:18, height:18, borderRadius:9,
        backgroundColor:color,
        elevation:4,
        shadowColor:'#000', shadowOffset:{width:0,height:2},
        shadowOpacity:0.25, shadowRadius:4,
      }}/>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TELA — MÚSICA LO-FI
// ═══════════════════════════════════════════════════════════════════════════

function MusicaScreen({ onMenu }) {
  const { C, T } = useTheme();
  const { playing, currentTrack, volume, setVolume, play, pause, resume, stop, next, prev, looping, setLooping, position, duration, seekTo } = useMusic();

  const fmtTime = (secs) => {
    const s = Math.floor(secs);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <TopBar onMenuPress={onMenu} title="Música Lo-Fi" subtitle="Foco e concentração"/>
      <ScrollView contentContainerStyle={{ padding:16, gap:16, paddingBottom:100 }}>

        {/* Player principal */}
        <View style={{
          backgroundColor:C.bg2, borderRadius:16, borderWidth:1, borderColor:C.border2,
          padding:20, alignItems:'center', gap:14,
        }}>
          <View style={{
            width:90, height:90, borderRadius:45,
            backgroundColor:C.accentBg,
            borderWidth:2, borderColor: playing ? C.accent : C.border2,
            alignItems:'center', justifyContent:'center',
          }}>
            <Icon name="music" size={40} color={playing ? C.accent : C.text3}/>
          </View>

          {currentTrack
            ? <>
                <View style={{ alignItems:'center' }}>
                  <Text style={[T.h3, { color:C.text }]}>{currentTrack.name}</Text>
                  <Text style={[T.caption, { color:C.text3, marginTop:4 }]}>{currentTrack.bpm} · Lo-Fi Hip Hop</Text>
                </View>

                {/* Controlador de tempo */}
                <View style={{ width:'100%', gap:6 }}>
                  <TrackSlider
                    value={position}
                    max={duration > 0 ? duration : 1}
                    onChange={seekTo}
                    showTooltip
                    formatTooltip={fmtTime}
                    color={C.accent}
                  />
                  <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                    <Text style={[T.caption, { color:C.text3 }]}>{fmtTime(position)}</Text>
                    <Text style={[T.caption, { color:C.text3 }]}>{duration > 0 ? fmtTime(duration) : '--:--'}</Text>
                  </View>
                </View>

                <View style={{ flexDirection:'row', gap:12, alignItems:'center' }}>
                  {/* Loop */}
                  <TouchableOpacity
                    style={{
                      width:36, height:36, borderRadius:8,
                      borderWidth:1.5,
                      borderColor: looping ? C.accent : C.border,
                      alignItems:'center', justifyContent:'center',
                    }}
                    onPress={() => setLooping(l => !l)}
                    {...a11y(looping ? 'Desativar loop' : 'Ativar loop')}
                  >
                    <Icon name="repeat" size={16} color={looping ? C.accent : C.text3}/>
                  </TouchableOpacity>

                  {/* Prev */}
                  <TouchableOpacity
                    style={{ width:40, height:40, borderRadius:20, backgroundColor:C.bg3, alignItems:'center', justifyContent:'center' }}
                    onPress={prev}
                    {...a11y('Faixa anterior')}
                  >
                    <Icon name="prev" size={20} color={C.text2}/>
                  </TouchableOpacity>

                  {/* Play / Pause */}
                  <TouchableOpacity
                    style={{ width:60, height:60, borderRadius:30, backgroundColor:C.accent, alignItems:'center', justifyContent:'center' }}
                    onPress={playing ? pause : resume}
                    {...a11y(playing ? 'Pausar' : 'Continuar')}
                  >
                    <Icon name={playing ? 'pause' : 'play'} size={24} color="#fff"/>
                  </TouchableOpacity>

                  {/* Next */}
                  <TouchableOpacity
                    style={{ width:40, height:40, borderRadius:20, backgroundColor:C.bg3, alignItems:'center', justifyContent:'center' }}
                    onPress={next}
                    {...a11y('Próxima faixa')}
                  >
                    <Icon name="next" size={20} color={C.text2}/>
                  </TouchableOpacity>

                  {/* Stop */}
                  <TouchableOpacity
                    style={{ width:36, height:36, borderRadius:8, alignItems:'center', justifyContent:'center' }}
                    onPress={stop}
                    {...a11y('Parar')}
                  >
                    <Icon name="stop" size={20} color={C.text3}/>
                  </TouchableOpacity>
                </View>
              </>
            : <Text style={[T.base, { color:C.text3, textAlign:'center' }]}>
                Selecione uma faixa abaixo
              </Text>
          }

          {/* Volume */}
          <View style={{ width:'100%', gap:8 }}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <Icon name="volume-low" size={14} color={C.text3}/>
              <Text style={[T.caption, { color:C.text2, fontWeight:'700' }]}>{Math.round(volume * 100)}%</Text>
              <Icon name="volume-high" size={14} color={C.text3}/>
            </View>
            <TrackSlider
              value={volume}
              max={1}
              onChanging={setVolume}
              onChange={setVolume}
              color={C.accent}
            />
          </View>
        </View>

        {/* Lista de faixas */}
        <Text style={[T.label, { color:C.text3 }]}>FAIXAS DISPONÍVEIS</Text>
        {LOFI_TRACKS.map(track => (
          <TouchableOpacity key={track.id}
            style={{
              flexDirection:'row', alignItems:'center', gap:14,
              padding:16, borderRadius:12, minHeight:68,
              backgroundColor: currentTrack?.id === track.id ? C.accentBg : C.bg2,
              borderWidth:1.5,
              borderColor: currentTrack?.id === track.id ? C.accent : C.border,
            }}
            onPress={() => currentTrack?.id === track.id ? (playing ? pause() : resume()) : play(track)}
            {...a11y(track.name, `${track.bpm} · Tocar ou pausar`)}
          >
            <View style={{
              width:44, height:44, borderRadius:22,
              backgroundColor: currentTrack?.id === track.id ? C.accent : C.bg3,
              alignItems:'center', justifyContent:'center',
            }}>
              {currentTrack?.id === track.id && playing
                ? <Icon name="pause" size={18} color="#fff"/>
                : <Icon name="play"  size={18} color={currentTrack?.id === track.id ? '#fff' : C.text3}/>
              }
            </View>
            <View style={{ flex:1 }}>
              <Text style={[T.base, { color: currentTrack?.id === track.id ? C.accent : C.text, fontWeight:'700' }]}>
                {track.name}
              </Text>
              <Text style={[T.caption, { color:C.text3, marginTop:2 }]}>{track.bpm}</Text>
            </View>
            <Icon name="music" size={14} color={currentTrack?.id === track.id ? C.accent : C.text3}/>
          </TouchableOpacity>
        ))}

      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TELA — CONFIG / PERSONALIZAÇÃO com foto de perfil
// ═══════════════════════════════════════════════════════════════════════════

function ConfigScreen({ onMenu }) {
  const { C, T, themeId, fontFamily, fontSize, accentId, highContrast, setTheme, setFont, setSize, setAccent, toggleHC } = useTheme();
  const { currentUser, logout, updateAvatar, updateProfile } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [newName,     setNewName]     = useState('');

  const initials = currentUser?.name
    ? currentUser.name.split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : '?';

  const handleLogout = () => Alert.alert('Sair', 'Deseja encerrar a sessão?', [
    { text:'Cancelar', style:'cancel' },
    { text:'Sair', style:'destructive', onPress: logout },
  ]);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'Precisamos de acesso à galeria para alterar a foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      try { await updateAvatar(result.assets[0].uri); }
      catch (e) { Alert.alert('Erro', e.message); }
    }
  };

  const saveName = async () => {
    if (newName.trim().length < 2) { Alert.alert('Nome inválido', 'Mínimo 2 caracteres'); return; }
    await updateProfile(newName.trim());
    setEditingName(false);
  };

  // CORREÇÃO: Section movida para fora da função (evita recriação a cada render)
  const Section = ({ label, children }) => (
    <View style={{ backgroundColor:C.bg2, borderRadius:14, borderWidth:1, borderColor:C.border2, padding:16, gap:14 }}>
      <Text style={[T.label, { color:C.text3 }]}>{label}</Text>
      {children}
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <TopBar onMenuPress={onMenu} title="Personalizar" subtitle="Tema, fontes e aparência"/>
      <ScrollView contentContainerStyle={{ padding:16, gap:16, paddingBottom:48 }}>

        {/* Perfil com foto */}
        <Section label="perfil">
          <View style={{ alignItems:'center', gap:14 }}>
            <TouchableOpacity onPress={pickPhoto} {...a11y('Alterar foto de perfil')}>
              <View style={{ position:'relative' }}>
                {currentUser?.avatar
                  ? <Image source={{ uri:currentUser.avatar }} style={{ width:80, height:80, borderRadius:40, borderWidth:2, borderColor:C.accent }}/>
                  : (
                    <View style={{
                      width:80, height:80, borderRadius:40,
                      backgroundColor:C.accentBg, borderWidth:2, borderColor:C.accent,
                      alignItems:'center', justifyContent:'center',
                    }}>
                      <Text style={[T.h2, { color:C.accent }]}>{initials}</Text>
                    </View>
                  )
                }
                <View style={{
                  position:'absolute', bottom:0, right:0,
                  width:26, height:26, borderRadius:13,
                  backgroundColor:C.accent,
                  borderWidth:2, borderColor:C.bg2,
                  alignItems:'center', justifyContent:'center',
                }}>
                  <Icon name="photo" size={12} color="#fff"/>
                </View>
              </View>
            </TouchableOpacity>

            {editingName
              ? (
                <View style={{ width:'100%', gap:10 }}>
                  <Input
                    label="NOVO NOME"
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Seu nome"
                    autoCapitalize="words"
                  />
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <Btn onPress={() => setEditingName(false)} style={{ flex:1 }} label="Cancelar">
                      <Text style={[T.sm, { color:C.text2, fontWeight:'600' }]}>Cancelar</Text>
                    </Btn>
                    <Btn onPress={saveName} variant="primary" style={{ flex:1 }} label="Salvar nome">
                      <Text style={[T.sm, { color:'#fff', fontWeight:'700' }]}>Salvar</Text>
                    </Btn>
                  </View>
                </View>
              )
              : (
                <View style={{ alignItems:'center' }}>
                  <Text style={[T.h3, { color:C.text }]}>{currentUser?.name || 'Usuário'}</Text>
                  <Text style={[T.caption, { color:C.text3, marginTop:2 }]}>{currentUser?.email || '—'}</Text>
                  <TouchableOpacity
                    style={{ marginTop:10, paddingHorizontal:16, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:C.border2, minHeight:36 }}
                    onPress={() => { setNewName(currentUser?.name || ''); setEditingName(true); }}
                    {...a11y('Editar nome')}
                  >
                    <Text style={[T.caption, { color:C.accent, fontWeight:'700' }]}>EDITAR NOME</Text>
                  </TouchableOpacity>
                </View>
              )
            }
          </View>
        </Section>

        {/* Acessibilidade */}
        <Section label="acessibilidade">
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', minHeight:48 }}>
            <View style={{ flex:1 }}>
              <Text style={[T.base, { color:C.text, fontWeight:'600' }]}>Alto contraste</Text>
              <Text style={[T.caption, { color:C.text3, marginTop:2 }]}>Melhora a legibilidade</Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={toggleHC}
              trackColor={{ false:C.bg4, true:C.accent }}
              thumbColor="#fff"
              accessibilityLabel="Alternar alto contraste"
            />
          </View>
        </Section>

        {/* Temas — 10 opções */}
        <Section label="tema da agenda">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8 }}>
            {Object.values(THEMES).map(theme => (
              <TouchableOpacity key={theme.id}
                style={{
                  width:110, borderRadius:12, overflow:'hidden',
                  borderWidth:2, borderColor: themeId === theme.id ? C.accent : C.border,
                }}
                onPress={() => setTheme(theme.id)}
                {...a11y(theme.name, theme.description)}
              >
                {/* Preview */}
                <View style={{ height:52, backgroundColor:theme.bg, padding:8, gap:4 }}>
                  <View style={{ height:8, borderRadius:4, backgroundColor:theme.accent, width:'70%' }}/>
                  <View style={{ height:6, borderRadius:3, backgroundColor:theme.text3, width:'50%' }}/>
                  <View style={{ flexDirection:'row', gap:4, marginTop:2 }}>
                    {[theme.accent, theme.success, theme.danger].map((c, i) => (
                      <View key={i} style={{ width:10, height:10, borderRadius:5, backgroundColor:c }}/>
                    ))}
                  </View>
                </View>
                <View style={{ backgroundColor:theme.bg2, padding:8 }}>
                  <Text style={{ fontSize:12, color:theme.text, fontWeight:'700' }}>{theme.name}</Text>
                  <Text style={{ fontSize:10, color:theme.text3, marginTop:1 }}>{theme.description}</Text>
                </View>
                {themeId === theme.id && (
                  <View style={{ position:'absolute', top:6, right:6, width:18, height:18, borderRadius:9, backgroundColor:C.accent, alignItems:'center', justifyContent:'center' }}>
                    {/* CORREÇÃO: size do ícone de check reduzido para caber no container 18x18 */}
                    <Icon name="check" size={10} color="#fff"/>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Section>

        {/* Cor de destaque — 12 opções */}
        <Section label="cor de destaque">
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10 }}>
            {ACCENT_COLORS.map(a => (
              <TouchableOpacity key={a.id}
                style={{
                  alignItems:'center', gap:5,
                  paddingVertical:8, paddingHorizontal:10,
                  borderRadius:10, minHeight:56, minWidth:56,
                  backgroundColor: accentId === a.id ? a.color + '22' : C.bg3,
                  borderWidth:2, borderColor: accentId === a.id ? a.color : C.border,
                }}
                onPress={() => setAccent(accentId === a.id ? null : a.id)}
                {...a11y(a.name, accentId === a.id ? 'Selecionada. Toque para usar a cor do tema.' : 'Selecionar')}
              >
                <View style={{ width:24, height:24, borderRadius:12, backgroundColor:a.color }}/>
                <Text style={[T.caption, { color:C.text3, fontWeight:'600', textAlign:'center' }]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[T.caption, { color:C.text3 }]}>Toque na cor selecionada para usar a padrão do tema</Text>
        </Section>

        {/* Família de fonte */}
        <Section label="estilo da fonte">
          <View style={{ flexDirection:'row', gap:8 }}>
            {Object.values(FONT_FAMILIES).map(f => (
              <TouchableOpacity key={f.id}
                style={{
                  flex:1, paddingVertical:14, paddingHorizontal:8,
                  borderRadius:10, alignItems:'center', gap:6, minHeight:72,
                  backgroundColor: fontFamily === f.id ? C.accentBg : C.bg3,
                  borderWidth:2, borderColor: fontFamily === f.id ? C.accent : C.border,
                }}
                onPress={() => setFont(f.id)}
                {...a11y(f.label, fontFamily === f.id ? 'Selecionada' : 'Selecionar')}
              >
                <Text style={{ fontSize:18, color:C.text, fontFamily:f.family, fontWeight:'700' }}>Aa</Text>
                <Text style={[T.caption, { color:fontFamily === f.id ? C.accent : C.text3, fontWeight:'600', textAlign:'center' }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Tamanho da fonte */}
        <Section label="tamanho do texto">
          <View style={{ flexDirection:'row', gap:8 }}>
            {Object.values(FONT_SIZES).map(f => (
              <TouchableOpacity key={f.id}
                style={{
                  flex:1, paddingVertical:14,
                  borderRadius:10, alignItems:'center', gap:6, minHeight:72,
                  backgroundColor: fontSize === f.id ? C.accentBg : C.bg3,
                  borderWidth:2, borderColor: fontSize === f.id ? C.accent : C.border,
                }}
                onPress={() => setSize(f.id)}
                {...a11y(`Tamanho ${f.name}`, fontSize === f.id ? 'Selecionado' : 'Selecionar')}
              >
                <Text style={{ fontSize:f.base, color:C.text, fontWeight:'700' }}>A</Text>
                <Text style={[T.caption, { color:fontSize === f.id ? C.accent : C.text3, fontWeight:'600', textAlign:'center', fontSize:11 }]}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Prévia */}
        <View style={{ backgroundColor:C.bg2, borderRadius:14, borderWidth:1, borderColor:C.border2, padding:20, gap:8 }}>
          <Text style={[T.label, { color:C.text3, marginBottom:4 }]}>prévia do texto</Text>
          <Text style={[T.h1, { color:C.text }]}>Reunião de equipe</Text>
          <Text style={[T.body, { color:C.text2 }]}>Segunda-feira, 12 de Maio</Text>
          <Text style={[T.base, { color:C.text3 }]}>Sala de reuniões • 10:00 — 11:30</Text>
          <Ornament style={{ marginTop:8 }}/>
          <Text style={[T.caption, { color:C.text3, textAlign:'center', marginTop:4 }]}>
            Prévia com seu estilo atual
          </Text>
        </View>

        {/* Conta */}
        <Section label="conta">
          <TouchableOpacity
            style={{ minHeight:48, justifyContent:'center' }}
            onPress={handleLogout}
            {...a11y('Sair da conta', 'Encerra a sessão atual')}
          >
            <Text style={[T.base, { color:C.danger, fontWeight:'700' }]}>Sair da conta</Text>
          </TouchableOpacity>
        </Section>

        <Text style={[T.caption, { textAlign:'center', color:C.text3, letterSpacing:2.5 }]}>
          AGENDA v3.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// APP SHELL
// ═══════════════════════════════════════════════════════════════════════════

function AppShell() {
  const { screen }              = useNav();
  const { C, T }                = useTheme();
  const { isOffline }           = useEvents();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const renderScreen = () => {
    switch (screen) {
      case 'Calendario': return <CalendarScreen  onMenu={() => setDrawerOpen(true)}/>;
      case 'Cronograma': return <CronogramaScreen onMenu={() => setDrawerOpen(true)}/>;
      case 'Notas':      return <NotasScreen      onMenu={() => setDrawerOpen(true)}/>;
      case 'Humor':      return <HumorScreen      onMenu={() => setDrawerOpen(true)}/>;
      case 'Musica':     return <MusicaScreen     onMenu={() => setDrawerOpen(true)}/>;
      case 'Config':     return <ConfigScreen     onMenu={() => setDrawerOpen(true)}/>;
      default:           return <CalendarScreen   onMenu={() => setDrawerOpen(true)}/>;
    }
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg, overflow:'hidden', paddingBottom: insets.bottom }}>
      {isOffline && (
        <View style={{
          backgroundColor: C.warn + '22',
          borderBottomWidth: 1, borderBottomColor: C.warn + '55',
          paddingHorizontal: 16, paddingVertical: 5,
          flexDirection: 'row', alignItems: 'center', gap: 8,
        }}>
          <Icon name="bellOff" size={13} color={C.warn}/>
          <Text style={[T.caption, { color: C.warn }]}>
            Sem conexão — exibindo dados em cache. Alterações serão sincronizadas.
          </Text>
        </View>
      )}
      {renderScreen()}
      <MiniPlayer/>
      <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)}/>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════

function Root() {
  const { currentUser, isLoading } = useAuth();
  const { C, T } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('lembretes', {
            name: 'Lembretes de Eventos',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
          });
        }
        await Notifications.requestPermissionsAsync();
      } catch (_) {}
    })();
  }, []);

  if (isLoading) return (
    <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center', gap:20 }}>
      <Image
        source={require('./LogoNovaCorEnovosHighlightsNovo.png')}
        style={{ width:100, height:100, borderRadius:20 }}
        resizeMode="contain"
      />
      <Text style={[T.h2, { color:C.accent, letterSpacing:2.5 }]}>AGENDA</Text>
      <ActivityIndicator color={C.accent} size="large"/>
    </View>
  );

  return currentUser
    ? <NavProvider><EventsProvider><AppShell/></EventsProvider></NavProvider>
    : <AuthScreen/>;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <MusicProvider>
            <Root/>
          </MusicProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
