import { act, renderHook } from '@testing-library/react-native';

import { useSingleFlight } from './use-single-flight';

describe('useSingleFlight', () => {
  it('ignores calls while one is in flight, then allows the next', async () => {
    let finish: () => void = () => undefined;
    const action = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result } = await renderHook(() => useSingleFlight(action));

    let first!: Promise<void>;
    await act(async () => {
      first = result.current();
      void result.current(); // same frame: ignored
      void result.current();
    });
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
      await first;
    });
    await act(async () => {
      void result.current();
    });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('releases the lock when the action fails', async () => {
    const action = jest.fn().mockRejectedValueOnce(new Error('nope')).mockResolvedValueOnce(undefined);
    const { result } = await renderHook(() => useSingleFlight(action));
    await act(async () => {
      await expect(result.current()).rejects.toThrow('nope');
    });
    await act(async () => {
      await result.current();
    });
    expect(action).toHaveBeenCalledTimes(2);
  });
});
