# ADR 0001: AI-конструктор FLAME, architecture review перед Phase 1

**Статус:** предложено, ждёт согласования. Код не менялся.
**Дата:** 2026-10-20
**Основание:** `docs/FLAME_AI_CONSTRUCTOR_TECH_SPEC.md`, раздел 15.
**Состояние репозитория при проверке:**
- ветка `main`, HEAD `7897edb` («Add the Read More template…»);
- рабочее дерево чистое, кроме неотслеживаемой папки `docs/`;
- `npm test`: 11 suites, **151/151 passed** (запуск во время ревью).

Всё ниже проверено по фактическим файлам. Где факт не проверялся (MCP SDK, Claude Desktop, Skills), это отмечено явно.

---

## 1. Подтверждённые факты (реальные пути, типы, слои)

### Стек и инструменты
- **Платформа:** Expo `~57.0.30`, React Native 0.86.3, React 19.2.3, TypeScript ~6.0 (strict). Включён React Compiler.
- **Скрипты** (`package.json`): `typecheck` = `tsc --noEmit`, `lint` = `expo lint`, `test` = `TZ=America/New_York jest`. `ios`/`android` = `expo run:*`, это нативная сборка.
- **Jest:** preset `jest-expo`, alias `@/` → `src/`, `setupFiles: jest.setup.js` (ручной мок Reanimated).
- **tsconfig:** `include: ["**/*.ts", "**/*.tsx", …]`, `types: ["jest"]`, `paths: @/* → src/*`.
- **ESLint:** `eslint-config-expo/flat`, `ignores: ['dist/*']`.
- **Прямых зависимостей для валидации нет.** `zod` и `ajv` лежат в `node_modules` только транзитивно, на них нельзя опираться.
- Папка `ios/` есть локально (нативный запуск 2026-10-19), она в `.gitignore` (CNG).

### Слои
| Слой | Файлы |
|---|---|
| Маршруты | `src/app/`: `(tabs)/index, habits, progress, you`; `habits/new`, `habits/[id]`, `reading/[id]` (modal); `onboarding`; `_layout.tsx` со `Stack.Protected` |
| Домен (pure) | `src/features/habits/habit.validation.ts`, `habit-type.ts`, `habit-template.ts`, `completions.ts`; `src/features/streaks/*`; `src/features/progress/build-habit-heatmap.ts`; `src/features/reading/reading.validation.ts`, `reading-summary.ts`; `src/lib/dates.ts` |
| Сервис | `src/features/habits/habit.service.ts`: `createHabit`, `editHabit`, `setArchived`, `setCompletion`, `setLapse`, `saveReading`, `loadAll` |
| Репозиторий (SQL) | `src/features/habits/habit.repository.ts`, `src/features/settings/settings.repository.ts` |
| БД | `src/db/database.ts`, `src/db/migrations.ts` (`PRAGMA user_version`) |
| Store | `src/features/habits/habit-store.tsx`: React context, очередь записей, `createHabit(input: HabitInput)` |

### Схема SQLite: **v3** (а не v2, как в ТЗ)
- **v1:** таблицы `habits`, `habit_completions`, `settings`.
- **v2:** `habits.type` (`build`|`break`) и таблица `habit_lapses`.
- **v3:**
  - `habits.template` (`'read_more'` | NULL);
  - `habits.target_minutes` (INTEGER | NULL);
  - таблица `habit_day_metrics(id, habit_id FK, local_date, minutes INT NOT NULL CHECK ≥0, pages INT NULL CHECK ≥0, recorded_at, updated_at, UNIQUE(habit_id, local_date))`.

### Доменные типы (`src/features/habits/habit.types.ts`)

```ts
type HabitInput = {
  type: 'build' | 'break';
  template: 'read_more' | null;
  targetMinutes: number | null;
  name: string;
  icon: string;
  color: string;
  scheduleDays: number[];
  reminderTime: string | null;
};
```

`validateHabitInput` проверяет:
- имя: trim, схлопывание пробелов, 1–40 символов;
- `scheduleDays`: целые 0–6, без дубликатов, не пусто;
- `reminderTime`: `HH:mm`;
- `type` и `template` по allowlist;
- `targetMinutes`: целое 1–600 или null;
- `icon` и `color`: **только «не пустые»**, без allowlist.

### Read More: **уже реализован** (коммит `7897edb`)
- Шаблон описан в `READ_MORE_TEMPLATE` (`habit-template.ts`).
  - Значения по умолчанию: `Read`, build, все дни, `📚`, `#FF8737`, цель 15.
- Ввод чтения:
  - модальное окно `app/reading/[id].tsx`;
  - минуты от 0 до 1440, страницы от 0 до 10000 или null;
  - только за сегодня, повторное сохранение делает upsert;
  - защита от двойного тапа через `lib/use-single-flight.ts`.
- Сводка: `ReadingSummaryCard` показывает **последние 30 дней и всё время** плюс 7 последних записей.
- Цель **не** засчитывает check-in. Запись чтения не трогает `habit_completions`.

## 2. Что реализовано, а что только задумано

| Элемент ТЗ | Статус |
|---|---|
| Read More: ручные минуты, необязательные страницы, цель не равна check-in | ✅ Реализовано (app) |
| Хранение метрик (`habit_day_metrics`) | ✅ Реализовано (v3) |
| Habit Blueprint v1: типы, JSON Schema, валидатор | ❌ Только в ТЗ |
| Каталог модулей и профиль совместимости | ❌ Только в ТЗ |
| MCP-пакет, tools, stdio | ❌ Только в ТЗ |
| Импорт JSON в приложении: preview, confirm | ❌ Только в ТЗ |
| Planner prompt, Claude Code Skills | ❌ Только в ТЗ |
| Allowlist иконок и цветов в доменной валидации | ❌ Нет (только списки в `theme/colors.ts`) |

## 3. Решение (предлагаемое)

1. **Blueprint — модуль приложения, а не MCP.**
   - Pure-модуль `src/features/blueprint/`: без React Native, Expo и SQLite, только относительные
     импорты.
   - Он содержит единственный runtime-валидатор и маппинг Blueprint → `HabitInput`.
   - Мобильное приложение валидирует импорт этим модулем само. MCP-пакет (Phase 2+) сможет
     переиспользовать тот же код через относительный импорт, но не наоборот: мобильный код
     никогда не импортирует MCP.
2. **Валидатор пишется вручную, без новых зависимостей.**
   - Отклоняет неизвестные ключи на каждом уровне.
   - Ошибки возвращает в виде `{ code, path, message }`.
   - JSON Schema (`habit-blueprint.v1.schema.json`) — опубликованный контракт для клиентов и
     документации. Сверить её с валидатором на фикстурах можно только через `ajv`, а это новая
     devDependency, то есть открытый вопрос (§6).
3. **Каталог отражает только реализованное.**
   - Профиль `read-more@1.0.0`.
   - Модули: `metric.duration_minutes`, `metric.count` (unit `pages`), `widget.metric_entry`,
     `widget.metric_summary`, `logic.manual_check_in`.
   - Числовые лимиты берутся из существующих констант (`MAX_MINUTES_PER_DAY`, `MAX_PAGES_PER_DAY`,
     `MAX_TARGET_MINUTES`), а не дублируются.
4. **Маппинг Blueprint → домен фиксированный.** Таблица ниже — это и есть compatibility profile.
   Generic-движок метрик не вводится.
5. **Схема БД не меняется ни в Phase 1, ни (скорее всего) в Phase 4.** Импорт создаёт одну строку
   `habits` через существующий `createHabit`. Метрики, completions и lapses не импортируются.

### Маппинг Read More Blueprint → существующий домен

| Поле Blueprint | Поле приложения | Правило v1 |
|---|---|---|
| `template.id = "read-more"`, `version "1.0.0"` | `habits.template = 'read_more'` | Явная таблица соответствия, без преобразования строк |
| `habit.name` | `name` | Trim, 1–40 символов (как `validateHabitInput`) |
| `habit.direction` | `type` | Для Read More только `build`, `break` отклоняется |
| `habit.schedule {kind:"weekdays", days}` | `scheduleDays` (JSON) | Целые 0–6 (0 = Sunday), не пусто, **дубликаты — ошибка**, а не нормализация |
| `habit.reminder {localTime}` \| null | `reminderTime` | `HH:mm` 00:00–23:59. Разрешение на уведомления импорт не запрашивает |
| `metrics[reading_minutes]` `metric.duration_minutes` | `habit_day_metrics.minutes` | required, `minimum 0`, `maximum 1440`, integer, ровно как в app |
| `metrics[reading_minutes].goal {daily_target, value}` \| null | `target_minutes` | Целое 1–600 или null |
| `metrics[pages_read]` `metric.count`, unit `pages` | `habit_day_metrics.pages` | `required:false`, 0–10000. Отключить нельзя (см. §4) |
| `widgets[metric_entry]` | `app/reading/[id].tsx` | `allowEditToday: true` — единственное значение |
| `widgets[metric_summary]` | `ReadingSummaryCard` | `period` только `"last_30_days_and_all_time"` (см. §4) |
| `checkIn` | существующий `toggleToday` | `explicit_user_action` + `targetAutomaticallyCompletesHabit: false` — константы |
| `presentation.icon` | `icon` (emoji) | Allowlist из `HABIT_ICONS` (см. §4) |
| `presentation.colorToken` | `color` (hex) | Allowlist именованных токенов → hex из `HABIT_COLORS` (см. §4) |
| `blueprintId`, `metadata` | — | В БД не попадают; habit ID генерирует приложение (`randomUUID`) |

## 4. Расхождения ТЗ с фактическим кодом

1. **Версия схемы.** В ТЗ v2 (по снимку `58959b8`), фактически v3. Read More и
   `habit_day_metrics` уже есть, кандидат `habit_metric_entries` не нужен.
2. **ID шаблона.** В ТЗ `read-more`, в коде и БД `read_more`. Решение: в Blueprint оставить
   `read-more` и маппить явной таблицей. Значение в БД не менять, иначе понадобится миграция
   данных.
3. **Иконки.** В ТЗ `"icon": "book-open"`, а в приложении emoji из `HABIT_ICONS`, символьных
   имён нет. Решение: в v1 разрешить emoji строго из `HABIT_ICONS` или ввести собственные
   токены-имена для этих 20 emoji. Нужно выбрать (§6).
4. **Цвета.** В ТЗ `"colorToken": "flame-orange"`, в приложении hex из `HABIT_COLORS`.
   Именованных токенов нет, есть только комментарии `ember, amber, mint, lagoon, sky, lilac,
   rose, coral`. Предложение: токены = эти 8 имён, маппинг в hex в каталоге.
5. **Период сводки.** `period: "current_streak_window"` из примера в приложении не реализован.
   `ReadingSummaryCard` показывает последние 30 дней, всё время и 7 последних записей. В v1
   разрешить только фактический период.
6. **Подписи метрик.** В Blueprint есть `label` («Reading time», «Pages read»). В приложении
   подписи фиксированы в UI («Minutes read», «Pages (optional)») и нигде не хранятся.
   Варианты: убрать `label` из v1 или сделать его константой профиля, которая игнорируется при
   импорте. Произвольные подписи не поддерживаются.
7. **Отключение страниц** (сценарий 14.2). В приложении поле страниц всегда показано и всегда
   необязательно, флага «отключено» в данных нет. В v1 `pages_read` остаётся обязательным
   элементом массива с `required:false`. Пропуск метрики не поддерживать без изменения UI и
   схемы.
8. **Направление Read More.** ТЗ требует отклонять `break` (сценарий 14.6), а форма
   редактирования приложения сейчас **позволяет** переключить Read More в Break. Валидатор
   Blueprint это отклонит, но в самом приложении несоответствие остаётся. Это отдельная небольшая
   правка UX (запретить смену направления для шаблона), вне Phase 1.
9. **Allowlist иконок и цветов.** `validateHabitInput` его не проверяет. Импорт обязан проверять
   allowlist в валидаторе Blueprint. Ручной ввод не пострадает: в форме выбор и так только из
   списка.
10. **Дубликаты дней.** `normalizeScheduleDays` молча удаляет дубликаты, а ТЗ (сценарий 14.8)
    требует ошибку. Валидатор Blueprint должен отклонять их строго, без нормализации.
11. **Цель в UI.** Форма меняет цель шагом 5, но валидатор принимает любое целое 1–600. Импорт
    цели 17 корректен, а форма потом будет шагать от 17. Это не ошибка, просто стоит учесть.
12. **Опечатка в ТЗ.** В §12 написано «проектирование בלבד» (иврит), по смыслу «только
    проектирование».

## 5. Риски

| Риск | Влияние | Митигация |
|---|---|---|
| Корневой `tsconfig` (`**/*.ts`), ESLint и Jest подхватят `tools/flame-mcp/**` | Ошибки typecheck и lint приложения, Node-тесты под `jest-expo` | В Phase 2 добавить `exclude` в tsconfig, `ignores` в ESLint и `testPathIgnorePatterns` в Jest. Это конфиг, нужно согласование |
| Общий код Blueprint с alias `@/` не соберётся вне Metro/Jest | MCP не сможет импортировать валидатор | В `src/features/blueprint/` только относительные импорты и только pure-модули (`lib/dates`, `reading.validation`, `theme/colors` — все pure) |
| Расхождение JSON Schema и рукописного валидатора | Клиенты получают неверный контракт | Тест паритета на фикстурах (нужен `ajv` как devDependency) или генерация схемы. Открытый вопрос |
| Read More можно переключить в Break внутри приложения | Нарушение профиля после импорта | Отдельный фикс UX. Импорт всегда создаёт build |
| Импорт с напоминанием | Неожиданный системный запрос разрешения | Импорт сохраняет время, разрешение не запрашивает. Действуют существующие правила (`reminder.service`) |
| Двойное подтверждение импорта | Дубль привычки | `useSingleFlight` (уже есть) + одна вставка через `createHabit` |
| Несогласованность каталога и UI в будущем | AI обещает несуществующее | Каталог — константы рядом с доменом; тест «каждый module ID имеет реализацию» |
| Expo Go 57 | Импорт файла требует нативных модулей (`expo-document-picker`, `expo-clipboard` не установлены) | В Phase 4 начать с вставки JSON в `TextInput`, без зависимостей |
| MCP SDK, Claude Desktop и формат Skills не проверены | Устаревшие предположения | Сверить официальную документацию в начале Phase 2 и Phase 5 |

## 6. Открытые вопросы (нужно решение до или в Phase 1)

1. **Иконка:** emoji из `HABIT_ICONS` напрямую или именованные токены?
2. **Цвет:** утвердить токены `ember…coral` → hex?
3. **`label` метрик:** убрать из v1 или зафиксировать константами профиля?
4. **Паритет схемы:** добавить `ajv` как devDependency для теста (только dev, вне бандла) или
   ограничиться рукописным валидатором и вручную поддерживаемой JSON Schema?
5. **Где хранить JSON Schema:** в `src/features/blueprint/schema/` (рядом с валидатором) или в
   будущем `tools/flame-mcp/schemas/`? Предлагаю первое, и MCP будет ссылаться на него.
6. **`metadata.createdAt`:** генерирует MCP. На телефоне только проверять формат или
   игнорировать?
7. **Лимит размера импорта:** 256 KB? Для Read More реальный документ ~2 KB, можно 64 KB.

## 7. Phase 1: минимальный список файлов

Только новые pure-файлы в одной папке. Без зависимостей, миграций, правок конфигов и UI.

```text
src/features/blueprint/
  blueprint.types.ts            HabitBlueprintV1 и вложенные типы, коды ошибок
  catalog.ts                    SCHEMA_VERSION, CATALOG_VERSION, профиль read-more@1.0.0:
                                module IDs/версии, allowlist icon/color, лимиты из существующих констант
  validate-blueprint.ts         validateBlueprint(unknown): строгая проверка ключей/типов/диапазонов,
                                { valid, errors[{code,path,message}], warnings[], value? }
  blueprint-to-habit-input.ts   pure-маппинг валидного Blueprint → HabitInput (для Phase 4 и тестов)
  schema/habit-blueprint.v1.schema.json   опубликованный контракт (additionalProperties:false)
  __fixtures__/read-more.v1.json          эталонный валидный документ
  validate-blueprint.test.ts    сценарии ТЗ §14 (п. 4–9 и др.), граничные значения
  blueprint-to-habit-input.test.ts        маппинг → validateHabitInput(...) без ошибок
```

Что делает каждая часть:
- **`validate-blueprint.test.ts`** покрывает:
  - валидный fixture;
  - неизвестный ключ на любом уровне;
  - `widget.custom_code`, `postImportCommand`;
  - неизвестные `schemaVersion`, `catalogVersion` и версии модулей;
  - `direction: break`;
  - минуты −1, дробные, строкой, выше лимита;
  - цель 0 и 601;
  - день 7, дубли, не-число, пустой список;
  - `HH:mm` 24:00 и 7:30;
  - имя пустое, длиннее 40, только пробелы;
  - иконку и цвет вне allowlist;
  - `targetAutomaticallyCompletesHabit: true`;
  - дубликаты id метрик и виджетов;
  - виджет, ссылающийся на неизвестную метрику;
  - не-объект, `null`, массив, вложенный prototype-ключ (`__proto__`).
- **`blueprint-to-habit-input.test.ts`** проверяет:
  - результат проходит существующий `validateHabitInput`;
  - `template: 'read_more'`, `type: 'build'`;
  - `blueprintId` не становится habit ID.

**Критерий готовности Phase 1:** `npm run typecheck`, `npm run lint` и `npm test` зелёные;
`git diff` содержит только `src/features/blueprint/**`; приложение и бандл не изменились (модуль
ещё ни откуда не импортируется).

**После Phase 1, отдельными шагами и только по согласованию:**
- **Phase 2:** изоляция `tools/flame-mcp` в tsconfig, ESLint и Jest, затем выбор MCP SDK по
  официальной документации.
- **Фикс UX:** запрет смены направления у Read More.

---

## 8. Принятые решения (2026-10-20) и статус Phase 1

Решения пользователя по §6:
1. **Иконка:** именованные токены (`book-open`, `sun`, … — 20 штук, однозначно маппятся на `HABIT_ICONS`).
2. **Цвет:** токены `ember, amber, mint, lagoon, sky, lilac, rose, coral` → `HABIT_COLORS`.
3. **`label` метрик:** фиксированные константы профиля (`Reading time`, `Pages read`). Любое
   другое значение отклоняется.
4. **Паритет схемы:** `ajv@^8.20.0` добавлен только в devDependencies. Тест проверяет, что JSON
   Schema и валидатор согласны на фикстурах.
5. **Лимит импорта:** 256 KB (UTF-8 байты исходного текста), `MAX_BLUEPRINT_BYTES`.

Вопросы 5–6 §6 решены по предложению: схема лежит в `src/features/blueprint/schema/`, а
`metadata.createdAt` проверяется только по формату ISO 8601 и в БД не попадает.

**Phase 1 реализована** (без коммита, ждёт ревью). Все файлы в `src/features/blueprint/`:
- `catalog.ts`, `blueprint.types.ts`, `validate-blueprint.ts` — переиспользуемые: относительные
  импорты только «без-импортных» модулей (`theme/colors`, `reading/reading.validation`);
- `blueprint-to-habit-input.ts` — только для приложения (тип `HabitInput` через `@/`);
- `schema/habit-blueprint.v1.schema.json` (draft-07), `__fixtures__/read-more.v1.json`;
- `validate-blueprint.test.ts`, `blueprint-to-habit-input.test.ts`.

Модуль ниоткуда в приложении не импортируется, поэтому бандл не изменился. Схема БД, UI и
конфиги не тронуты. Изменены только `package.json` и `package-lock.json` (devDependency `ajv`).

Проверки 2026-10-20:
- `npm run typecheck` ✅
- `npm run lint` ✅ (0 проблем)
- `npm test` ✅ (13 suites, 227/227)
- `npx expo-doctor` ✅ (21/21)

## 9. Статус Phase 2 (read-only MCP tools)

**Проверено по официальной документации (2026-10-20):**
- `@modelcontextprotocol/sdk` **1.32.1** (latest): `McpServer`, `registerTool`,
  `StdioServerTransport`, `InMemoryTransport`, zod `^3.25 || ^4`;
- для stdio — логирование только в stderr;
- Claude Desktop: `mcpServers` с `command`/`args`/`env`, абсолютные пути, логи в
  `~/Library/Logs/Claude/mcp-server-*.log`.

**Реализовано: пакет `tools/flame-mcp/`.**
- Свой `package.json` и lockfile. Зависимости: `@modelcontextprotocol/sdk@^1.32.1`, `zod@^4.6.7`.
  Dev: `typescript`, `@types/node`, `tsx`, `esbuild`.
- Инструменты:
  - `get_capabilities` — без аргументов, лишние отклоняются;
  - `get_templates` — необязательный `templateId` из allowlist, `.strict()`.
- Оба инструмента помечены `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`.
- Каталог импортируется из приложения (`src/features/blueprint/catalog.ts`). Туда добавлен
  `READ_MORE_DEFAULTS`, тест сверяет его с `READ_MORE_TEMPLATE.defaults`.
- Изоляция в корне:
  - `tsconfig.exclude: ["tools/**"]`;
  - в ESLint `ignores: 'tools/**'`;
  - в Jest `testPathIgnorePatterns` и `modulePathIgnorePatterns` для `<rootDir>/tools/`.
- Хеш iOS-бандла не изменился (`0bd9eba8…`).

**Проверки:**
- `tools/flame-mcp`:
  - `npm run typecheck` ✅
  - `npm test` ✅ 15/15: контракт через in-memory клиент, реальный stdio-запуск `dist/index.js`,
    тесты изоляции (нет fs/net/shell/db/eval; приложение не импортирует пакет).
- Корень:
  - `npm run typecheck` ✅
  - `npm run lint` ✅
  - `npm test` ✅ 13 suites, 228/228
  - `npx expo-doctor` ✅ 21/21

**Не сделано в этой фазе:**
- Конфиг Claude Desktop пользователя не менялся: это файл вне репозитория, инструкция есть в
  `tools/flame-mcp/README.md`.
- Draft-инструменты — Phase 3.

## 10. Статус Phase 3 (draft lifecycle)

**Реализовано в `tools/flame-mcp`:**
- Инструменты:
  - `create_draft`, `update_draft` — пишут только в память сессии;
  - `get_draft`, `validate_draft` — read-only.
- **Черновики** (`drafts/draft-store.ts`):
  - хранятся in-memory, не больше 20 на сессию;
  - ID генерирует сервер: `draft_` + 32 hex из `node:crypto`;
  - есть ревизия; любое изменение сбрасывает `validationStatus` в `not_validated`;
  - на диск ничего не пишется.
- **Фабрика** (`drafts/read-more-factory.ts`) берёт фиксированные части из каталога. Клиент
  может задать только `name`, `direction`, `scheduleDays`, `reminderTime`,
  `dailyTargetMinutes`, `icon` и `colorToken`.
- **Входные схемы** — zod `.strict()`: неизвестные ключи, JSON-Patch и пути отклоняются.
- **Ошибки инструментов:** `isError` + `{ code, message }` (`draft_not_found`,
  `too_many_drafts`, `internal_error`). Ошибки валидации: `{ code, path, message }` из
  валидатора приложения.
- **Невалидные значения не переписываются молча.** Например, `direction: "break"` сохраняется
  в черновике, а валидация возвращает `incompatible_direction`.
- `get_capabilities` объявляет 6 инструментов и ограничения `drafts-in-memory-only`,
  `export-not-available-yet`.

**Проверки:** `tools/flame-mcp` — `npm run typecheck` ✅, `npm test` ✅ 42/42.

## 11. Статус Phase 4 (export/import)

**MCP — `export_draft(draftId, format: "json")`:**
- всегда заново валидирует текущую ревизию;
- невалидный черновик → `draft_invalid` с ошибками;
- возвращает нормализованный JSON-текст (первый content item), размер (≤ 256 KB) и
  предлагаемое имя `flame-<draftId>.json`, производное только от серверного ID;
- в файлы не пишет, путь или имя файла не принимает, не утверждает, что что-то установлено;
- `get_capabilities` объявляет 7 инструментов и ограничение `export-returns-json-text-only`.

**Приложение — Habits › Import (`src/app/habits/import.tsx`):**
- **Перенос:** вставка текста без новых зависимостей. С Mac на iPhone работает через Universal
  Clipboard.
- **Проверка:** `prepareImport` (`src/features/blueprint/import-blueprint.ts`):
  - лимит размера, разбор JSON и строгий `validateBlueprint`;
  - маппинг → `validateHabitInput` как второй барьер.
- **Preview:**
  - Create habit / Edit details (обычная `HabitForm`, предзаполненная) / Cancel;
  - пользовательский текст выводится только как plain text.
- **Создание:** только через существующий `createHabit`, одна вставка `habits` с новым UUID.
  - Повторные тапы гасит `useSingleFlight`.
  - Ошибка записи показывается, preview остаётся, частичных записей нет.
  - Метрики, completions и lapses не импортируются.
- **Схема БД не менялась** (v3). MCP SDK в бандл приложения не попадает; валидатор Blueprint
  попадает, это и есть импорт.

**Проверки:**
- `tools/flame-mcp`:
  - `npm run typecheck` ✅
  - `npm test` ✅ 47/47
- Корень:
  - `npm run typecheck` ✅
  - `npm run lint` ✅
  - `npm test` ✅ 242/242
  - `npx expo-doctor` ✅ 21/21

## 12. Статус Phase 5 (planner workflow)

**Сделано:**
- **Промпт** `prompts/flame-habit-planner-v1.md` (v1.0.0). Это §9 ТЗ, привязанный к
  фактическим инструментам, токенам, путям импорта и семантике Read More. Правки промпта
  выпускаются новой версией файла.
- **MCP prompt `flame-habit-planner`:**
  - необязательный аргумент `goal` (≤ 500 символов) передаётся отдельным сообщением в
    `<goal>…</goal>` как данные; теги внутри ввода вырезаются;
  - текст встроен в сборку, тест сверяет его с `.md`;
  - `get_capabilities` объявляет промпт.
- **Тесты:**
  - `workflow.test.ts` — сквозные сценарии §14 (1, 2, 3, 6 и «неизвестный шаблон») с проверкой
    итогового JSON через `parseBlueprintJson` приложения;
  - `prompts.test.ts` — совпадение с файлом, ограждение цели, ключевые правила, упоминаются
    только существующие инструменты.
- **Ручной сценарий** для Claude Desktop: `docs/ai-constructor-manual-test.md`.

**Не проверено:** поведение модели в реальном диалоге. Нужна ручная проверка по сценарию;
автотест модель не запускает (нет API-ключа, и приложению он не нужен).

**Проверки:** `tools/flame-mcp` — `npm run typecheck` ✅, `npm test` ✅ 59/59.
