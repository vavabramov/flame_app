import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { type LocalDate, msUntilNextLocalMidnight, todayLocalDate } from './dates';

/**
 * The current local date. It updates at local midnight and whenever the app
 * comes back to the foreground, which covers time-zone changes and long sleeps.
 */
export function useToday(): LocalDate {
  const [today, setToday] = useState(todayLocalDate);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      // A little slack so the timer fires safely after midnight.
      timer = setTimeout(() => {
        setToday(todayLocalDate());
        schedule();
      }, msUntilNextLocalMidnight(new Date()) + 1000);
    };
    schedule();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setToday(todayLocalDate());
        schedule();
      }
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
