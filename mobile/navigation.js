import React from 'react';
import {useTheme} from './theme';
import {useMusic} from './music-context';
import {SW, a11y} from './constants';
import {Ornament, Icon} from './ui';
import {createContext, useState, useContext, useRef, useEffect} from 'react';
import {useAuth} from './auth-context';
import {Animated, Easing, View, StyleSheet, TouchableWithoutFeedback, Text, TouchableOpacity, Image, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

const NavContext = createContext(null);

function NavProvider({ children }) {
  const [screen, setScreen] = useState('Calendario');
  return (
    <NavContext.Provider value={{ screen, navigate: setScreen }}>
      {children}
    </NavContext.Provider>
  );
}

const useNav = () => useContext(NavContext);

function Drawer({ visible, onClose }) {
  const { navigate, screen } = useNav();
  const { currentUser, logout } = useAuth();
  const { C, T } = useTheme();
  const { playing } = useMusic();
  const drawerW = SW * 0.78;
  const anim         = useRef(new Animated.Value(-drawerW)).current;
  const overlayAnim  = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(false);

  // Monta o componente antes de animar a abertura
  useEffect(() => {
    if (visible && !rendered) setRendered(true);
  }, [visible]);

  // Anima abertura/fechamento após montar
  useEffect(() => {
    if (!rendered) return;
    if (visible) {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: -drawerW,
          duration: 230,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 210,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, rendered]);

  const navItems = [
    { name:'Calendario', label:'Calendário',   iconName:'calendar' },
    { name:'Cronograma', label:'Cronograma',   iconName:'schedule' },
    { name:'Notas',      label:'Notas',        iconName:'notes'    },
    { name:'Humor',      label:'Humor',        iconName:'mood'     },
    { name:'Musica',     label:'Música Lo-Fi', iconName:'music'    },
    { name:'Config',     label:'Personalizar', iconName:'settings' },
  ];

  const initials = currentUser?.name
    ? currentUser.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : '?';

  if (!rendered) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor:'rgba(0,0,0,0.65)', opacity: overlayAnim }]}/>
      </TouchableWithoutFeedback>

      <Animated.View style={{
        position:'absolute', left:0, top:0, bottom:0, width:drawerW,
        backgroundColor:C.bg2, zIndex:100, elevation:20,
        borderRightWidth:1, borderRightColor:C.border2,
        transform:[{ translateX:anim }],
      }}>
        <SafeAreaView edges={['top','bottom']} style={{ flex:1 }}>
          {/* Header */}
          <View style={{ padding:24, paddingBottom:16 }}>
            <Text style={[T.h2, { color:C.accent, letterSpacing:1.5 }]}>AGENDA</Text>
            <Text style={[T.caption, { color:C.text3, letterSpacing:2.5, marginTop:2 }]}>SEU TEMPO, ORGANIZADO</Text>
          </View>

          <Ornament style={{ marginHorizontal:16, marginBottom:14 }}/>

          {/* Perfil */}
          <TouchableOpacity
            style={{ flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingBottom:14 }}
            onPress={() => { navigate('Config'); onClose(); }}
            {...a11y('Perfil', 'Abrir configurações de perfil')}
          >
            {currentUser?.avatar
              ? <Image source={{ uri: currentUser.avatar }} style={{ width:48, height:48, borderRadius:24, borderWidth:1.5, borderColor:C.accent }}/>
              : (
                <View style={{
                  width:48, height:48, borderRadius:24,
                  backgroundColor:C.accentBg,
                  borderWidth:1.5, borderColor:C.accent,
                  alignItems:'center', justifyContent:'center',
                }}>
                  <Text style={[T.lg, { color:C.accent, fontWeight:'700' }]}>{initials}</Text>
                </View>
              )
            }
            <View style={{ flex:1 }}>
              <Text style={[T.base, { color:C.text, fontWeight:'700' }]}>{currentUser?.name || 'Usuário'}</Text>
              <Text style={[T.caption, { color:C.text3, marginTop:1 }]}>{currentUser?.email || ''}</Text>
            </View>
            <Icon name="chevronRight" size={14} color={C.text3}/>
          </TouchableOpacity>

          <Ornament style={{ marginHorizontal:16, marginBottom:12 }}/>

          {/* Itens de nav */}
          <ScrollView style={{ flex:1, paddingHorizontal:10 }}>
            {navItems.map(item => {
              const active = screen === item.name;
              return (
                <TouchableOpacity
                  key={item.name}
                  style={{
                    flexDirection:'row', alignItems:'center', gap:14,
                    paddingVertical:13, paddingHorizontal:14,
                    borderRadius:10, marginBottom:2,
                    backgroundColor: active ? C.accentBg : 'transparent',
                    borderWidth: active ? 1 : 0,
                    borderColor: C.border2,
                    minHeight: 48,
                  }}
                  onPress={() => { navigate(item.name); onClose(); }}
                  {...a11y(item.label, `Ir para ${item.label}`)}
                >
                  <Icon name={item.iconName} size={17} color={active ? C.accent : C.text3}/>
                  <Text style={[T.base, { flex:1, fontWeight: active ? '700' : '500', color: active ? C.accent : C.text2 }]}>
                    {item.label}
                  </Text>
                  {item.name === 'Musica' && playing && (
                    <View style={{ width:8, height:8, borderRadius:4, backgroundColor:C.accent }}/>
                  )}
                  {active && <Text style={{ fontSize:8, color:C.accent }} accessibilityElementsHidden>●</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Ornament style={{ marginHorizontal:16, marginVertical:10 }}/>

          <TouchableOpacity
            style={{ flexDirection:'row', alignItems:'center', gap:12, padding:16, marginBottom:8, minHeight:48 }}
            onPress={() => { logout(); onClose(); }}
            {...a11y('Sair da conta', 'Encerra a sessão atual')}
          >
            <Icon name="logout" size={17} color={C.danger}/>
            <Text style={[T.base, { color:C.danger, fontWeight:'600' }]}>Sair da conta</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}


export {NavContext, NavProvider, useNav, Drawer};
