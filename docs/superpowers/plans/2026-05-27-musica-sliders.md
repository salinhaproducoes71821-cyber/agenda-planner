# Música Lo-Fi — Player Completo + Sliders

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir bugs nos sliders, adicionar Prev/Next/Loop ao player, auto-next ao fim da faixa, volume em tempo real e persistido, MiniPlayer com barra de progresso.

**Architecture:** Tudo em `App.js` (arquivo único). `TrackSlider` recebe props novas (`onChanging`, `showTooltip`, `formatTooltip`). `MusicProvider` passa a ter `loopingRef`/`currentTrackRef` para closures seguras, mais `next()`/`prev()`. `MusicaScreen` e `MiniPlayer` consomem as novas props/funções.

**Tech Stack:** React Native + Expo, `expo-av` (Audio), `@react-native-async-storage/async-storage`, Ionicons (`@expo/vector-icons`)

---

### Task 1: Adicionar ícone `repeat` ao ICON_MAP

**Files:**
- Modify: `App.js:169` (linha `coffee: 'cafe-outline'` — última do ICON_MAP)

- [ ] **Step 1: Adicionar entrada `repeat` no ICON_MAP**

Em `App.js`, logo após `coffee: 'cafe-outline',` (última linha do ICON_MAP, antes do `}`), adicionar:

```js
  repeat:       'repeat-outline',
```

O mapa ficará com a última seção assim:
```js
  moon:         'moon-outline',
  tree:         'leaf-outline',
  train:        'train-outline',
  coffee:       'cafe-outline',
  repeat:       'repeat-outline',
};
```

- [ ] **Step 2: Verificar que o ícone `repeat-outline` existe no Ionicons**

Ionicons v5+ inclui `repeat-outline` e `repeat`. O app já usa Ionicons via `@expo/vector-icons`. Nenhuma instalação adicional necessária.

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "feat: adiciona ícone repeat ao ICON_MAP"
```

---

### Task 2: TrackSlider — visual melhorado + prop `onChanging` + tooltip de tempo

**Files:**
- Modify: `App.js:2288-2376` (função `TrackSlider`)

- [ ] **Step 1: Substituir a função `TrackSlider` inteira**

Localizar a função em `App.js` (começa em `function TrackSlider({ value, max, onChange, color })`) e substituir pela versão abaixo. As mudanças são:
- Signature: adiciona `onChanging`, `showTooltip`, `formatTooltip`
- Track: `height:4` → `height:6`, `borderRadius:2` → `borderRadius:3`
- Thumb: `16×16` → `18×18`, `borderRadius:8` → `borderRadius:9`, adiciona `shadowColor`, `elevation:4`
- Thumb left: `ratio * w - 8` → `ratio * w - 9`
- `onResponderMove`: chama `onChanging?.(v)` após atualizar display
- `onResponderRelease`: chama `onChanging?.(v)` antes de `onChange(v)` (garante consistência)
- Tooltip: `View` absoluta acima do thumb, visível apenas quando `showTooltip && draggingRef.current`

```js
function TrackSlider({ value, max, onChange, onChanging, color, showTooltip = false, formatTooltip = v => String(Math.round(v)) }) {
  const [w, setW]           = useState(300);
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

  const ratio = max > 0 ? Math.min(1, Math.max(0, display / max)) : 0;

  const snapVal = (locationX) =>
    Math.max(0, Math.min(max, (locationX / wRef.current) * max));

  const valFromDx = (pageX) => {
    const delta = ((pageX - gestureRef.current.startPageX) / wRef.current) * max;
    return Math.max(0, Math.min(max, gestureRef.current.startVal + delta));
  };

  const thumbLeft = Math.max(0, Math.min(ratio * w - 9, w - 18));

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
      {/* Tooltip de tempo acima do thumb — visível apenas durante drag */}
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
```

- [ ] **Step 2: Verificar que nenhum uso existente do `TrackSlider` quebrou**

Grep por `TrackSlider` no arquivo:
```
onChanging    → prop nova opcional, backward-compat (default undefined)
showTooltip   → prop nova opcional (default false)
formatTooltip → prop nova opcional (default v => String(Math.round(v)))
onChange      → continua obrigatório, comportamento igual
```
Nenhum uso existente precisa mudar neste passo.

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "feat: melhora visual e comportamento do TrackSlider (onChanging, tooltip)"
```

---

### Task 3: MusicProvider — `currentTrackRef`, `looping`/`loopingRef`, `next()`, `prev()`

**Files:**
- Modify: `App.js:555-628` (função `MusicProvider`)

- [ ] **Step 1: Adicionar refs e estado de loop**

Dentro de `MusicProvider`, após `const genRef = useRef(0);`, adicionar:

```js
const currentTrackRef = useRef(null); // espelha currentTrack para closures assíncronas
const [looping,    setLooping]    = useState(false);
const loopingRef = useRef(false);
```

- [ ] **Step 2: Manter refs sincronizados com estado**

Após o `useEffect` de `volume` (linha ~570), adicionar dois `useEffect`:

```js
useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
useEffect(() => { loopingRef.current = looping; }, [looping]);
```

- [ ] **Step 3: Adicionar funções `next` e `prev`**

Após a função `seekTo`, adicionar:

```js
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
```

- [ ] **Step 4: Expor `next`, `prev`, `looping`, `setLooping` no context value**

Localizar a linha do `MusicContext.Provider value={...}` e atualizar para:

```js
<MusicContext.Provider value={{ playing, currentTrack, volume, setVolume, play, pause, resume, stop, next, prev, looping, setLooping, position, duration, seekTo }}>
```

- [ ] **Step 5: Commit**

```bash
git add App.js
git commit -m "feat: MusicProvider ganha next/prev/loop"
```

---

### Task 4: MusicProvider — auto-next no `didJustFinish` + volume persistido

**Files:**
- Modify: `App.js:590-601` (callback `setOnPlaybackStatusUpdate` dentro de `play`)

- [ ] **Step 1: Atualizar o handler `didJustFinish`**

Localizar o bloco dentro de `play()`:
```js
if (s.didJustFinish) { setPlaying(false); setPosition(0); }
```

Substituir por:
```js
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
```

- [ ] **Step 2: Carregar volume salvo no mount**

Localizar o `useEffect` inicial (que chama `Audio.setAudioModeAsync`):
```js
useEffect(() => {
  Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true }).catch(() => {});
  return () => { soundRef.current?.unloadAsync().catch(() => {}); };
}, []);
```

Substituir por:
```js
useEffect(() => {
  Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true }).catch(() => {});
  AsyncStorage.getItem('@ag_music_volume').then(v => {
    if (v !== null) setVolume(parseFloat(v));
  }).catch(() => {});
  return () => { soundRef.current?.unloadAsync().catch(() => {}); };
}, []);
```

- [ ] **Step 3: Persistir volume quando muda**

Localizar o `useEffect` de volume:
```js
useEffect(() => {
  soundRef.current?.setVolumeAsync(volume).catch(() => {});
}, [volume]);
```

Substituir por:
```js
useEffect(() => {
  soundRef.current?.setVolumeAsync(volume).catch(() => {});
  AsyncStorage.setItem('@ag_music_volume', String(volume)).catch(() => {});
}, [volume]);
```

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "feat: auto-next ao fim da faixa e volume persistido no AsyncStorage"
```

---

### Task 5: MusicaScreen — sliders atualizados + controles Prev/Next/Loop/Stop

**Files:**
- Modify: `App.js:2382-2506` (função `MusicaScreen`)

- [ ] **Step 1: Adicionar `next`, `prev`, `looping`, `setLooping` ao destructuring**

Localizar:
```js
const { playing, currentTrack, volume, setVolume, play, pause, resume, stop, position, duration, seekTo } = useMusic();
```

Substituir por:
```js
const { playing, currentTrack, volume, setVolume, play, pause, resume, stop, next, prev, looping, setLooping, position, duration, seekTo } = useMusic();
```

- [ ] **Step 2: Atualizar slider de volume para feedback em tempo real**

Localizar o bloco do slider de volume:
```jsx
<TrackSlider
  value={volume}
  max={1}
  onChange={setVolume}
  color={C.accent}
/>
```

Substituir por:
```jsx
<TrackSlider
  value={volume}
  max={1}
  onChanging={setVolume}
  onChange={setVolume}
  color={C.accent}
/>
```

- [ ] **Step 3: Atualizar slider de tempo para exibir tooltip durante scrub**

Localizar o bloco do slider de tempo:
```jsx
<TrackSlider
  value={position}
  max={duration > 0 ? duration : 1}
  onChange={seekTo}
  color={C.accent}
/>
```

Substituir por:
```jsx
<TrackSlider
  value={position}
  max={duration > 0 ? duration : 1}
  onChange={seekTo}
  showTooltip
  formatTooltip={fmtTime}
  color={C.accent}
/>
```

- [ ] **Step 4: Substituir a barra de controles (Stop + Play/Pause → Loop + Prev + Play/Pause + Next + Stop)**

Localizar o bloco de controles atual:
```jsx
<View style={{ flexDirection:'row', gap:16, alignItems:'center' }}>
  <TouchableOpacity style={{ padding:12, minWidth:44, minHeight:44, alignItems:'center', justifyContent:'center' }} onPress={stop} {...a11y('Parar')}>
    <Icon name="stop" size={22} color={C.text3}/>
  </TouchableOpacity>
  <TouchableOpacity
    style={{
      width:60, height:60, borderRadius:30,
      backgroundColor:C.accent, alignItems:'center', justifyContent:'center',
    }}
    onPress={playing ? pause : resume}
    {...a11y(playing ? 'Pausar' : 'Continuar')}
  >
    <Icon name={playing ? 'pause' : 'play'} size={24} color="#fff"/>
  </TouchableOpacity>
  <View style={{ width:44 }}/>
</View>
```

Substituir por:
```jsx
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
```

- [ ] **Step 5: Commit**

```bash
git add App.js
git commit -m "feat: MusicaScreen com Prev/Next/Loop e sliders corrigidos"
```

---

### Task 6: MiniPlayer — barra de progresso + Prev/Next + tempo no subtítulo

**Files:**
- Modify: `App.js:774-820` (função `MiniPlayer`)

- [ ] **Step 1: Atualizar destructuring do `useMusic` no MiniPlayer**

Localizar:
```js
const { playing, currentTrack, pause, resume, stop } = useMusic();
```

Substituir por:
```js
const { playing, currentTrack, pause, resume, next, prev, position, duration } = useMusic();
```

- [ ] **Step 2: Adicionar `fmtTime` local no MiniPlayer**

Logo após o destructuring, adicionar:
```js
const fmtTime = (secs) => {
  const s = Math.floor(secs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const progressRatio = duration > 0 ? Math.min(1, position / duration) : 0;
```

- [ ] **Step 3: Substituir o JSX do MiniPlayer**

Substituir o `return (...)` inteiro do `MiniPlayer` por:

```jsx
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
      backgroundColor: 'rgba(128,128,128,0.15)',
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
        {duration > 0 ? `${fmtTime(position)} / ${fmtTime(duration)}` : currentTrack.bpm + ' · Lo-Fi'}
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
```

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "feat: MiniPlayer com barra de progresso, Prev/Next e tempo"
```

---

## Checklist de verificação final

Após todas as tasks, verificar manualmente no Expo:

- [ ] Slider de volume: arrastar muda o som em tempo real sem soltar o dedo
- [ ] Slider de tempo: tooltip aparece com o tempo formatado durante scrub
- [ ] Botão Next: avança faixa; na última, volta para a primeira
- [ ] Botão Prev: position > 3s → volta ao início; position ≤ 3s → faixa anterior
- [ ] Fim da faixa: próxima começa automaticamente
- [ ] Botão Loop ativo (borda accent): faixa repete ao fim
- [ ] Fechar e reabrir app: volume restaurado do AsyncStorage
- [ ] MiniPlayer em outra tela: barra de progresso animada + Prev/Next funcionam
- [ ] Troca de faixa manual na lista continua funcionando
- [ ] Pausa e retomada continuam funcionando
