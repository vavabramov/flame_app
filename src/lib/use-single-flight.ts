import { useRef } from 'react';

/**
 * Wraps an async action so it can't run twice at once. Uses a ref, not state,
 * so two taps in the same frame (before a re-render) still see the first call.
 */
export function useSingleFlight<Args extends unknown[]>(
  action: (...args: Args) => Promise<void>,
): (...args: Args) => Promise<void> {
  const busy = useRef(false);
  return async (...args: Args) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await action(...args);
    } finally {
      busy.current = false;
    }
  };
}
