import React from 'react';
import {useTheme} from './theme';
import {useMusic} from './music-context';
import {DIAS_LABELS, a11y, SW} from './constants';
import {TopBar, Icon} from './ui';
import {EventModal} from './event-modal';
import {useEvents} from './events-context';
import {useLocalDay} from './use-local-day';
import {useMemo, useState, useEffect, useRef, useCallback} from 'react';
import {localDate} from './dates';
import {Alert, View, TouchableOpacity, ScrollView, Text} from 'react-native';

const HOUR_H = 64;

const EVENT_OVERLAP_MINS = 50;

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
  const { currentTrack } = useMusic(); // p/ folga no fim da timeline quando o player está visível
  // Recalcula a semana quando muda o dia local.
  const today = useLocalDay();
  const { hojeHour, weekDays, mesStr } = useMemo(() => {
    const d0 = new Date();
    const days = Array.from({ length:7 }, (_, i) => {
      const d = new Date(d0);
      d.setDate(d0.getDate() + i);
      return { label:DIAS_LABELS[d.getDay()], num:d.getDate(), ds:localDate(d) };
    });
    return {
      hojeHour: d0.getHours() + d0.getMinutes() / 60,
      weekDays: days,
      mesStr: `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}`,
    };
  }, [today]);
  const [selDay, setSelDay] = useState(weekDays[0].ds);
  useEffect(() => setSelDay(today), [today]);
  const [modal,  setModal]  = useState(false);
  const [edit,   setEdit]   = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, (Math.floor(hojeHour) - 2) * HOUR_H), animated:true });
    }, 200);
    return () => clearTimeout(t);
  }, [selDay, hojeHour]);

  useEffect(() => { load(mesStr); }, [load, mesStr]);

  // Lookup de eventos do dia selecionado em O(eventos do dia) em vez de O(events)
  const dayEvs = useMemo(
    () => events.filter(e => e.data === selDay),
    [events, selDay]
  );
  // Layout side-by-side calculado uma vez por mudança de dia/eventos
  const dayLayout = useMemo(() => layoutDayEvents(dayEvs), [dayEvs]);

  const getTop = useCallback((hora) => {
    const [h, m] = hora.split(':').map(Number);
    return h * HOUR_H + (m / 60) * HOUR_H;
  }, []);

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

      <ScrollView ref={scrollRef} style={{ flex:1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: currentTrack ? 120 : 16 }}
      >
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
          {/* Trava no fim do dia: perto da meia-noite o ponto (10px) ultrapassava
              o limite inferior da timeline (24*HOUR_H). */}
          {selDay === weekDays[0].ds && (
            <View style={{
              position:'absolute', left:0, right:0,
              top: Math.min(hojeHour * HOUR_H, 24 * HOUR_H - 10),
              flexDirection:'row', alignItems:'center', zIndex:10,
            }}>
              <View style={{ width:10, height:10, borderRadius:5, backgroundColor:C.accent, marginLeft:-5 }}/>
              <View style={{ flex:1, height:2, backgroundColor:C.accent, opacity:0.9 }}/>
            </View>
          )}

          {(() => {
            const containerW = SW - 68;
            const COL_GAP = 3;
            return dayEvs.map(e => {
              const { col, totalCols } = dayLayout[e.id] || { col: 0, totalCols: 1 };
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


export {HOUR_H, EVENT_OVERLAP_MINS, layoutDayEvents, CronogramaScreen};
