import React from 'react';
import {createContext, useState, useEffect, useCallback, useContext} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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


export {THEMES, FONT_FAMILIES, FONT_SIZES, ACCENT_COLORS, ThemeContext, ThemeProvider, useTheme};
