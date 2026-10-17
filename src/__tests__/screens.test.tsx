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
  useIsFocused: () => true,
}));

let mockStore: Record<string, unknown> = {};
jest.mock('@/features/habits/habit-store', () => ({
  useHabitStore: () => mockStore,
  habitStartDate: (habit: { createdAt: string }) => habit.createdAt.slice(0, 10),
}));

const TODAY = '2024-01-10'; // Wednesday

const habit = (overrides: Partial<Habit>): Habit => ({
  id: 'read',
  type: 'build',
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

function makeStore(habits: Habit[], completed: Record<string, string[]> = {}, lapsed: Record<string, string[]> = {}) {
  const completions = new Map(Object.entries(completed).map(([id, dates]) => [id, new Set(dates)]));
  const lapses = new Map(Object.entries(lapsed).map(([id, dates]) => [id, new Set(dates)]));
  const stats = new Map(
    habits.map((h) => [
      h.id,
      summarizeStreak(
        {
          scheduleDays: h.scheduleDays,
          startDate: h.createdAt.slice(0, 10),
          completedDates: completions.get(h.id) ?? [],
          lapseDates: lapses.get(h.id) ?? [],
        },
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
    lapses,
    stats,
    settings: { ...DEFAULT_SETTINGS, onboardingCompleted: true },
    reminders: { permission: 'undetermined', overflow: 0, error: null },
    toggleToday: jest.fn(),
    toggleLapseToday: jest.fn(),
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

    expect(screen.getByText('Complete')).toBeTruthy();
    expect(screen.queryByText('Log a lapse')).toBeNull(); // Build habits have no lapse action
    await fireEvent.press(screen.getByRole('checkbox', { name: /Complete: Read 10 pages/ }));
    expect(mockStore.toggleToday).toHaveBeenCalledWith('read');
  });

  it('uses Break wording and offers a separate lapse action', async () => {
    mockStore = makeStore([habit({ id: 'scroll', type: 'break', name: 'No doomscrolling' })], {
      scroll: ['2024-01-08', '2024-01-09'],
    });
    await render(<TodayScreen />);
    expect(screen.getByText('Made it today')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Log a lapse for No doomscrolling' }));
    expect(mockStore.toggleLapseToday).toHaveBeenCalledWith('scroll');
    expect(mockStore.toggleToday).not.toHaveBeenCalled();
  });

  it('shows a neutral restart message after a lapse, with undo', async () => {
    mockStore = makeStore(
      [habit({ id: 'scroll', type: 'break', name: 'No doomscrolling' })],
      { scroll: ['2024-01-08', '2024-01-09'] },
      { scroll: ['2024-01-10'] },
    );
    await render(<TodayScreen />);
    expect(screen.getByText('Lapse noted. Tomorrow is a fresh start.')).toBeTruthy();
    expect(screen.queryByText('Made it today')).toBeNull();
    expect(screen.queryByText(/fail/i)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo lapse for No doomscrolling' }));
    expect(mockStore.toggleLapseToday).toHaveBeenCalledWith('scroll');
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

  it('shows the activity heatmap, and tapping a day reveals its date and status', async () => {
    mockStore = makeStore([habit({})], { read: ['2024-01-08', '2024-01-09'] });
    await render(<ProgressScreen />);
    // Jan 1 (start) to Jan 9 elapsed, today open: 2 of 9.
    expect(screen.getByText('2 of 9 scheduled days completed')).toBeTruthy();
    expect(screen.getByTestId('day-detail')).toHaveTextContent(/Wednesday, January 10, 2024.*Today, not checked in yet/);

    await fireEvent.press(screen.getByRole('button', { name: 'Tuesday, January 9: completed' }));
    expect(screen.getByTestId('day-detail')).toHaveTextContent(/Tuesday, January 9, 2024.*Scheduled · Completed/);

    await fireEvent.press(screen.getByRole('button', { name: 'Thursday, December 28: before this habit started' }));
    expect(screen.getByTestId('day-detail')).toHaveTextContent(/Before this habit started/);
  });

  it('labels Break habit days as made it, with lapses', async () => {
    mockStore = makeStore(
      [habit({ id: 'scroll', type: 'break', name: 'No doomscrolling' })],
      { scroll: ['2024-01-08'] },
      { scroll: ['2024-01-09'] },
    );
    await render(<ProgressScreen />);
    expect(screen.getByText('1 of 9 scheduled days made it through')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Monday, January 8: made it' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tuesday, January 9: lapse logged' }));
    expect(screen.getByTestId('day-detail')).toHaveTextContent(/Lapse logged/);
    expect(screen.getAllByText('Lapse')).toHaveLength(2); // heatmap and month legends
  });

  it('explains instead of showing an empty grid for a brand-new habit', async () => {
    mockStore = makeStore([habit({ createdAt: '2024-01-10T12:00:00.000Z' })]);
    await render(<ProgressScreen />);
    expect(screen.getByText('Your activity grid starts with your first check-in')).toBeTruthy();
    expect(screen.queryByTestId('day-detail')).toBeNull();
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

  it('lets you choose Break and saves it', async () => {
    mockStore = makeStore([]);
    await render(<NewHabitScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: /^Break\./ }));
    expect(screen.getByPlaceholderText('e.g. No phone after 11 pm')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Habit name'), 'No phone after 11 pm');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Save' });
    expect(mockStore.createHabit).toHaveBeenCalledWith(expect.objectContaining({ type: 'break' }));
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
