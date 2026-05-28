# Design: Música Lo-Fi — Player Completo + Sliders

**Data:** 2026-05-27  
**Status:** Aprovado  
**Arquivo alvo:** `App.js` (arquivo único, sem nova estrutura de arquivos)

---

## Contexto

O app Agenda Planner tem uma tela de música lo-fi (`MusicaScreen`) com um `MusicProvider` e um componente `TrackSlider` reutilizável. Foram identificados bugs e limitações:

- `onChange` do slider é chamado apenas no `onResponderRelease` — volume não muda em tempo real durante drag
- Nenhum feedback visual durante scrub no slider de tempo (sem tooltip)
- Quando a faixa termina (`didJustFinish`), o player para sem avançar para a próxima
- Sem botões Prev/Next nem modo Loop
- `MiniPlayer` (aparece em todas as telas) sem barra de progresso nem navegação
- Volume não persiste entre sessões

---

## Escopo

### Fora do escopo
- Shuffle (não adicionado — 5 faixas não justificam)
- Equalizer ou efeitos de áudio
- Download offline de faixas
- Nova estrutura de arquivos (tudo em `App.js`)

---

## 1. TrackSlider — Melhorias

### Props novas
```
TrackSlider({ value, max, onChange, onChanging, color, showTooltip, formatTooltip })
```

- **`onChanging(v)`** — chamado em cada `onResponderMove` com o valor instantâneo. Opcional.
- **`showTooltip`** — boolean, default `false`. Quando `true`, exibe um tooltip acima do thumb durante drag com o valor formatado.
- **`formatTooltip(v)`** — função de formatação do tooltip. Default: `v => String(Math.round(v))`.

### Comportamento
- `onChange` continua sendo chamado **somente no release** (preserva comportamento de seek — evita seeks por frame na API nativa de áudio).
- `onChanging` é chamado **em cada move** (usado pelo volume para feedback imediato).
- Tooltip aparece acima do thumb quando `showTooltip=true` e `draggingRef.current=true`. Desaparece no release.

### Visual
- Track: `height: 4` → `height: 6`, `borderRadius: 3`
- Thumb: `14×14` → `18×18`, `borderRadius: 9`, adicionar `shadowColor/shadowOpacity/shadowRadius` e `elevation: 4`
- Thumb position: `left: Math.max(0, ratio * w - 9)` (centro correto para 18px)

---

## 2. MusicProvider — Playlist ciente + Loop + Auto-next

### Estado novo
```js
const [looping, setLooping] = useState(false);
const loopingRef = useRef(false); // espelha looping para uso seguro em closures assíncronas
```

Sempre que `looping` mudar, atualizar o ref:
```js
useEffect(() => { loopingRef.current = looping; }, [looping]);
```

O provider passa a operar sobre `LOFI_TRACKS` diretamente (importado no mesmo arquivo). O índice da faixa atual é derivado de `currentTrack`:

```js
const trackIndex = LOFI_TRACKS.findIndex(t => t.id === currentTrack?.id);
```

### Funções novas
```js
const next = async () => {
  const idx = LOFI_TRACKS.findIndex(t => t.id === currentTrack?.id);
  const nextTrack = LOFI_TRACKS[(idx + 1) % LOFI_TRACKS.length];
  await play(nextTrack);
};

const prev = async () => {
  // Se position > 3s, volta ao início da faixa atual
  if (position > 3) { await seekTo(0); return; }
  const idx = LOFI_TRACKS.findIndex(t => t.id === currentTrack?.id);
  const prevIdx = (idx - 1 + LOFI_TRACKS.length) % LOFI_TRACKS.length;
  await play(LOFI_TRACKS[prevIdx]);
};
```

### Auto-next e Loop no `didJustFinish`
```js
if (s.didJustFinish) {
  if (loopingRef.current) {
    // replay: volta ao início e retoca (replayAsync não é garantido em todas as versões do expo-av)
    soundRef.current?.setPositionAsync(0).then(() => soundRef.current?.playAsync()).catch(() => {});
  } else {
    // auto-next
    const idx = LOFI_TRACKS.findIndex(t => t.id === currentTrackRef.current?.id);
    const nextTrack = LOFI_TRACKS[(idx + 1) % LOFI_TRACKS.length];
    play(nextTrack);
  }
}
```

> `currentTrackRef` — adicionar um `useRef` espelhando `currentTrack` para uso seguro dentro de closures assíncronas (evita stale closure).

### Volume persistido no AsyncStorage
```js
// mount: carregar volume salvo
useEffect(() => {
  AsyncStorage.getItem('music_volume').then(v => {
    if (v !== null) setVolume(parseFloat(v));
  }).catch(() => {});
}, []);

// save: persistir quando muda
useEffect(() => {
  soundRef.current?.setVolumeAsync(volume).catch(() => {});
  AsyncStorage.setItem('music_volume', String(volume)).catch(() => {});
}, [volume]);
```

### Context value atualizado
```js
{ playing, currentTrack, volume, setVolume, play, pause, resume, stop,
  next, prev, looping, setLooping, position, duration, seekTo }
```

---

## 3. MusicaScreen — Controles atualizados

### Slider de volume
```jsx
<TrackSlider
  value={volume}
  max={1}
  onChanging={setVolume}   // tempo real durante drag
  onChange={setVolume}     // também aplica no release (idempotente)
  color={C.accent}
/>
```

### Slider de tempo (seek)
```jsx
<TrackSlider
  value={position}
  max={duration > 0 ? duration : 1}
  onChange={seekTo}          // só no release
  showTooltip
  formatTooltip={fmtTime}
  color={C.accent}
/>
```

### Barra de controles
Layout horizontal com 5 elementos:

```
[ Loop ] [ Prev ] [ Play/Pause (grande) ] [ Next ] [ Stop ]
```

- **Loop**: `TouchableOpacity` com borda e cor do accent quando ativo, cinza quando inativo. Ícone: `repeat` (Ionicons `repeat-outline` / `repeat`).
- **Prev**: ícone `play-skip-back-outline`, círculo menor.
- **Play/Pause**: igual ao atual (círculo grande com accent).
- **Next**: ícone `play-skip-forward-outline`, círculo menor.
- **Stop**: ícone `stop-circle-outline`, tom neutro/discreto.

---

## 4. MiniPlayer — Barra de progresso + Navegação

### Layout atualizado
```
[ Ícone ] [ Nome / Tempo-posição ] [ Prev ] [ Play/Pause ] [ Next ]
```

- Stop removido do MiniPlayer (está no player principal).
- Subtítulo: `{currentTrack.bpm} · {fmtTime(position)} / {fmtTime(duration)}` (quando duration > 0).
- Barra de progresso: `View` de `height: 2` na base absoluta do card, cor `C.accent` com opacity 0.3 no fundo.

```jsx
// Barra de progresso na base do MiniPlayer
<View style={{ position:'absolute', bottom:0, left:0, right:0, height:2, backgroundColor:'rgba(155,127,232,0.15)', borderBottomLeftRadius:14, borderBottomRightRadius:14 }}>
  <View style={{ width:`${Math.round((position / (duration || 1)) * 100)}%`, height:'100%', backgroundColor:C.accent, borderBottomLeftRadius:14 }}/>
</View>
```

O MiniPlayer passa a consumir `position`, `duration`, `next`, `prev` do `useMusic()`.

---

## Critérios de aceitação

- [ ] Arrastar o slider de volume muda o áudio em tempo real (sem soltar o dedo)
- [ ] Durante scrub do slider de tempo, tooltip aparece com o tempo formatado (ex: `1:24`)
- [ ] Botão Next avança para a faixa seguinte; na última, volta para a primeira
- [ ] Botão Prev volta ao início se position > 3s; caso contrário, vai para a faixa anterior
- [ ] Quando faixa termina, a próxima começa automaticamente
- [ ] Botão Loop ativo: faixa repete. Inativo: auto-next funciona normalmente
- [ ] Volume salvo no AsyncStorage e restaurado ao reabrir o app
- [ ] MiniPlayer mostra barra de progresso e botões Prev/Next em todas as telas
- [ ] Nenhum comportamento existente (pausa, retomada, troca de faixa manual) quebrado
