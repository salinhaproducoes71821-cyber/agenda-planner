import React from 'react';
import {useTheme} from './theme';
import {useMusic, useMusicPosition} from './music-context';
import {TopBar, Icon, TrackSlider} from './ui';
import {fmtTime} from './mini-player';
import {a11y, LOFI_TRACKS} from './constants';
import {View, ScrollView, Text, TouchableOpacity} from 'react-native';

function MusicaScreen({ onMenu }) {
  const { C, T } = useTheme();
  const { playing, currentTrack, volume, setVolume, play, pause, resume, stop, next, prev, looping, setLooping, seekTo } = useMusic();
  const { position, duration } = useMusicPosition();

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


export {MusicaScreen};
