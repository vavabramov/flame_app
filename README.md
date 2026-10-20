# FLAME

A calm, dark-mode habit tracker built around personal streaks. **Build** habits you want to do
more often, or **break** habits you want to stop. Check in with one tap, watch your streak grow,
and never lose your history when you miss a day.

Offline-first. No account, backend or analytics. Everything stays in SQLite on the device.

Built with Expo SDK 57, React Native 0.86, TypeScript (strict), Expo Router, `expo-sqlite`,
`expo-notifications`, `expo-haptics` and Reanimated.

## Prerequisites

- Node.js 20 or newer (developed on Node 26) and npm
- To run on an iPhone: the **Expo Go** app from the App Store, on the same Wi‑Fi network as your Mac
- To run in the iOS Simulator: Xcode with an iOS simulator installed

## Install

```bash
npm install
```

## Run

```bash
npx expo start      # start the dev server, then scan the QR code with the iPhone Camera app (opens Expo Go)
npm run ios         # start and open in the iOS Simulator (requires Xcode)
```

All native modules the app uses are included in Expo Go, so no custom development build is needed.
The project targets **SDK 57** to match the Expo Go version in the App Store; Expo Go must be 57.x.

## Checks

```bash
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # expo lint (ESLint + eslint-config-expo)
npm test            # Jest, run with TZ=America/New_York so date tests cover a real DST zone
```

The test suite covers:

- **Streak rules** (`src/features/streaks/streak-calculator.test.ts`): all 15 required cases, plus
  completion rates.
- **Dates** (`src/lib/dates.test.ts`): month, year and leap-day boundaries, and DST transitions.
- **Heatmap and milestones**: day statuses and the activity heatmap
  (`src/features/progress/build-habit-heatmap.test.ts`). The heatmap tests cover weekday
  alignment, year boundaries, leap day, DST, Build and Break wording, and the summary matching
  the completion-rate math.
- **Lapses**: a lapse ends the current streak but keeps history and the best streak; it is never
  counted as a success.
- **Living flame** (`src/__tests__/living-flame.test.tsx`): fixed size, which animations start,
  Reduce Motion and paused behavior.
- **Validation and reminder planning**: form validation, schedule parsing, the weekly reminder
  plan and the iOS 64-notification cap.
- **Persistence** (`src/__tests__/persistence.test.ts`): the real migrations, repository and
  service SQL against SQLite (Node's built-in `node:sqlite`). Covers uniqueness, foreign keys,
  archive and restore, reopening the database, the v1 → v2 migration, habit types, and lapses
  (a day can't be both a success and a lapse).
- **Screens** (`src/__tests__/screens.test.tsx`): every screen renders against a fake store, and
  the primary actions are wired up.

## Project structure

```text
src/
  app/                      Expo Router routes
    _layout.tsx             root Stack, onboarding guard, loading and error states
    onboarding.tsx
    (tabs)/                 native tabs: Today, Habits, Progress, You
    habits/new.tsx          create habit (modal)
    habits/[id].tsx         edit, archive or restore habit (modal)
  components/               presentational components (StreakHero, LivingFlame, HabitCard, HabitHeatmap,
                            HabitTypeSelector, …)
  db/                       SQLite connection and versioned migrations
  features/
    habits/                 types, habit-type (Build/Break), validation, repository (SQL), service, store
    progress/               pure heatmap data preparation
    streaks/                pure streak, rate, calendar and milestone logic
    reminders/              reminder planning (pure) and expo-notifications service
    settings/               settings repository
  lib/dates.ts              all local-date arithmetic
  theme/                    color, spacing and typography tokens
```

SQL lives only in the repositories. Screens read derived state from `useHabitStore()`, and the
streak math has no React or SQLite dependency.

## Data model

| Table               | Notes                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `habits`            | `type` is `build` or `break`; `schedule_days` is a JSON array of weekdays (0 = Sunday … 6 = Saturday); `archived_at` marks archived habits |
| `habit_completions` | successful days: one row per habit per **local** date (`YYYY-MM-DD`), `UNIQUE (habit_id, local_date)`; `completed_at` is the ISO instant |
| `habit_lapses`      | Break habits only: days the unwanted behavior happened, `UNIQUE (habit_id, local_date)`; never a success |
| `settings`          | key/value: onboarding done, haptics, reminders master switch                              |

- The schema version lives in `PRAGMA user_version`. Migrations in `src/db/migrations.ts` are
  append-only and run in a transaction.
  - v1: the original schema.
  - v2 is additive: `ALTER TABLE habits ADD COLUMN type … DEFAULT 'build'` plus the new
    `habit_lapses` table. Existing habits become Build with names, schedules, completions and
    reminders untouched. Unknown stored types read as `build`.
- Foreign keys are enforced and every statement is parameterized.
- Archiving never deletes anything. There is no hard delete in the app.
- IDs come from `expo-crypto`'s `randomUUID()`.

## Streak rules

- A **scheduled day** is a weekday in the habit's schedule, on or after the day the habit was
  created. Earlier days are never counted as missed.
- **Current streak**: count completed scheduled days backwards from today, stopping at the first
  missed scheduled day.
  - If today is scheduled but not done yet, it's skipped rather than missed, so the streak stays
    alive until local midnight.
  - Unscheduled days are skipped and never break a streak.
  - Example: on a Mon/Wed/Fri habit, last Friday keeps the streak alive all of Monday, and
    checking in Monday adds one.
- **Best streak**: the longest run of completed scheduled days ever. Missing a day never lowers it.
- **Undo** removes today's record, and streaks are recomputed from the stored completions.
- Only **today** can be checked in from the UI. Future-dated records are ignored by every
  calculation.
- Dates are local calendar days. Arithmetic uses calendar-day numbers, never "timestamp + 24h",
  so DST can't shift a day.

- **Lapses** (Break habits): a lapse today closes the day, so the current streak ends right away
  rather than at midnight. Past successes and the best streak are kept, and the streak restarts
  with the next check-in.

## Build and Break habits

Every habit has a direction, chosen in the habit form:

- **Build**: "A habit you want to do consistently." The Today action is **Complete**.
- **Break**: "A behavior you want to avoid or reduce." It uses **avoidance streaks**, so a
  successful day is one you explicitly check in with **Made it today**.
  - Not logging a lapse is *not* treated as success. Only a check-in counts.
  - A separate, low-key **Log a lapse** link records the behavior as a distinct event (stored in
    `habit_lapses`, never converted into a success).
  - After a lapse, Today shows "Lapse noted. Tomorrow is a fresh start." with an undo. No
    "failed" wording anywhere.
  - A day holds a success or a lapse, never both. The service enforces this in a transaction,
    and the UI hides the other action.

Both directions share the schedule, completion table, streak calculator and screens. Changing a
habit's direction keeps its check-ins, which then count as successful days for the new direction.
Lapses are only shown and counted for Break habits; they stay stored if the direction changes.

## Activity heatmap

Progress shows a contribution-style grid for the selected habit over the last 26 weeks (about six
months).

- Columns are weeks and rows run **Monday → Sunday**. It scrolls horizontally and opens on the
  latest week.
- Each day is one of these, distinguished by shape as well as color:

  | Status        | Shape                         |
  | ------------- | ----------------------------- |
  | completed     | filled                        |
  | lapse         | thick rose ring               |
  | no check-in   | thin neutral outline          |
  | today, open   | accent outline                |
  | not scheduled | small dot                     |
  | before start  | faint dot                     |
  | upcoming      | empty                         |

- Tapping a cell shows its full date, whether it was scheduled, and its status. Every cell has
  an accessible label, e.g. "Monday, January 8: made it".
- The summary ("18 of 22 scheduled days completed") uses the same definition as the completion
  rates below.
- A habit with no elapsed scheduled days shows a short explanation instead of an empty grid.
- Day statuses come from one pure `dayStatus()` function (`src/features/streaks/calendar.ts`).

## Living flame

The Today hero uses `LivingFlame`, three SF Symbol layers animated with Reanimated on the UI
thread:

- a soft glow, breathing over 2.8 s;
- the main flame, swaying ±3° over 2.3 s and stretching up to 7% over 1.7 s;
- a yellow inner highlight, flickering over 1.3 s.

The loops are deterministic and staggered, with no per-frame React renders. The animation pauses
while Today isn't focused.

It also plays with iOS **Reduce Motion** on. Reanimated would otherwise skip every animation,
which left the flame frozen. To stop it, turn off **You › Preferences › Animated flame**.

The flame is decorative and hidden from VoiceOver; the hero announces "Current streak: N in a
row, <habit>".

## Completion rates

The **last 7 / 30 days** rates cover the last N calendar days, today included. Completed scheduled
days are divided by scheduled days in that window.

- Only scheduled days on or after the creation date count toward the denominator.
- Today joins the denominator only once it's completed (or a lapse is logged), so an unfinished
  day never lowers the rate.
- For Break habits, only explicit "Made it today" check-ins are successes; lapses count in the
  denominator.
- Future days are never counted.
- A check-in on an unscheduled day (possible after a schedule edit) appears on the calendar but
  doesn't count toward streaks or rates.

## Reminders

- Reminders are optional, one weekly local notification per scheduled weekday at the habit's time.
- Notification permission is requested only when you turn a reminder on, or tap "Allow
  notifications".
- If permission is denied, the app explains how to enable it and links to iOS Settings.
- Notification identifiers are deterministic (`flame-habit:<habitId>:<weekday>`). After every
  launch and every habit change, the app reconciles scheduled notifications with stored habits:
  stale ones are cancelled and planned ones are rescheduled in place. This avoids duplicates and
  covers edits, archiving, restarts and permission changes.
- A master switch in **You** pauses all reminders without losing per-habit times.

## Decisions

- **Today's hero** shows the longest current streak among active habits and names the habit. It
  doesn't invent an aggregate "app streak". With no active streak it says "Your consistency starts
  today".
- **Milestones** (7, 14, 30, 100) count total check-ins across all habits, archived ones included.
- **Schedule edits apply to the whole history**, so streaks are recomputed with the new schedule.
  This is the simplest predictable rule. Past check-ins are never deleted.
- **Sorting**: habits are listed oldest first, a stable and predictable order.
- **Weeks display Monday-first.** Weekday storage still uses 0 = Sunday.
- **Reminder time** uses a dependency-free hour/minute stepper (5-minute steps) instead of adding
  a native date-picker package.
- **English labels** (Build / Break) since the app has no localization system yet.
- **Lapses are one per day** (logged or not), not a count of occurrences. A reduction counter is
  a natural extension of `habit_lapses`.
- **Habit filter** (All / Build / Break) appears in Habits once both directions exist.

## Known limitations

- **Partly verified on a device.** The app runs in Expo Go 57 on an iPhone with no runtime
  errors in the logs. It hasn't been visually reviewed yet. Still to check on the device:
  - layout and safe areas;
  - the flame animation and its tuning;
  - heatmap scrolling on a small iPhone;
  - haptics;
  - the notification permission prompt and reminder delivery.
- iOS allows **64 pending local notifications** per app. Daily reminders on more than 9 habits
  exceed this. The app schedules the first 64 and shows a warning in **You**.
- Weekly reminders fire at the device's local time. After changing time zones, reminders and
  "today" follow the new zone. Past completions keep the local date they were recorded on.
- Only the current day can be checked in. There's no way to backfill a forgotten day.
- No data export, backup or sync. Deleting the app deletes its data.
- iPhone only: Android isn't tested, and web isn't supported (`expo-sqlite` on web needs extra
  setup).
- Under Jest, Reanimated is replaced with a minimal mock (`jest.setup.js`). Animations aren't
  covered by tests.

## License

[MIT](LICENSE) © 2026 Vladislav Abramov
