import React, {createContext, useContext, useState, useEffect, useRef, useCallback} from 'react';
import { AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase, AUTH_STORAGE_KEY} from './supabase';
import {secureStorage} from './secure-storage';
import {getAvatar, saveAvatar} from './avatar';
import {setNotificationSession} from './notifications';
import api from './api-service';

const AuthContext = createContext(null);
const profileKey = uid => `@ag_profile_${uid}`;
const authError = error => new Error(error?.message || 'Não foi possível autenticar.');
export function AuthProvider({children}) {
  const [currentUser,setCurrentUser] = useState(null);
  const [isLoading,setIsLoading] = useState(true);
  const active = useRef({uid:null, version:0});
  const job = useRef(null);
  const authEvent = useRef(0);
  const activate = useCallback(session => {
    const uid = session?.user?.id || null;
    if (job.current?.uid === uid && active.current.uid === uid) return job.current.promise;
    const version = ++active.current.version;
    active.current.uid = uid;
    setCurrentUser(null);
    const sessionReady = uid ? api.setSession(uid) : api.clearSession();
    const notificationsReady = setNotificationSession(uid).catch(() => Alert.alert('Lembretes','Não foi possível atualizar os lembretes do aparelho.'));
    const promise = (async () => {
      await Promise.all([sessionReady, notificationsReady]);
      if (!uid) return;
      const cached = await AsyncStorage.getItem(profileKey(uid));
      const avatar = await getAvatar(uid);
      if (active.current.version !== version) return;
      if (cached) setCurrentUser({...JSON.parse(cached), id:uid, avatar});
      else setCurrentUser({id:uid, name:session.user.user_metadata?.name || '', email:session.user.email || '', avatar});
      try {
        const profile = await api.getMe();
        if (active.current.version !== version) return;
        const user = {...profile, avatar}; // photos are intentionally local to this device
        await AsyncStorage.setItem(profileKey(uid), JSON.stringify(user));
        if (active.current.version === version) setCurrentUser(user);
      } catch (error) {
        if (error.status === 401 && active.current.version === version) {
          active.current.uid = null;
          await api.clearSession();
          await setNotificationSession(null);
          setCurrentUser(null);
        }
      }
    })().catch(error => {
      if (active.current.version === version) job.current = null;
      throw error;
    }).finally(() => {
      if (active.current.version === version) {
        if (active.current.uid !== uid) job.current = null;
        setIsLoading(false);
      }
    });
    job.current = {uid,promise};
    return promise;
  }, []);
  useEffect(() => {
    let mounted = true;
    const initialEvent = authEvent.current;
    supabase.auth.getSession().then(({data}) => { if (mounted && authEvent.current === initialEvent) return activate(data.session); }).catch(() => setIsLoading(false));
    const {data} = supabase.auth.onAuthStateChange((event,session) => {
      if (event === 'PASSWORD_RECOVERY') return;
      const eventVersion = ++authEvent.current;
      // Invalidate the old account synchronously; SDK calls run after its auth lock exits.
      if (active.current.uid !== (session?.user?.id || null)) {
        active.current = {uid: session?.user?.id || null, version: active.current.version + 1};
        if (session) api.setSession(session.user.id).catch(() => {}); else api.clearSession();
        setCurrentUser(null);
        job.current = null;
      }
      setTimeout(() => { if (mounted && authEvent.current === eventVersion) activate(session).catch(() => setIsLoading(false)); },0);
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
    });
    return () => { mounted = false; data.subscription.unsubscribe(); appState.remove(); };
  }, [activate]);
  const login = async (email,password) => {
    const {data,error} = await supabase.auth.signInWithPassword({email,password});
    if (error) throw authError(error);
    await activate(data.session);
  };
  const register = async (name,email,password,confirm) => {
    if (password !== confirm) throw new Error('As senhas não coincidem.');
    const {data,error} = await supabase.auth.signUp({email,password,options:{data:{name:name.trim()}}});
    if (error) throw authError(error);
    if (!data.session) throw new Error('Conta criada! Confirme seu e-mail para entrar.');
    await activate(data.session);
  };
  const logout = async () => {
    authEvent.current++;
    active.current.uid = null; active.current.version++; job.current = null;
    setCurrentUser(null);
    await api.clearSession();
    try { await setNotificationSession(null); } catch { Alert.alert('Lembretes', 'Não foi possível cancelar todos os lembretes do aparelho.'); }
    try { await supabase.auth.signOut({scope:'local'}); } catch {}
    finally { await secureStorage.removeItem(AUTH_STORAGE_KEY); }
  };
  const updateProfile = async name => {
    const uid = active.current.uid, version = active.current.version;
    const updated = await api.updateProfile(name.trim());
    if (active.current.version !== version) return;
    const user = {...updated, avatar:await getAvatar(uid)};
    await AsyncStorage.setItem(profileKey(uid), JSON.stringify(user));
    if (active.current.version === version) setCurrentUser(user);
  };
  const updateAvatar = async uri => {
    const uid = active.current.uid, version = active.current.version;
    const avatar = await saveAvatar(uid,uri);
    if (active.current.version === version) setCurrentUser(user => ({...user,avatar}));
  };
  const requestPasswordReset = async email => {
    const {error} = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw authError(error);
  };
  const confirmPasswordReset = async (email,token,password) => {
    const {data,error} = await supabase.auth.verifyOtp({email,token,type:'recovery'});
    if (error) throw authError(error);
    const result = await supabase.auth.updateUser({password});
    if (result.error) throw authError(result.error);
    await activate(data.session);
  };
  return <AuthContext.Provider value={{currentUser,isLoading,login,register,logout,updateProfile,updateAvatar,requestPasswordReset,confirmPasswordReset}}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
