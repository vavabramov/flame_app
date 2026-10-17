import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { LivingFlame } from '@/components/LivingFlame';
import { StreakHero } from '@/components/StreakHero';

const mocked = Reanimated as unknown as {
  useReducedMotion: jest.Mock;
  withRepeat: jest.Mock;
  cancelAnimation: jest.Mock;
};

beforeEach(() => {
  mocked.useReducedMotion.mockReturnValue(false);
  mocked.withRepeat.mockClear();
  mocked.cancelAnimation.mockClear();
});

describe('LivingFlame', () => {
  it.each([48, 72, 96])('renders a fixed %ipt box so it never shifts layout', async (size) => {
    await render(<LivingFlame size={size} />);
    const box = StyleSheet.flatten(screen.getByTestId('living-flame', { includeHiddenElements: true }).props.style);
    expect(box).toMatchObject({ width: size, height: size });
  });

  it('starts four looping layers when motion is allowed', async () => {
    await render(<LivingFlame />);
    expect(mocked.withRepeat).toHaveBeenCalledTimes(4);
    // Infinite, reversing loops.
    expect(mocked.withRepeat.mock.calls.every(([, count, reverse]) => count === -1 && reverse === true)).toBe(true);
  });

  it('with reduced motion, only the glow breathes and nothing moves', async () => {
    mocked.useReducedMotion.mockReturnValue(true);
    await render(<LivingFlame />);
    expect(mocked.withRepeat).toHaveBeenCalledTimes(1);
    const [, count, reverse, , reduceMotion] = mocked.withRepeat.mock.calls[0];
    expect([count, reverse, reduceMotion]).toEqual([-1, true, 'never']);
  });

  it('stays static when paused (screen not focused)', async () => {
    await render(<LivingFlame animate={false} />);
    expect(mocked.withRepeat).not.toHaveBeenCalled();
  });

  it('is hidden from screen readers', async () => {
    await render(<LivingFlame />);
    expect(screen.getByTestId('living-flame', { includeHiddenElements: true }).props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('StreakHero with the living flame', () => {
  it('keeps the streak number and an accessible summary', async () => {
    await render(<StreakHero leader={{ streak: 12, name: 'Read', icon: '📚' }} completedToday={1} scheduledToday={3} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByLabelText('Current streak: 12 in a row, Read')).toBeTruthy();
    expect(screen.getByText('1 of 3 completed')).toBeTruthy();
  });

  it('shows the welcome state without inventing a streak', async () => {
    await render(<StreakHero leader={null} completedToday={0} scheduledToday={0} />);
    expect(screen.getByText('Your consistency starts today')).toBeTruthy();
  });
});
