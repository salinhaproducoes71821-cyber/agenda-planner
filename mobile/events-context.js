import React, {createContext,useContext,useState,useEffect,useCallback,useRef} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {Alert, AppState} from 'react-native';
import api from './api-service';
import {reconcileNotifications} from './notifications';

const EventsContext = createContext(null);
export function EventsProvider({children}) {
  const [events,setEvents] = useState([]);
  const [isOffline,setIsOffline] = useState(false);
  const [syncError,setSyncError] = useState('');
  const mounted = useRef(true);
  const scheduled = useRef(null);
  const refresh = useCallback(async () => {
    const [items,queue] = await Promise.all([api.getLocal('events'),api.getQueue()]);
    if (!mounted.current) return;
    setEvents(items);
    setSyncError(queue.find(op => op.error)?.error || '');
    const signature = JSON.stringify(items.map(({_offline,...event}) => event));
    if (scheduled.current !== signature) {
      scheduled.current = signature;
      try { await reconcileNotifications(items); }
      catch (error) { if (scheduled.current === signature) scheduled.current = null; throw error; }
    }
  }, []);
  const load = useCallback(async () => {
    try {
      await api.flushQueue();
      await api.getEvents();
      await refresh();
    } catch (error) { if (mounted.current) setSyncError(error.message); }
  }, [refresh]);
  useEffect(() => {
    mounted.current = true;
    const off = api.subscribe(() => refresh().catch(() => {}));
    let wasOffline = true;
    const net = NetInfo.addEventListener(state => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      if (wasOffline && !offline) load();
      wasOffline = offline;
    });
    const appState = AppState.addEventListener('change', state => {if (state === 'active') load();});
    refresh().catch(() => {});
    return () => {mounted.current = false;off();net();appState.remove();};
  }, [refresh,load]);
  const mutate = async (operation,...args) => {
    const result = await operation(...args);
    await refresh().catch(() => Alert.alert('Lembretes','Alteração salva. Confira a permissão de notificações.'));
    return result;
  };
  return <EventsContext.Provider value={{events,isOffline,syncError,load,
    addEvent:data => mutate(api.createEvent,data), editEvent:(id,data) => mutate(api.updateEvent,id,data), removeEvent:id => mutate(api.deleteEvent,id)}}>{children}</EventsContext.Provider>;
}
export const useEvents = () => useContext(EventsContext);
