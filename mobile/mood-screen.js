import React from 'react';
import {useTheme} from './theme';
import {TopBar, Ornament} from './ui';
import {HUMOR_LEVELS, a11y} from './constants';
import {useState, useEffect} from 'react';
import api from './api-service';
import {localDate} from './dates';
import {useLocalDay} from './use-local-day';
import {Alert, View, ScrollView, Text, TouchableOpacity} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

function HumorScreen({ onMenu }) {
  const { C, T } = useTheme();
  const [historico, setHistorico] = useState([]);
  const [nivel,     setNivel]     = useState(0);
  const today = useLocalDay();

  useEffect(() => {
    let mounted = true;
    setNivel(0);
    api.getMoods(14).then(data => {
      if (!mounted) return;
      setHistorico(data);
      const entry = data.find(h => h.data === today);
      setNivel(entry?.nivel || 0);
    }).catch(() => {});
    return () => {mounted = false;};
  }, [today]);

  const selectHumor = async (n) => {
    setNivel(n);
    const ts = localDate();
    try {
      await api.saveMood(n, ts);
      setHistorico(prev => {
        const others = prev.filter(h => h.data !== ts);
        return [...others, { data: ts, nivel: n }].sort((a, b) => a.data.localeCompare(b.data));
      });
    } catch (error) { Alert.alert('Humor', error.message); setNivel(0); }
  };

  const avg = historico.filter(h => h.nivel > 0).reduce((s, h, _, a) => s + h.nivel / a.length, 0);

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <TopBar onMenuPress={onMenu} title="Humor" subtitle="Acompanhamento de bem-estar"/>
      <ScrollView contentContainerStyle={{ padding:16, gap:16, paddingBottom:120 }}>

        {/* Seletor */}
        <View style={{ backgroundColor:C.bg2, borderRadius:14, borderWidth:1, borderColor:C.border2, padding:20 }}>
          <Text style={[T.label, { color:C.text3, marginBottom:18, textAlign:'center' }]}>COMO VOCÊ ESTÁ HOJE?</Text>
          <View style={{ flexDirection:'row', gap:6 }}>
            {HUMOR_LEVELS.map(({ nivel:n, humorIcon, label, color }) => {
              const sel = nivel === n;
              return (
                <TouchableOpacity key={n}
                  style={{
                    flex:1, paddingVertical:16, borderRadius:12,
                    borderWidth:2,
                    backgroundColor: sel ? color + '25' : C.bg3,
                    borderColor: sel ? color : C.border,
                    alignItems:'center', gap:6,
                    transform:[{ translateY: sel ? -5 : 0 }],
                  }}
                  onPress={() => selectHumor(n)}
                  {...a11y(`Humor ${label}`, sel ? 'Selecionado' : 'Selecionar')}
                >
                  <Ionicons name={humorIcon} size={28} color={sel ? color : C.text3}/>
                  <Text style={[T.caption, { fontWeight:'700', color: sel ? color : C.text3, letterSpacing:0.3 }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {nivel > 0 && (
            <>
              <Ornament style={{ marginTop:16, marginBottom:12 }}/>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 }}>
                <Ionicons name={HUMOR_LEVELS[nivel - 1]?.humorIcon} size={18} color={HUMOR_LEVELS[nivel - 1]?.color}/>
                <Text style={[T.base, { color:C.text2 }]}>
                  {HUMOR_LEVELS[nivel - 1]?.label} — registrado hoje
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Média */}
        {avg > 0 && (
          <View style={{ backgroundColor:C.bg2, borderRadius:14, borderWidth:1, borderColor:C.border2, padding:16, flexDirection:'row', alignItems:'center', gap:14 }}>
            <View style={{
              width:56, height:56, borderRadius:28,
              backgroundColor: HUMOR_LEVELS[Math.round(avg) - 1]?.color + '25',
              alignItems:'center', justifyContent:'center',
            }}>
              <Ionicons
                name={HUMOR_LEVELS[Math.round(avg) - 1]?.humorIcon || 'happy-outline'}
                size={26}
                color={HUMOR_LEVELS[Math.round(avg) - 1]?.color}
              />
            </View>
            <View style={{ flex:1 }}>
              <Text style={[T.caption, { color:C.text3, marginBottom:3 }]}>MÉDIA DOS ÚLTIMOS 14 DIAS</Text>
              <Text style={[T.h3, { color:C.text }]}>{avg.toFixed(1)} — {HUMOR_LEVELS[Math.round(avg) - 1]?.label}</Text>
            </View>
          </View>
        )}

        {/* Gráfico */}
        <View style={{ backgroundColor:C.bg2, borderRadius:14, borderWidth:1, borderColor:C.border2, padding:18 }}>
          <Text style={[T.label, { color:C.text3, marginBottom:16 }]}>ÚLTIMOS 14 DIAS</Text>
          <View style={{
            height:100, flexDirection:'row', alignItems:'flex-end', gap:3,
            borderBottomWidth:1, borderBottomColor:C.border,
          }}>
            {historico.map((entry, i) => {
              const h  = entry.nivel ? (entry.nivel / 5) * 96 : 4;
              const cl = entry.nivel ? HUMOR_LEVELS[entry.nivel - 1]?.color : C.border2;
              return (
                <View key={i} style={{ flex:1, alignItems:'center', justifyContent:'flex-end' }}>
                  <View style={{ width:'80%', borderRadius:4, height:h, minHeight:4, backgroundColor:cl }}/>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection:'row', gap:3, marginTop:4 }}>
            {historico.map((entry, i) => {
              const d = new Date(entry.data + 'T00:00:00');
              return (
                <View key={i} style={{ flex:1, alignItems:'center' }}>
                  <Text style={{ color:C.text3, fontSize:9 }}>{d.getDate()}</Text>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection:'row', justifyContent:'center', gap:14, marginTop:12 }}>
            {HUMOR_LEVELS.map(({ nivel:n, humorIcon, color }) => (
              <View key={n} style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
                <View style={{ width:8, height:8, borderRadius:4, backgroundColor:color }}/>
                <Ionicons name={humorIcon} size={14} color={color}/>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}


export {HumorScreen};
