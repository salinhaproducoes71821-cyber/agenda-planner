import React from 'react';
import {useTheme} from './theme';
import {DIAS_LABELS, MESES, a11y, DIAS_SEMANA} from './constants';
import {TopBar, Icon, Ornament} from './ui';
import {EventModal} from './event-modal';
import {useEvents} from './events-context';
import {useLocalDay} from './use-local-day';
import {useMemo, useState, useEffect, useCallback} from 'react';
import {Alert, View, TouchableOpacity, Text, FlatList, ScrollView} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

function CalendarScreen({ onMenu }) {
  const { C, T } = useTheme();
  const { events, load, addEvent, editEvent, removeEvent } = useEvents();
  // Atualiza o destaque de hoje ao retomar o app e na virada do dia.
  const hojeStr = useLocalDay();
  const hojeInit = useMemo(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  }, []);
  const [ano,   setAno]   = useState(hojeInit.ano);
  const [mes,   setMes]   = useState(hojeInit.mes);
  const [sel,   setSel]   = useState(hojeStr);
  const [modal, setModal] = useState(false);
  const [edit,  setEdit]  = useState(null);

  const mesStr = `${ano}-${String(mes + 1).padStart(2, '0')}`;

  useEffect(() => { load(mesStr); }, [ano, mes, load]);

  // Index de eventos por data — calculado uma vez por mudança de `events`.
  // Substitui N×35 filtros lineares por N×35 lookups O(1) (ganho grande em CPU
  // e battery ao trocar mês ou abrir o calendário).
  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      if (!e?.data) continue;
      const arr = map.get(e.data);
      if (arr) arr.push(e);
      else map.set(e.data, [e]);
    }
    return map;
  }, [events]);

  const dayEvs = useMemo(() => {
    const arr = eventsByDate.get(sel);
    return arr ? [...arr].sort((a, b) => a.hora.localeCompare(b.hora)) : [];
  }, [eventsByDate, sel]);

  const changeMonth = useCallback((dir) => {
    setAno(a => {
      // Sem rerender duplo: combine em uma única atualização
      let mNew = mes + dir, aNew = a;
      if (mNew < 0)  { mNew = 11; aNew--; }
      if (mNew > 11) { mNew = 0;  aNew++; }
      setMes(mNew);
      return aNew;
    });
  }, [mes]);

  const handleSave = useCallback(async (payload) => {
    try {
      if (edit) await editEvent(edit.id, payload);
      else      await addEvent(payload);
    } catch (e) { Alert.alert('Erro', e.message); }
    setModal(false); setEdit(null);
  }, [edit, editEvent, addEvent]);

  const handleDel = useCallback(async (id) => {
    try { await removeEvent(id); } catch (e) { Alert.alert('Erro', e.message); }
    setModal(false); setEdit(null);
  }, [removeEvent]);

  const openModal = useCallback((e = null) => { setEdit(e); setModal(true); }, []);

  const fmtLabel = useCallback(() => {
    const [y, m, d] = sel.split('-');
    const dt = new Date(+y, +m - 1, +d);
    return `${DIAS_LABELS[dt.getDay()]}, ${d} de ${MESES[+m - 1]}`;
  }, [sel]);

  // Memoiza o grid: só muda quando ano/mês mudam (não a cada toque em outro dia)
  const cells = useMemo(() => {
    const arr = [];
    const first = new Date(ano, mes, 1).getDay();
    const dim   = new Date(ano, mes + 1, 0).getDate();
    const dip   = new Date(ano, mes, 0).getDate();
    for (let i = first - 1; i >= 0; i--) {
      const d  = dip - i;
      const pm = mes === 0 ? 12 : mes;
      const pa = mes === 0 ? ano - 1 : ano;
      arr.push({ day:d, ds:`${pa}-${String(pm).padStart(2,'0')}-${String(d).padStart(2,'0')}`, other:true });
    }
    for (let d = 1; d <= dim; d++) {
      arr.push({ day:d, ds:`${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, other:false });
    }
    const rem = (first + dim) % 7 === 0 ? 0 : 7 - (first + dim) % 7;
    for (let d = 1; d <= rem; d++) {
      const nm = mes === 11 ? 1  : mes + 2;
      const na = mes === 11 ? ano + 1 : ano;
      arr.push({ day:d, ds:`${na}-${String(nm).padStart(2,'0')}-${String(d).padStart(2,'0')}`, other:true });
    }
    return arr;
  }, [ano, mes]);

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
        keyExtractor={(item) => item.ds}
        scrollEnabled={false}
        removeClippedSubviews={false}
        style={{ backgroundColor:C.bg2, flexShrink:1 }}
        renderItem={({ item }) => {
          // Lookup O(1) no Map em vez de .filter() varrendo todo events.
          const dotsArr   = eventsByDate.get(item.ds);
          const dotsLen   = dotsArr ? dotsArr.length : 0;
          const isToday   = item.ds === hojeStr;
          const isSel     = item.ds === sel;
          // Dia da semana via parse de YYYY-MM-DD (uma alocação Date, sem string concat).
          const yearNum   = parseInt(item.ds.slice(0, 4), 10);
          const monthNum  = parseInt(item.ds.slice(5, 7), 10);
          const dw        = new Date(yearNum, monthNum - 1, item.day).getDay();
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
              {...a11y(`${item.day} ${MESES[mes]}`, `${dotsLen} evento(s)`)}
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
                {dotsLen > 0 && <View style={{ width:5, height:5, borderRadius:3, backgroundColor:C.accent }}/>}
                {dotsLen > 1 && <View style={{ width:5, height:5, borderRadius:3, backgroundColor:C.accent }}/>}
                {dotsLen > 2 && <View style={{ width:5, height:5, borderRadius:3, backgroundColor:C.accent }}/>}
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


export {CalendarScreen};
