import React from 'react';
import {useMusicPosition, useMusic} from './music-context';
import {useTheme} from './theme';
import {a11y} from './constants';
import {Icon} from './ui';
import {memo} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const fmtTime = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const MiniPlayerProgress = memo(function MiniPlayerProgress({ trackLabel, trackBpm, textColor3, txStyleXs, accent }) {
  const { position, duration } = useMusicPosition();
  const progressPct = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;
  return (
    <>
      <View style={{
        position:'absolute', bottom:0, left:0, right:0, height:2,
        backgroundColor:'rgba(128,128,128,0.15)',
        borderBottomLeftRadius:14, borderBottomRightRadius:14,
      }}>
        <View style={{
          width:`${progressPct}%`,
          height:'100%',
          backgroundColor: accent,
          borderBottomLeftRadius:14,
        }}/>
      </View>
      <Text style={[txStyleXs, { color: textColor3, marginTop:1 }]}>
        {duration > 0 ? `${fmtTime(position)} / ${fmtTime(duration)}` : `${trackBpm} · Lo-Fi`}
      </Text>
      {/* trackLabel não é usado aqui; serve só como key implícita */}
      {trackLabel ? null : null}
    </>
  );
});

const MiniPlayer = memo(function MiniPlayer() {
  const { C, T } = useTheme();
  const { playing, currentTrack, pause, resume, next, prev } = useMusic();
  const insets = useSafeAreaInsets();
  if (!currentTrack) return null;
  const miniBottom = 16 + insets.bottom;

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
      {/* Ícone */}
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: C.accentBg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="music" size={16} color={C.accent}/>
      </View>

      {/* Nome + tempo (tempo via subscriber isolado) */}
      <View style={{ flex: 1 }}>
        <Text style={[T.sm, { color: C.text, fontWeight:'700' }]} numberOfLines={1}>{currentTrack.name}</Text>
        <MiniPlayerProgress
          trackLabel={currentTrack.id}
          trackBpm={currentTrack.bpm}
          textColor3={C.text3}
          txStyleXs={T.xs}
          accent={C.accent}
        />
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
});


export {fmtTime, MiniPlayerProgress, MiniPlayer};
