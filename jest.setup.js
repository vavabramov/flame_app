// Reanimated's bundled mock doesn't initialize under this SDK's Jest setup, so
// fake only the APIs the app uses. Animations are visual-only; tests cover state.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const sharedValue = (initial) => {
    let value = initial;
    return { get: () => value, set: (next) => (value = next) };
  };
  return {
    __esModule: true,
    default: { View },
    useSharedValue: sharedValue,
    useAnimatedStyle: (factory) => factory(),
    useReducedMotion: () => false,
    withSequence: (...steps) => steps[steps.length - 1],
    withSpring: (to) => to,
    withTiming: (to) => to,
  };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
