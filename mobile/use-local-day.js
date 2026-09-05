import {useEffect,useState} from 'react';
import {AppState} from 'react-native';
import {localDate} from './dates';
export function useLocalDay() {
  const [day,setDay] = useState(() => localDate());
  useEffect(() => {
    const update = () => setDay(localDate());
    const timer = setInterval(update,60000);
    const subscription = AppState.addEventListener('change',update);
    return () => {clearInterval(timer);subscription.remove();};
  }, []);
  return day;
}
