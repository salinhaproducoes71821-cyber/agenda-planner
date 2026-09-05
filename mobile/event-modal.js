import React from 'react';
import {useTheme} from './theme';
import {EVENT_COLORS, SOUND_ASSETS, SECURITY, a11y, ALARM_SOUNDS} from './constants';
import {useMusic} from './music-context';
import {Icon, Input, Btn} from './ui';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useState, useEffect, useRef, useCallback} from 'react';
import {Vibration, Alert, Modal, TouchableWithoutFeedback, View, KeyboardAvoidingView, Platform, Text, TouchableOpacity, ScrollView, Switch} from 'react-native';
import {createAudioPlayer} from 'expo-audio';
import {validDate, validTime} from './dates';

function EventModal({ visible, event, defaultDate, onSave, onDelete, onClose }) {
  const { C, T } = useTheme();
  const insets = useSafeAreaInsets();
  const [titulo,     setTitulo]     = useState('');
  const [data,       setData]       = useState('');
  const [hora,       setHora]       = useState('09:00');
  const [cor,        setCor]        = useState(EVENT_COLORS[0]);
  const [lembrete,   setLembrete]   = useState(false);
  const [alarmSound, setAlarmSound] = useState('classic');
  const [descricao,  setDescricao]  = useState('');

  useEffect(() => {
    if (visible) {
      setTitulo(event?.titulo      || '');
      setData(event?.data          || defaultDate || '');
      setHora(event?.hora          || '09:00');
      setCor(event?.cor            || EVENT_COLORS[0]);
      setLembrete(event?.lembrete  ?? false);
      setAlarmSound(['classic','piano','birds','vibrate'].includes(event?.alarmSound) ? event.alarmSound : 'classic');
      setDescricao(event?.descricao  || '');
    }
  }, [visible, event, defaultDate]);

  // ── Preview do som ao tocar numa opção ──────────────────────────────────────
  const { playing: musicPlaying, pause: pauseMusic, resume: resumeMusic } = useMusic();
  const previewRef         = useRef(null);
  const musicPausedByUsRef = useRef(false);

  // Para o áudio atual de fato: pause() ANTES de remove() — o remove() sozinho
  // não interrompe a reprodução, o que fazia os sons se sobreporem.
  const killAudio = useCallback(() => {
    const p = previewRef.current;
    previewRef.current = null;
    if (p) {
      try { p.pause(); } catch (_) {}
      try { p.remove(); } catch (_) {}
    }
    try { Vibration.cancel(); } catch (_) {}
  }, []);

  const stopPreview = useCallback(() => {
    killAudio();
    if (musicPausedByUsRef.current) {
      musicPausedByUsRef.current = false;
      try { resumeMusic(); } catch (_) {}
    }
  }, [killAudio, resumeMusic]);

  const playPreview = useCallback((id) => {
    // encerra o preview anterior (mantém a lo-fi pausada entre trocas de opção)
    killAudio();

    if (id === 'vibrate') {
      Vibration.vibrate([0, 400, 200, 400]);
      return;
    }
    const src = SOUND_ASSETS[id];
    if (!src) return;
    // pausa a lo-fi pra não sobrepor o preview (retomada ao fechar)
    if (musicPlaying && !musicPausedByUsRef.current) {
      musicPausedByUsRef.current = true;
      try { pauseMusic(); } catch (_) {}
    }
    try {
      const p = createAudioPlayer(src);
      p.volume = 1;
      p.play();
      previewRef.current = p;
    } catch (_) {}
  }, [killAudio, musicPlaying, pauseMusic]);

  // Para o preview ao fechar o modal, ao desligar o lembrete e ao desmontar
  useEffect(() => { if (!visible) stopPreview(); }, [visible, stopPreview]);
  useEffect(() => { if (!lembrete) stopPreview(); }, [lembrete, stopPreview]);
  useEffect(() => () => stopPreview(), [stopPreview]);

  const save = () => {
    if (!titulo.trim()) { Alert.alert('Aviso', 'Informe um título.'); return; }
    if (!data)          { Alert.alert('Aviso', 'Informe a data.');    return; }
    // CORREÇÃO: validação básica de formato de data e hora
    if (!validDate(data)) { Alert.alert('Aviso', 'Data no formato AAAA-MM-DD.'); return; }
    if (!validTime(hora))        { Alert.alert('Aviso', 'Hora no formato HH:MM.');    return; }
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
            <Input label="TÍTULO" value={titulo} maxLength={120} onChangeText={setTitulo} placeholder="Nome do evento" autoCapitalize="sentences"/>

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
              <Input label="DESCRIÇÃO (OPCIONAL)" value={descricao} maxLength={500} onChangeText={setDescricao} placeholder="Detalhes do evento..." autoCapitalize="sentences"/>
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
              <View style={{ marginTop:4, marginBottom:28 }}>
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
                    onPress={() => { setAlarmSound(s.id); playPreview(s.id); }}
                    {...a11y(s.name, s.id === 'vibrate' ? 'Tocar vibração de teste' : `Ouvir prévia · ${s.description}`)}
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

          <View style={{ flexDirection:'row', gap:10, paddingHorizontal:16, paddingTop:16, paddingBottom: 16 + insets.bottom, borderTopWidth:1, borderTopColor:C.border }}>
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


export {EventModal};
