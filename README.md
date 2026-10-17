# FLAME

A calm, dark-mode habit tracker built around personal streaks. Check in with one tap, watch your
streak grow, and never lose your history when you miss a day.

Offline-first. No account, backend or analytics. Everything stays in SQLite on the device.

Built with Expo SDK 58, React Native 0.88, TypeScript (strict), Expo Router, `expo-sqlite`,
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
- **Calendar and milestones**: calendar day states and the month grid, plus milestones.
- **Validation and reminder planning**: form validation, schedule parsing, the weekly reminder
  plan and the iOS 64-notification cap.
- **Persistence** (`src/__tests__/persistence.test.ts`): the real migrations, repository and
  service SQL against SQLite (Node's built-in `node:sqlite`). Covers uniqueness, foreign keys,
  archive and restore, and reopening the database.
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
  components/               presentational components (StreakHero, HabitCard, ProgressCalendar, …)
  db/                       SQLite connection and versioned migrations
  features/
    habits/                 types, validation, repository (SQL), service (use cases), store (React context)
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
| `habits`            | `schedule_days` is a JSON array of weekdays (0 = Sunday … 6 = Saturday); `archived_at` marks archived habits |
| `habit_completions` | one row per habit per **local** date (`YYYY-MM-DD`), `UNIQUE (habit_id, local_date)`; `completed_at` is the ISO instant |
| `settings`          | key/value: onboarding done, haptics, reminders master switch                              |

- The schema version lives in `PRAGMA user_version`. Migrations in `src/db/migrations.ts` are
  append-only and run in a transaction.
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

## Completion rates

The **last 7 / 30 days** rates cover the last N calendar days, today included. Completed scheduled
days are divided by scheduled days in that window.

- Only scheduled days on or after the creation date count toward the denominator.
- Today joins the denominator only once it's completed, so an unfinished day never lowers the rate.
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

## Known limitations

- **Not yet verified on a physical iPhone or in the Simulator.** No Xcode was available while
  this was built. The app passes type checks, lint and the test suite, Metro bundles it for iOS,
  and the dev server serves it. Still to check on a device: layout and safe areas, haptics,
  animations, the permission prompt, and notification delivery.
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
