import React from 'react';
import {useNav, Drawer, NavProvider} from './navigation';
import {useTheme, ThemeProvider} from './theme';
import {CalendarScreen} from './calendar-screen';
import {CronogramaScreen} from './schedule-screen';
import {NotasScreen} from './notes-screen';
import {HumorScreen} from './mood-screen';
import {MusicaScreen} from './music-screen';
import {ConfigScreen} from './settings-screen';
import {Icon} from './ui';
import {MiniPlayer} from './mini-player';
import {AuthScreen} from './auth-screen';
import {MusicProvider} from './music-context';
import * as Notifications from 'expo-notifications';
import {useEvents, EventsProvider} from './events-context';
import {useState, useEffect} from 'react';
import {useSafeAreaInsets, SafeAreaProvider} from 'react-native-safe-area-context';
import {View, Text, Platform, Image, ActivityIndicator} from 'react-native';
import {useAuth, AuthProvider} from './auth-context';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AppShell() {
  const { screen }              = useNav();
  const { C, T }                = useTheme();
  const { isOffline, syncError } = useEvents();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const renderScreen = () => {
    switch (screen) {
      case 'Calendario': return <CalendarScreen  onMenu={() => setDrawerOpen(true)}/>;
      case 'Cronograma': return <CronogramaScreen onMenu={() => setDrawerOpen(true)}/>;
      case 'Notas':      return <NotasScreen      onMenu={() => setDrawerOpen(true)}/>;
      case 'Humor':      return <HumorScreen      onMenu={() => setDrawerOpen(true)}/>;
      case 'Musica':     return <MusicaScreen     onMenu={() => setDrawerOpen(true)}/>;
      case 'Config':     return <ConfigScreen     onMenu={() => setDrawerOpen(true)}/>;
      default:           return <CalendarScreen   onMenu={() => setDrawerOpen(true)}/>;
    }
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg, overflow:'hidden', paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {(isOffline || syncError) && (
        <View style={{
          backgroundColor: C.warn + '22',
          borderBottomWidth: 1, borderBottomColor: C.warn + '55',
          paddingHorizontal: 16, paddingVertical: 6,
          flexDirection: 'row', alignItems: 'center', gap: 8,
        }}>
          <Icon name="bellOff" size={13} color={C.warn}/>
          <Text style={[T.caption, { color: C.warn, flex: 1, flexWrap: 'wrap' }]}>
            {syncError || 'Sem conexão — alterações salvas neste aparelho. Sincronização pendente.'}
          </Text>
        </View>
      )}
      {renderScreen()}
      <MiniPlayer/>
      <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)}/>
    </View>
  );
}

function Root() {
  const { currentUser, isLoading } = useAuth();
  const { C, T } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          // Um canal por som — o Android congela o som no momento da criação,
          // então cada opção precisa do seu próprio canal.
          const base = {
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
          };
          await Notifications.setNotificationChannelAsync('lembrete-classic', { name: 'Lembrete · Clássico', sound: 'classic.mp3', ...base });
          await Notifications.setNotificationChannelAsync('lembrete-piano',   { name: 'Lembrete · Piano',    sound: 'piano.mp3',   ...base });
          await Notifications.setNotificationChannelAsync('lembrete-birds',   { name: 'Lembrete · Pássaros', sound: 'birds.mp3',   ...base });
          await Notifications.setNotificationChannelAsync('lembrete-vibrate', { name: 'Lembrete · Vibração', sound: null, vibrationPattern: [0, 400, 200, 400], importance: Notifications.AndroidImportance.HIGH });
        }
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing !== 'granted') {
          const { status: asked } = await Notifications.requestPermissionsAsync();
          if (asked !== 'granted') return;
        }
      } catch (_) {}
    })();
  }, []);

  if (isLoading) return (
    <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center', gap:20 }}>
      <Image
        source={require('./LogoNovaCorEnovosHighlightsNovo.png')}
        style={{ width:100, height:100, borderRadius:20 }}
        resizeMode="contain"
      />
      <Text style={[T.h2, { color:C.accent, letterSpacing:2.5 }]}>AGENDA</Text>
      <ActivityIndicator color={C.accent} size="large"/>
    </View>
  );

  return currentUser
    ? <NavProvider key={currentUser.id}><EventsProvider><AppShell/></EventsProvider></NavProvider>
    : <AuthScreen/>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <MusicProvider>
            <Root/>
          </MusicProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}


export {AppShell, Root};
