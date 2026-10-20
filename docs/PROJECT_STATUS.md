# FLAME: Project Status

_Snapshot: 2026-10-20 · branch `main` (Read More template added on top of `58959b8`) · repo: https://github.com/vavabramov/flame_app (public, MIT)_

This document is a handoff summary of what is implemented, how it is built, and what is open.
It reflects the code as of the commit above.

---

## 1. Product in one paragraph

FLAME is a premium, dark-mode iPhone habit tracker centered on personal streaks. It's
offline-first, with no account, backend or analytics, and all data lives in SQLite on the device.

Each habit has a direction:
- **Build**: something you want to do more.
- **Break**: something you want to stop.

Both directions work the same way:
- Users check in once per day, with one tap.
- Streaks count consecutive *scheduled* days, so rest days never break a streak.
- A missed day ends the current streak but never deletes history or lowers the best streak.

The tone is supportive and never shaming.

## 2. Current state at a glance

| Area                            | Status |
| ------------------------------- | ------ |
| MVP (original spec)             | ✅ Implemented |
| Build / Break directions        | ✅ Implemented (with lapse logging) |
| Living (animated) flame         | ✅ Implemented; tuned once after device feedback |
| GitHub-style activity heatmap   | ✅ Implemented; month calendar removed at user's request |
| Read More template (experiment) | ✅ Implemented: minutes and optional pages per day, Today summary, Progress totals |
| Type check / lint / tests       | ✅ `tsc` clean, `expo lint` 0 problems, **151/151 tests pass** |
| `expo-doctor`                   | ✅ 21/21 |
| Runs on a real iPhone (Expo Go) | ✅ Loads with no runtime errors in the Metro logs |
| Visual QA on a device           | ⏳ Not done yet; the user is reviewing |

## 3. Tech stack (exact versions)

- **Expo SDK 57** (`expo ~57.0.30`).
  - The project was downgraded from SDK 58 on purpose: the App Store Expo Go on the user's
    iPhone is 57.x.
- React Native **0.86.3**, React **19.2.3**, TypeScript **6.0** (strict). React Compiler is
  enabled (`experiments.reactCompiler`).
- Expo Router `~57.0.28`:
  - native tabs, imported from **`expo-router/unstable-native-tabs`** (SDK 57 path);
  - a root Stack with modal routes and `Stack.Protected` guards.
- Native modules, all bundled in Expo Go, so no custom dev build is needed:
  - `expo-sqlite ~57.0.4`
  - `expo-notifications ~57.0.23`
  - `expo-haptics`
  - `expo-symbols` (SF Symbols)
  - `expo-crypto` (UUIDs)
  - `react-native-reanimated 4.5.1` / `react-native-worklets 0.10.1`
- Tests: Jest 29 + `jest-expo ~57.0.6` + `@testing-library/react-native` 14. In v14, `render` and
  `fireEvent` are **async**.

## 4. How to run

```bash
npm install            # or `npm ci` to install exactly from the lockfile
npx expo start         # scan the QR with the iPhone Camera → opens in Expo Go 57.x
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint
npm test               # TZ=America/New_York jest (real DST zone for date tests)
```

Notes:
- `npm run ios` / `npm run android` are currently `expo run:ios|android`. These do a **native
  build** that needs Xcode or Android Studio, which isn't installed on the dev Mac. For the
  phone, use `npx expo start` + Expo Go. The README still says `npm run ios` opens the
  Simulator; that should be corrected.
- The Expo account is logged in (`npx expo whoami` → `vavabramov`).

## 5. Architecture

```text
src/
  app/                       Expo Router routes (every file is a screen)
    _layout.tsx              root Stack; loading/error gates; onboarding guard (Stack.Protected)
    onboarding.tsx           single intro screen, "Get started"
    (tabs)/_layout.tsx       NativeTabs: Today, Habits, Progress, You
    (tabs)/index.tsx         Today
    (tabs)/habits.tsx        Habits list (+ Build/Break filter, archive section)
    (tabs)/progress.tsx      Progress (stats + activity heatmap)
    (tabs)/you.tsx           You / settings
    habits/new.tsx           create habit (modal)
    habits/[id].tsx          edit / archive / restore (modal)
  components/                presentational UI (StreakHero, LivingFlame, HabitCard, CompletionButton,
                             HabitHeatmap, HabitForm, HabitTypeSelector, SegmentedControl, …)
  db/
    database.ts              opens `flame.db` once, runs migrations
    migrations.ts            versioned, append-only migrations (PRAGMA user_version)
  features/
    habits/
      habit.types.ts         Habit, HabitCompletion, HabitLapse, HabitInput
      habit-type.ts          'build' | 'break', parsing, all direction-specific copy
      habit.validation.ts    input validation, schedule helpers, weekday labels
      habit.repository.ts    all SQL (parameterized)
      habit.service.ts       use cases: create/edit/archive, setCompletion, setLapse
      habit-store.tsx        React context: loads everything, derives stats, optimistic writes
      completions.ts         pure toggle helper + CheckInDateError
    streaks/
      streak-calculator.ts   pure: current/best streak, completion rate, lapse handling
      calendar.ts            pure: dayStatus() for one habit/day
      milestones.ts          pure: 7/14/30/100 check-in milestones
    progress/
      build-habit-heatmap.ts pure: heatmap cells, month labels, summary
    reminders/
      reminder.plan.ts       pure: which weekly notifications should exist
      reminder.service.ts    expo-notifications: permission, sync/reconcile
    settings/
      settings.repository.ts key/value settings
  lib/
    dates.ts                 all local-date math (single source of truth)
    use-today.ts             current local date; updates at midnight and on foreground
  theme/                     colors, spacing, typography tokens
```

Principles:
- **Layering.** SQL lives only in repositories. Screens compose components and read from
  `useHabitStore()`. Streak, heatmap and reminder logic is pure and unit-tested.
- **State.**
  - One context store, no Zustand.
  - Check-ins update the UI first, then persist through a serialized write queue.
  - If a write fails, the change is rolled back and an alert is shown.
- **Navigation.** Onboarding is guarded by `settings.onboardingCompleted`. Habit create and edit
  are modal routes.

## 6. Data model (SQLite, schema v2)

| Table               | Columns / notes |
| ------------------- | --------------- |
| `habits`            | `id` (UUID), `type` (`build`\|`break`, default `build`), `name`, `icon` (emoji), `color` (hex), `schedule_days` (JSON array, 0 = Sunday … 6 = Saturday), `reminder_time` (`HH:mm` or NULL), `created_at`, `updated_at`, `archived_at` (NULL = active) |
| `habit_completions` | successful days. `habit_id` FK, `local_date` (`YYYY-MM-DD`), `completed_at` (ISO). `UNIQUE (habit_id, local_date)` |
| `habit_day_metrics` | Read More: `habit_id` FK, `local_date`, `minutes` (≥ 0, NOT NULL), `pages` (≥ 0, nullable), `recorded_at`, `updated_at`. `UNIQUE (habit_id, local_date)`; saving again upserts |
| `habit_lapses`      | Break habits only. Days the unwanted behavior happened. `UNIQUE (habit_id, local_date)`. Never a success |
| `settings`          | key/value booleans: `onboardingCompleted`, `hapticsEnabled`, `flameAnimation`, `remindersEnabled` |

- Migrations:
  - **v1**: the original tables.
  - **v2** is additive: `ALTER TABLE habits ADD COLUMN type … DEFAULT 'build'` plus
    `habit_lapses`. It's tested with real SQLite: a v1 database migrates and keeps its data.
  - **v3** is additive: `habits.template`, `habits.target_minutes` and `habit_day_metrics`. A v2
    database migrates with its habits, check-ins and lapses intact.
- Foreign keys are on and every statement is parameterized.
- Archive is a soft delete. Nothing is ever hard-deleted.
- A day holds **either** a completion **or** a lapse, never both. The service checks this
  inside a transaction and throws `DayConflictError` otherwise.

## 7. Domain rules (implemented and tested)

**Dates.** All dates are local calendar days (`YYYY-MM-DD`).
- Arithmetic uses day numbers derived from the calendar date, never "timestamp + 24h" and never
  UTC slicing.
- Weekdays: 0 = Sunday. Weeks are **displayed Monday-first**.

**Streaks:**
- A *scheduled day* is a weekday in the schedule, on or after the habit's creation date.
- **Current streak**: count completed scheduled days backwards from today, stopping at the first
  missed scheduled day.
  - If today is scheduled but not yet checked in, it's skipped (not missed) until midnight.
  - Unscheduled days are skipped.
  - Example: a Mon/Wed/Fri habit keeps last Friday's streak alive all of Monday.
- **Best streak**: the longest run ever. Never lowered by a miss.
- **Lapse today** (Break habits) closes the day: the current streak becomes 0 right away. The best
  streak and history are kept, and the streak restarts with the next check-in. If a date somehow
  has both a completion and a lapse, the lapse wins.
- Only **today** can be checked in or have a lapse logged (`canToggleCompletion`). Future-dated
  records are ignored everywhere.
- Schedule edits apply retroactively to the whole history. Completions are never deleted.

**Completion rates (7 / 30 days, and the heatmap summary):**
- Numerator: successful *scheduled* days in the window.
- Denominator: scheduled days in the window on or after the creation date.
- Today counts only once it's checked in or a lapse is logged.
- Future days never count.
- Completions on unscheduled days appear in history but don't count.

**Break semantics:**
- Break habits use avoidance streaks: success is only an explicit "Made it today" check-in.
  *Not logging a lapse is not a success.*
- Lapses are binary per day, not a count.
- If a habit's direction changes, its check-ins are kept and count as successes for the new
  direction. Lapses stay stored but are only counted or shown while the habit is Break.

**Milestones:** 7 / 14 / 30 / 100 total check-ins, across all habits including archived ones.

## 8. Features by screen

**Onboarding:** one screen with three value points (including the Build-or-Break example) and
"Get started". No account. It's shown once.

**Today:**
- Greeting, local date and a **StreakHero**:
  - the `LivingFlame` animation;
  - the longest current streak among active habits, named, e.g. "12 in a row · 📚 Read";
  - a welcoming state if no streak exists (no invented aggregate);
  - a daily progress bar, "2 of 3 completed" / "All 3 done today. Nicely kept.".
- Only habits scheduled today are listed. A rest-day card appears when none are.
- **HabitCard**:
  - the habit icon, name and streak line, plus a labeled pill button:
    - **Build**: "Complete" / "Done";
    - **Break**: "Made it today" / "Made it";
  - tapping the pill again undoes today's check-in;
  - for Break habits, a low-key "Log a lapse" link. After a lapse the card says "Lapse noted.
    Tomorrow is a fresh start." with an "Undo".
- Haptics: success on check-in, light on undo or lapse. They can be turned off.

**Habits:**
- Active habits listed oldest first, each with an icon, a Build/Break badge, the schedule,
  reminder time and streak.
- An All / Build / Break segmented filter appears when both directions exist.
- A collapsible "Archived" section with Restore.

**Create / Edit habit (modal):**
- Fields:
  - direction (two cards with explanations);
  - name (trimmed, max 40 characters, placeholder by direction);
  - an emoji icon from 20 options;
  - an accent color from 8, all ≥ 7:1 contrast;
  - weekday toggles, with an "Every day" shortcut;
  - an optional reminder time, set with an hour/minute stepper in 5-minute steps.
- Validation errors appear after the first Save.
- The edit screen has Archive (with confirmation) or Restore.

**Progress:**
- A habit selector of horizontal chips, archived habits included.
- A header with icon, name, type badge and schedule.
- Tiles: current streak, best streak, last 7 days, last 30 days.
- The **activity heatmap**:
  - 26 weeks (about six months); columns are weeks, rows run Mon → Sun;
  - month labels, scrolls horizontally, opens on the latest week;
  - statuses differ by **shape and color**: completed (filled), lapse (rose ring), no check-in
    (thin outline), today open (accent outline), not scheduled (small dot), before start
    (faint dot), upcoming (empty);
  - a legend, and a summary such as "18 of 22 scheduled days completed / made it through" plus a
    percentage;
  - tapping a cell shows a detail panel with the full date, whether it was scheduled, and its
    status;
  - each cell has an accessible label, e.g. "Monday, January 8: made it";
  - a brand-new habit shows an explanation instead of an empty grid.
- The month calendar was **removed** at the user's request. The heatmap is the only history
  view.

**You:**
- Total check-ins, best streak ever, and milestone badges.
- **Reminders**:
  - a master switch;
  - the permission status;
  - an "Allow notifications" button, or "Open Settings" if permission was denied;
  - a warning about iOS's 64-notification limit.
- **Preferences:** Haptic feedback; **Animated flame**.
- About: version, privacy note, and the streak definition.

## 8a. Read More template

- **Template:** `features/habits/habit-template.ts` defines `READ_MORE_TEMPLATE`.
  - Defaults: Read, Build, every day, 📚, 15-minute target.
  - `habits.template` is `'read_more'` or NULL; `targetMinutes` is 1–600 or NULL.
- **Create:** a "Start from a template" card on New habit (`components/TemplateCard.tsx`).
  Applying or removing it resets the form. The target is edited in the form in 5-minute steps.
- **Log:** `app/reading/[id].tsx` is a modal.
  - Minutes are required (10/15/30/45 quick picks); pages are optional.
  - Today only. Saving again corrects the day's record.
  - Validation lives in `features/reading/reading.validation.ts`: whole numbers ≥ 0, at most
    1440 minutes and 10000 pages.
  - Repeated taps are ignored via `lib/use-single-flight.ts`, which uses a ref so two taps in
    the same frame are handled.
- **Semantics:**
  - Reading records are separate from check-ins and never mark a habit complete.
  - The target is guidance only; streaks are unaffected.
  - The modal has an explicit, off-by-default "Also check in for today" switch.
- **Today:** Read More cards get one extra line, `📖 12 / 15 min · 8 pages`, with Log reading /
  Edit. Other habits render as before.
- **Progress:** a Reading card (`components/ReadingSummaryCard.tsx`) shows last-30-days and
  all-time minutes, pages (null rather than 0 when none were recorded) and days logged, plus the
  7 most recent entries. It has an empty state. The heatmap is unchanged.
- **Summaries:** `features/reading/reading-summary.ts` is pure. Future-dated entries are ignored.

## 9. Living flame (details and history)

`LivingFlame` is three SF Symbol layers, animated with Reanimated shared values on the UI thread
with no React re-renders:

| Layer             | Motion                                 | Loop   |
| ----------------- | -------------------------------------- | ------ |
| Glow              | breathing                              | 2.8 s  |
| Main flame        | sway ±3° (pivot at the base)           | 2.3 s  |
| Main flame        | vertical stretch up to 7%              | 1.7 s  |
| Yellow inner core | flicker                                | 1.3 s  |

- The loops are deterministic and staggered. The box has a fixed size, so the layout never
  shifts.
- The animation pauses when Today isn't focused (`useIsFocused`) or when the
  **Animated flame** setting is off.
- **History:** the user's iPhone has **iOS Reduce Motion ON**. Reanimated skips all animations
  in that mode, and the first version also chose to show only a faint glow fade. The user
  reported "the flame isn't alive".
- **Current behavior:** all loops pass `ReduceMotion.Never`, so the flame animates even with
  Reduce Motion on. The in-app switch is the explicit way to stop it.
- The flame is decorative and hidden from VoiceOver. The hero announces "Current streak: N in a
  row, <habit>".
- **Still needs on-device tuning:** where the inner core sits inside the main flame, and the
  overall amplitude.

## 10. Reminders

- Each scheduled weekday of a habit with a reminder time gets one weekly local notification.
- Identifiers are deterministic (`flame-habit:<habitId>:<weekday>`).
- The app reconciles scheduled notifications on every launch, on return to the foreground, and
  after every habit or setting change: stale ones are cancelled and planned ones rescheduled in
  place, so there are no duplicates.
- Permission is requested only when the user turns on a reminder or taps "Allow notifications".
- iOS allows 64 pending notifications per app. Extra reminders are skipped, and the app shows a
  warning.
- The body text depends on direction. Break: "Made it through today? Check in when you're ready."
- Delivery on a real device hasn't been verified yet.

## 11. Tests (116, all passing)

| File | Covers |
| ---- | ------ |
| `features/streaks/streak-calculator.test.ts` | All 15 required streak cases (first check-in, consecutive days, a miss breaking the streak, best preserved, today-open grace, unscheduled days, Mon/Wed/Fri schedule, created mid-history, duplicates, undo, month/year boundary, leap day, DST, no future check-ins), plus rates and lapses |
| `lib/dates.test.ts` | Boundaries, validation, weekdays, DST (23 h / 25 h days), local vs UTC day |
| `features/streaks/calendar.test.ts` | `dayStatus` for every status, including lapse beating completion |
| `features/progress/build-habit-heatmap.test.ts` | Monday-first alignment, year boundary, leap day, DST, month labels, all statuses, Break wording, summary equal to `completionRate` |
| `features/habits/habit.validation.test.ts` | Validation, schedule parsing, reminder plan (weekday mapping, stable ids, 64 cap) |
| `__tests__/persistence.test.ts` | Real SQLite via `node:sqlite`: migrations (v1→v2), FK enforcement, UNIQUE constraints, restart persistence, archive/restore, types, lapse/completion exclusivity, SQL-injection-safe parameters, settings |
| `__tests__/screens.test.tsx` | Every screen renders against a fake store; primary actions; Build/Break labels; lapse flow; heatmap tap → detail; settings toggles |
| `__tests__/living-flame.test.tsx` | Fixed size; 4 loops start; still animates under Reduce Motion; static when paused; hidden from a11y |

Test-environment notes:
- `jest.setup.js` replaces Reanimated with a **minimal hand-written mock**: the bundled mock
  fails under this SDK. It also mocks safe-area-context.
- Screen tests live in `src/__tests__/`, not in `src/app/`, because Expo Router would treat them
  as routes.

## 12. Decisions log

- **Hero streak:** shows the longest current streak among active habits, named. There's no
  invented "app streak".
- **Weeks:** Monday-first display. Storage uses JS `getDay` numbering (0 = Sunday).
- **No new UI dependencies:**
  - SF Symbols through `expo-symbols`;
  - no SVG library;
  - no date-picker package (the reminder time uses a custom stepper).
- **Language:** English UI. There's no localization system. The spec suggested
  «Нарабатываю / Избавляюсь» only if the app were Russian.
- **Habit order:** creation order. The Habits filter appears only when both types exist.
- **SDK 57:** pinned to match Expo Go on the App Store. Upgrade to 58 once Expo Go 58 is available
  on the user's device.
- **Never run `npm audit fix --force`.** It once downgraded Expo to SDK 44 and broke the install.
  The reported vulnerabilities are in dev and build tooling.
- **Installing packages:** always use `npx expo install <pkg>` so versions match the SDK.

## 13. Known limitations and open items

0. **Read More:**
   - Only today's reading can be logged; there's no backfill.
   - There's no timer, by design.
   - A day's record can be corrected but not deleted (set minutes to 0 instead).
   - Changing a habit's template after creation isn't offered.
   - An `ios/` folder exists locally from a native run on 2026-10-19. It's git-ignored and
     generated (CNG), so don't edit it.

1. **Visual QA on the device is pending:** layout and safe areas, flame tuning, heatmap scrolling
   and 14 pt tap targets on small iPhones, haptics, the permission prompt, and reminder delivery.
2. **The README's `npm run ios` text is stale**, since the scripts changed to `expo run:ios`
   (see §4).
3. **Unused template dependencies** remain and can be removed: `@expo/ui`, `expo-device`,
   `expo-glass-effect`, `expo-image`, `expo-web-browser`, `react-native-gesture-handler`.
   Verify before removing.
4. **Unused date helpers** in `lib/dates.ts` (`datesOfMonth`, `addMonths`, `compareYearMonths`,
   `daysInMonth`) are left from the removed month calendar. They're still covered by tests.
5. **No backfill:** only today can be checked in.
6. **No export, backup or sync:** deleting the app deletes its data.
7. **iOS limit of 64 pending notifications** (about 9 habits with daily reminders).
8. **iPhone only:** Android isn't tested, and web isn't supported (expo-sqlite on web needs extra
   setup).
9. **Lapses are one per day**, not an occurrence counter. A reduction counter would be a natural
   extension of `habit_lapses`.
10. **Animations aren't covered by tests**, because of the Reanimated mock.

## 14. Constraints for anyone continuing the work

- Read `AGENTS.md`. Expo APIs change every SDK, so check the docs for **SDK 57**
  (`https://docs.expo.dev/versions/v57.0.0/`) rather than relying on memory.
- Keep routes in `src/app/` and everything else outside it.
- Don't create `ios/` or `android/` by hand (Continuous Native Generation).
- Keep the app runnable in **Expo Go 57**: no native modules outside Expo Go without a deliberate
  move to a dev build.
- Schema changes must be **additive migrations** appended to `MIGRATIONS`. Never edit a shipped
  migration.
- Keep date logic in `lib/dates.ts`, and streak, rate, heatmap and status logic pure and tested.
- Before declaring work done, run `npm run typecheck && npm run lint && npm test`.
- Out of scope unless explicitly requested: accounts, backend, sync, social, payments, streak
  freezes, AI coaching, remote push.
