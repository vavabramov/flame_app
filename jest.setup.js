// Reanimated's bundled mock doesn't initialize under this SDK's Jest setup, so
// fake only the APIs the app uses. Animations are visual-only; tests cover state
// and which animations get started.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const sharedValue = (initial) => {
    let value = initial;
    return { get: () => value, set: (next) => (value = next) };
  };
  const identity = (x) => x;
  return {
    __esModule: true,
    default: { View },
    useSharedValue: sharedValue,
    useAnimatedStyle: (factory) => factory(),
    useReducedMotion: jest.fn(() => false),
    withSequence: (...steps) => steps[steps.length - 1],
    withSpring: identity,
    withTiming: identity,
    withDelay: (_delay, animation) => animation,
    withRepeat: jest.fn(identity),
    cancelAnimation: jest.fn(),
    Easing: { inOut: () => identity, sin: identity },
  };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
