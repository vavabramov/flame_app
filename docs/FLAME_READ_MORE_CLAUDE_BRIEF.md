# FLAME --- Read More Template Implementation Brief

## Purpose

Implement the first specialized habit template in FLAME: **Read More**.

This is a focused product experiment, not a redesign or a
general-purpose habit engine. The goal is to learn whether adding a
small amount of structured tracking makes FLAME more useful than a
simple daily check-in.

The experiment should support 14 days of personal use. Keep the existing
visual identity, navigation, offline-first behavior, streak rules, and
supportive tone.

## Current project context

The current app is an iPhone-first Expo / React Native / TypeScript app
with:

-   Expo Router and the screens `Today`, `Habits`, `Progress`, and
    `You`.
-   SQLite persistence with versioned, additive migrations.
-   A `habits` model with `build` / `break` direction, schedules,
    reminders, and archive support.
-   `habit_completions` and `habit_lapses`.
-   A pure streak calculator and a GitHub-style activity heatmap.
-   A shared habit store and repository/service layering.
-   A dark, premium UI and animated flame on Today.
-   Existing tests for streaks, dates, persistence, and screens.

Read `AGENTS.md`, `PROJECT_STATUS.md` if present, and the relevant
source files before changing code. Treat the actual repository as
authoritative if it differs from this brief. Do not assume filenames or
APIs without inspecting them.

## Product decision

Add a **Read More** template with:

1.  A daily reading habit.
2.  Required tracking of actual reading time in minutes.
3.  Optional tracking of pages read.
4.  Existing daily check-in / streak behavior retained.
5.  A history of recorded reading metrics.
6.  A small, useful summary of reading progress.

The user must be able to start with the template, customize it, and
still use the habit without filling in every optional field.

### Important distinction

Do not conflate a numeric target with a successful daily check-in.

For this first experiment, preserve the app's existing check-in
semantics. A user can record reading minutes and optionally pages, then
mark the habit complete using the established flow. Do not silently make
a partially achieved target a failure, and do not automatically mark a
habit complete based only on a metric unless the existing product model
explicitly supports that behavior and the implementation is documented.

If a new target is introduced, treat it as guidance for this experiment
rather than changing the global streak engine. Avoid broad changes to
streak semantics.

## User experience

### A. Creating a habit from the template

Add a clear entry point to create a habit from a template. Follow
existing navigation and modal patterns.

The Read More template should prefill a sensible default, for example:

-   Name: `Read`
-   Direction: `Build`
-   Schedule: every day
-   Suggested target: `15 minutes`
-   Optional metric: pages read

Use existing components and design tokens where practical. The user must
be able to edit the name, schedule, reminder, icon, and color through
existing functionality. Do not force users to use the template; manual
habit creation must continue to work.

Avoid building a template marketplace or adding multiple templates in
this task.

### B. Recording a reading session

Provide a lightweight way to record the day's reading time, with an
optional pages value.

Requirements:

-   Minutes are a non-negative whole number.
-   Pages are optional and, when provided, a non-negative whole number.
-   Validate inputs and display clear, friendly errors.
-   Keep the common flow quick; do not make the user complete a long
    form.
-   Make it possible to correct a value for the current day if the user
    entered it incorrectly.
-   Prevent duplicate records caused by repeated taps.
-   Respect the app's local-date conventions (`YYYY-MM-DD`) and current
    date helpers.
-   Do not add a timer in this iteration. Manual entry is sufficient for
    the experiment.
-   Do not add an EPUB/PDF reader or one-word-at-a-time reading mode in
    this iteration.

If the current UI or data model makes the best interaction unclear,
inspect the current screens and choose the smallest consistent
implementation. Document the decision in the final summary.

### C. Today screen

Keep Today focused and uncluttered.

For a Read More habit, show a compact reading summary such as
`12 / 15 min` if a target exists, plus an obvious action to record or
edit today's reading. Keep the existing check-in action and streak
display consistent with the current design.

Do not make the reading controls dominate the screen for other habits.
Existing non-template habits should render exactly as before unless a
shared component can be safely extended without changing their behavior.

### D. Progress screen

For a Read More habit, show a small summary based on saved data, for
example:

-   Total minutes read over the selected/current history window.
-   Total pages, when pages have been recorded.
-   Recent daily reading history.

Reuse the existing Progress screen and heatmap where possible. The
heatmap remains the activity history; do not reintroduce the removed
month calendar.

Do not invent metrics when there is no data. Show a useful empty state
for a new reading habit. Keep the existing stats and heatmap behavior
for all other habits.

## Data model and persistence

Inspect the current SQLite schema, migrations, repository, service,
types, and store before deciding on the schema.

Persist reading data locally. Do not add a backend, accounts, analytics,
or sync.

Prefer the smallest schema that correctly supports this use case. A
daily metric record keyed by habit and local date may be sufficient,
with fields for minutes and optional pages. Do not create separate
tables for each future template, and do not introduce a generic metric
framework prematurely unless the existing architecture clearly calls for
it.

Requirements:

-   Add a new, additive migration; never edit an existing migration.
-   Preserve all existing data and behavior.
-   Use parameterized SQL.
-   Enforce the intended uniqueness for a habit/date record.
-   Keep writes in the existing repository/service layer; do not put SQL
    in screen components.
-   Handle archived habits consistently with current behavior.
-   Keep a clear separation between the daily check-in and reading
    measurements.
-   If a metric record exists for a day, editing it should update that
    record rather than create a duplicate.
-   Use existing local date utilities; do not derive local dates by
    slicing UTC timestamps.

## Architecture boundaries

Follow the existing project structure and conventions:

-   Routes stay in `src/app/`.
-   Reusable UI stays outside `src/app/`.
-   SQL belongs in repositories.
-   Business rules belong in services or pure domain helpers.
-   Screens should use the existing store/context pattern.
-   Keep date and streak calculations pure and covered by tests.
-   Use `npx expo install` for any Expo package that is genuinely
    needed.
-   Prefer no new dependencies for this feature.

Do not migrate to Swift, add Zustand, create a backend, or restructure
the app. Do not create `ios/` or `android/` manually; preserve Expo
Continuous Native Generation.

## Tests and quality gates

Add tests for the new behavior, including as applicable:

-   Validation of minutes and optional pages.
-   Creating, reading, and updating a daily reading record.
-   Unique habit/date behavior and persistence across database reopen.
-   Migration from the current schema while preserving existing
    habit/check-in/lapse data.
-   Local-date boundaries.
-   Summary calculations and empty states.
-   Rendering and primary interactions for a Read More habit.
-   Regression coverage showing that ordinary Build and Break habits
    still behave as before.

Use the project's existing testing patterns and async Testing Library
v14 APIs.

Before finishing, run:

``` bash
npm run typecheck
npm run lint
npm test
npx expo-doctor
```

Report the actual result of each command. Do not claim a command passed
if it was not run.

## Explicitly out of scope

Do not implement any of the following in this task:

-   More templates beyond Read More.
-   Built-in book reader, EPUB/PDF import, or RSVP word-by-word reading.
-   AI coaching or MCP.
-   Social features, friends, leaderboards, or shared challenges.
-   Accounts, cloud sync, backend, or remote analytics.
-   Timers or background tracking.
-   A redesign of the app.
-   Global changes to streak semantics or Break/lapse rules.
-   New gamification systems, streak freezes, or penalties.

These can be considered after the Read More experiment has been used and
evaluated.

## Implementation workflow for Claude Code

1.  Inspect `AGENTS.md`, project status documentation, and relevant
    source files.
2.  Summarize the proposed minimal changes before editing, especially
    the database schema and UI entry point.
3.  Implement in small, coherent steps.
4.  Add the migration and tests alongside the implementation.
5.  Preserve existing styles, semantics, and unrelated behavior.
6.  Run the quality gates listed above.
7.  Review the final diff for unrelated changes and accidental changes
    to generated/native files.

Do not stop after writing a plan unless blocked by a genuine ambiguity.
Make reasonable choices consistent with the repository and implement the
feature.

## Definition of done

The feature is done when:

-   A user can create a reading habit from the Read More template.
-   The user can record and correct minutes for today, with optional
    pages.
-   Reading data persists locally after closing and reopening the app.
-   Today shows the reading summary without cluttering unrelated habits.
-   Progress shows meaningful reading totals/history and a proper empty
    state.
-   Existing streaks, heatmap, Build/Break behavior, reminders, and
    manual habit creation continue to work.
-   All quality gates have been run and their results are reported.
-   The final response explains the schema/UI decisions, files changed,
    tests run, and any remaining limitations.
