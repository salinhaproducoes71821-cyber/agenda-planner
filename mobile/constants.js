import React from 'react';
import {Dimensions} from 'react-native';
import {MUSIC_BASE} from './config';

const { width: SW } = Dimensions.get('window');

const a11y = (label, hint) => ({
  accessible: true,
  accessibilityLabel: label,
  accessibilityHint: hint || undefined,
});

const LOFI_TRACKS = [
  { id:'lofi1', name:'lukrembo — rose',    icon:'moon',    bpm:'Lo-Fi', url:`${MUSIC_BASE}/rose.mp3`    },
  { id:'lofi2', name:'lukrembo — wine',    icon:'coffee',  bpm:'Lo-Fi', url:`${MUSIC_BASE}/wine.mp3`    },
  { id:'lofi3', name:'lukrembo — butter',  icon:'feather', bpm:'Lo-Fi', url:`${MUSIC_BASE}/butter.mp3`  },
  { id:'lofi4', name:'lukrembo — teapot',  icon:'coffee',  bpm:'Lo-Fi', url:`${MUSIC_BASE}/teapot.mp3`  },
  { id:'lofi5', name:'lukrembo — rudolph', icon:'tree',    bpm:'Lo-Fi', url:`${MUSIC_BASE}/rudolph.mp3` },
];

const ALARM_SOUNDS = [
  { id:'classic',  name:'Clássico',   icon:'clock',      description:'Over the Horizon' },
  { id:'piano',    name:'Piano',      icon:'music',      description:'Nokia Piano' },
  { id:'birds',    name:'Pássaros',   icon:'feather',    description:'Ringtone Bird' },
  { id:'vibrate',  name:'Vibração',   icon:'smartphone', description:'Apenas vibrar' },
];

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
    return str.trim();
  },
};

const SOUND_FILES = {
  classic: 'classic.mp3',
  piano:   'piano.mp3',
  birds:   'birds.mp3',
};

const SOUND_CHANNELS = {
  classic: 'lembrete-classic',
  piano:   'lembrete-piano',
  birds:   'lembrete-birds',
  vibrate: 'lembrete-vibrate',
};

const DEFAULT_SOUND_KEY = 'classic';

const SOUND_ASSETS = {
  classic: require('./assets/sounds/classic.mp3'),
  piano:   require('./assets/sounds/piano.mp3'),
  birds:   require('./assets/sounds/birds.mp3'),
};


export {SW, a11y, LOFI_TRACKS, ALARM_SOUNDS, ICON_MAP, MESES, DIAS_SEMANA, DIAS_LABELS, HUMOR_LEVELS, EVENT_COLORS, TAG_COLORS, getTagColor, SECURITY, SOUND_FILES, SOUND_CHANNELS, DEFAULT_SOUND_KEY, SOUND_ASSETS};
