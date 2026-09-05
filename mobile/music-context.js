import React from 'react';
import {LOFI_TRACKS} from './constants';
import {createContext, useState, useRef, useCallback, useEffect, useMemo, useContext} from 'react';
import {setAudioModeAsync, createAudioPlayer} from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert} from 'react-native';

const MusicContext = createContext(null);

function MusicProvider({ children }) {
  const [playing,      setPlaying]      = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [volume,       setVolume]       = useState(0.6);
  const [looping,      setLooping]      = useState(false);

  const playerRef       = useRef(null);
  const seekingRef      = useRef(false);
  const currentTrackRef = useRef(null);
  const loopingRef      = useRef(false);

  // Subscribers de posição/duração (não disparam re-render do provider)
  const positionRef   = useRef(0);
  const durationRef   = useRef(0);
  const subsRef       = useRef(new Set());
  const notifyPos = useCallback(() => {
    const p = positionRef.current, d = durationRef.current;
    subsRef.current.forEach(fn => { try { fn(p, d); } catch (_) {} });
  }, []);
  const subscribePosition = useCallback((fn) => {
    subsRef.current.add(fn);
    // Entrega valor atual imediatamente para evitar piscar 0:00
    try { fn(positionRef.current, durationRef.current); } catch (_) {}
    return () => { subsRef.current.delete(fn); };
  }, []);

  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { loopingRef.current = looping; }, [looping]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
    AsyncStorage.getItem('@ag_music_volume').then(v => {
      if (v !== null) setVolume(parseFloat(v));
    }).catch(() => {});
    return () => {
      try { playerRef.current?.remove(); } catch (_) {}
      playerRef.current = null;
      subsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (playerRef.current) playerRef.current.volume = volume;
    AsyncStorage.setItem('@ag_music_volume', String(volume)).catch(() => {});
  }, [volume]);

  // Listener de status — refs + subscribers, sem setState em loop de 1s.
  const handleStatus = useCallback((s) => {
    if (!s.isLoaded) return;
    if (seekingRef.current) return;
    positionRef.current = s.currentTime || 0;
    if (s.duration) durationRef.current = s.duration;
    notifyPos();
    if (s.didJustFinish) {
      setPlaying(false);
      positionRef.current = 0;
      notifyPos();
      if (loopingRef.current) {
        playerRef.current?.seekTo(0)
          .then(() => { playerRef.current?.play(); setPlaying(true); })
          .catch(() => {});
      } else {
        const cur = currentTrackRef.current;
        if (cur) {
          const idx = LOFI_TRACKS.findIndex(t => t.id === cur.id);
          const nt = LOFI_TRACKS[(idx + 1) % LOFI_TRACKS.length];
          playerRef.current?.replace({ uri: nt.url });
          playerRef.current?.play();
          setCurrentTrack(nt); currentTrackRef.current = nt;
          positionRef.current = 0; durationRef.current = 0;
          notifyPos();
          setPlaying(true);
        }
      }
    }
  }, [notifyPos]);

  const play = useCallback(async (track) => {
    try {
      if (!playerRef.current) {
        // 1000ms em vez de 500ms — metade do trabalho de status update
        const p = createAudioPlayer({ uri: track.url }, { updateInterval: 1000 });
        p.volume = volume;
        p.addListener('playbackStatusUpdate', handleStatus);
        playerRef.current = p;
      } else {
        playerRef.current.replace({ uri: track.url });
      }
      playerRef.current.volume = volume;
      playerRef.current.play();
      setCurrentTrack(track);
      setPlaying(true);
      positionRef.current = 0; durationRef.current = 0;
      notifyPos();
    } catch (_) {
      Alert.alert('Erro', 'Não foi possível reproduzir esta faixa.');
    }
  }, [volume, handleStatus, notifyPos]);

  const pause  = useCallback(() => { playerRef.current?.pause(); setPlaying(false); }, []);
  const resume = useCallback(() => { playerRef.current?.play();  setPlaying(true);  }, []);
  const stop   = useCallback(() => {
    try { playerRef.current?.pause(); } catch (_) {}
    setPlaying(false); setCurrentTrack(null);
    currentTrackRef.current = null;
    positionRef.current = 0; durationRef.current = 0;
    notifyPos();
  }, [notifyPos]);

  const seekTo = useCallback(async (secs) => {
    try {
      seekingRef.current = true;
      await playerRef.current?.seekTo(secs);
      seekingRef.current = false;
      positionRef.current = secs;
      notifyPos();
    } catch (_) { seekingRef.current = false; }
  }, [notifyPos]);

  const next = useCallback(async () => {
    if (!currentTrackRef.current) return;
    const idx = LOFI_TRACKS.findIndex(t => t.id === currentTrackRef.current.id);
    await play(LOFI_TRACKS[(idx + 1) % LOFI_TRACKS.length]);
  }, [play]);

  const prev = useCallback(async () => {
    if (!currentTrackRef.current) return;
    if (positionRef.current > 3) { await seekTo(0); return; }
    const idx = LOFI_TRACKS.findIndex(t => t.id === currentTrackRef.current.id);
    await play(LOFI_TRACKS[(idx - 1 + LOFI_TRACKS.length) % LOFI_TRACKS.length]);
  }, [play, seekTo]);

  // Valor do contexto estável quando nada muda — useMemo evita recriar objeto
  // novo a cada render (que invalidaria React.memo de consumidores).
  const value = useMemo(() => ({
    playing, currentTrack, volume, setVolume,
    play, pause, resume, stop, next, prev,
    looping, setLooping,
    subscribePosition, seekTo,
  }), [playing, currentTrack, volume, looping, play, pause, resume, stop, next, prev, subscribePosition, seekTo]);

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

const useMusic = () => useContext(MusicContext);

function useMusicPosition() {
  const ctx = useContext(MusicContext);
  const [pd, setPd] = useState({ position: 0, duration: 0 });
  useEffect(() => {
    if (!ctx?.subscribePosition) return;
    return ctx.subscribePosition((position, duration) => setPd({ position, duration }));
  }, [ctx?.subscribePosition]);
  return pd;
}


export {MusicContext, MusicProvider, useMusic, useMusicPosition};
