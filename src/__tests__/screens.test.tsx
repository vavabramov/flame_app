/**
 * Smoke tests: every screen renders against a fake store, and the primary
 * actions are wired up. Domain rules are covered by the pure-logic tests.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import TodayScreen from '@/app/(tabs)/index';
import HabitsScreen from '@/app/(tabs)/habits';
import ProgressScreen from '@/app/(tabs)/progress';
import YouScreen from '@/app/(tabs)/you';
import NewHabitScreen from '@/app/habits/new';
import EditHabitScreen from '@/app/habits/[id]';
import OnboardingScreen from '@/app/onboarding';
import { type Habit } from '@/features/habits/habit.types';
import { summarizeStreak } from '@/features/streaks/streak-calculator';
import { DEFAULT_SETTINGS } from '@/features/settings/settings.repository';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('@/features/reminders/reminder.service', () => ({ openSystemSettings: jest.fn() }));

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: () => mockBack() },
  useLocalSearchParams: () => ({ id: 'read' }),
  useFocusEffect: () => undefined,
}));

let mockStore: Record<string, unknown> = {};
jest.mock('@/features/habits/habit-store', () => ({
  useHabitStore: () => mockStore,
  habitStartDate: (habit: { createdAt: string }) => habit.createdAt.slice(0, 10),
}));

const TODAY = '2024-01-10'; // Wednesday

const habit = (overrides: Partial<Habit>): Habit => ({
  id: 'read',
  name: 'Read 10 pages',
  icon: '📚',
  color: '#FF8737',
  scheduleDays: [0, 1, 2, 3, 4, 5, 6],
  reminderTime: null,
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2024-01-01T12:00:00.000Z',
  archivedAt: null,
  ...overrides,
});

function makeStore(habits: Habit[], completed: Record<string, string[]> = {}) {
  const completions = new Map(Object.entries(completed).map(([id, dates]) => [id, new Set(dates)]));
  const stats = new Map(
    habits.map((h) => [
      h.id,
      summarizeStreak(
        { scheduleDays: h.scheduleDays, startDate: h.createdAt.slice(0, 10), completedDates: completions.get(h.id) ?? [] },
        TODAY,
      ),
    ]),
  );
  return {
    status: 'ready',
    today: TODAY,
    habits,
    activeHabits: habits.filter((h) => h.archivedAt === null),
    archivedHabits: habits.filter((h) => h.archivedAt !== null),
    completions,
    stats,
    settings: { ...DEFAULT_SETTINGS, onboardingCompleted: true },
    reminders: { permission: 'undetermined', overflow: 0, error: null },
    toggleToday: jest.fn(),
    createHabit: jest.fn(async () => habits[0]),
    updateHabit: jest.fn(async () => habits[0]),
    setHabitArchived: jest.fn(async () => undefined),
    updateSettings: jest.fn(async () => undefined),
    refreshReminderPermission: jest.fn(async () => 'undetermined'),
    requestReminders: jest.fn(async () => 'granted'),
  };
}

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
});

describe('Today', () => {

  it('shows the first-habit empty state and opens the create modal', async () => {
    mockStore = makeStore([]);
    await render(<TodayScreen />);
    expect(screen.getByText('Your consistency starts today')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Create your first habit' }));
    expect(mockPush).toHaveBeenCalledWith('/habits/new');
  });

  it('shows streak, progress and checks in with one tap', async () => {
    const run = habit({});
    const rest = habit({ id: 'gym', name: 'Gym', icon: '💪', scheduleDays: [1, 5] }); // not Wednesday
    mockStore = makeStore([run, rest], { read: ['2024-01-08', '2024-01-09'] });
    await render(<TodayScreen />);

    expect(screen.getByText('0 of 1 completed')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // hero streak, kept alive while today is open
    expect(screen.queryByText('Gym')).toBeNull(); // not scheduled today
    expect(screen.getByText('1 habit isn’t scheduled today.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('checkbox', { name: /Read 10 pages/ }));
    expect(mockStore.toggleToday).toHaveBeenCalledWith('read');
  });

  it('celebrates when everything is done', async () => {
    mockStore = makeStore([habit({})], { read: ['2024-01-10'] });
    await render(<TodayScreen />);
    expect(screen.getByText('All 1 done today. Nicely kept.')).toBeTruthy();
  });
});

describe('Habits', () => {

  it('lists active habits and keeps archived ones restorable', async () => {
    mockStore = makeStore([habit({}), habit({ id: 'old', name: 'Old habit', archivedAt: '2024-01-05T00:00:00.000Z' })]);
    await render(<HabitsScreen />);
    expect(screen.getByText('Read 10 pages')).toBeTruthy();
    await fireEvent.press(screen.getByText('Archived (1)'));
    await fireEvent.press(screen.getByRole('button', { name: 'Restore' }));
    expect(mockStore.setHabitArchived).toHaveBeenCalledWith('old', false);
  });
});

describe('Progress', () => {

  it('shows streaks, rates and the calendar for the selected habit', async () => {
    mockStore = makeStore([habit({})], { read: ['2024-01-08', '2024-01-09'] });
    await render(<ProgressScreen />);
    expect(screen.getByLabelText('Current streak: 2, in a row')).toBeTruthy();
    // Jan 4–9 scheduled and elapsed (today open): 2 of 6.
    expect(screen.getByText('2 of 6 scheduled days')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
  });

  it('has an empty state with no habits', async () => {
    mockStore = makeStore([]);
    await render(<ProgressScreen />);
    expect(screen.getByText('No progress to show yet')).toBeTruthy();
  });
});

describe('You', () => {

  it('renders totals, milestones and preferences', async () => {
    mockStore = makeStore([habit({})], { read: ['2024-01-08', '2024-01-09'] });
    await render(<YouScreen />);
    expect(screen.getByText('5 more check-ins to reach 7. Check-ins across all habits count.')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Haptic feedback'), 'valueChange', false);
    expect(mockStore.updateSettings).toHaveBeenCalledWith({ hapticsEnabled: false });
  });
});

describe('Habit form', () => {

  it('validates, then creates a trimmed habit', async () => {
    mockStore = makeStore([]);
    await render(<NewHabitScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Give your habit a name.')).toBeTruthy();
    expect(mockStore.createHabit).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Habit name'), '  Stretch  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Save' });
    expect(mockStore.createHabit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Stretch' }));
  });

  it('asks for notification permission only when a reminder is turned on', async () => {
    mockStore = makeStore([]);
    await render(<NewHabitScreen />);
    expect(mockStore.requestReminders).not.toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('Daily reminder'), 'valueChange', true);
    await screen.findByLabelText(/Reminder time/);
    expect(mockStore.requestReminders).toHaveBeenCalledTimes(1);
  });

  it('edits an existing habit and offers archiving', async () => {
    mockStore = makeStore([habit({})]);
    await render(<EditHabitScreen />);
    expect(screen.getByDisplayValue('Read 10 pages')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archive habit' })).toBeTruthy();
  });
});

describe('Onboarding', () => {

  it('completes onboarding with Get started', async () => {
    mockStore = makeStore([]);
    await render(<OnboardingScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(mockStore.updateSettings).toHaveBeenCalledWith({ onboardingCompleted: true });
  });
});
