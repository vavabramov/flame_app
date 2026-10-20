/**
 * Builds a Read More blueprint from the catalog profile and defaults, applying
 * only the allowlisted user parameters. Fixed parts (modules, versions, metrics,
 * widgets, check-in policy) always come from the catalog, never from the client.
 */
import { READ_MORE_DEFAULTS, READ_MORE_PROFILE } from '../catalog/index';

/** The only fields a client may set on a Read More draft. */
export type ReadMoreParams = {
  name?: string;
  /** Accepted so the validator can explain that Break isn't supported for Read More. */
  direction?: 'build' | 'break';
  scheduleDays?: number[];
  reminderTime?: string | null;
  dailyTargetMinutes?: number | null;
  icon?: string;
  colorToken?: string;
};

export type ReadMoreSettings = Required<ReadMoreParams>;

export const defaultReadMoreSettings = (): ReadMoreSettings => ({
  name: READ_MORE_DEFAULTS.name,
  direction: READ_MORE_DEFAULTS.direction,
  scheduleDays: [...READ_MORE_DEFAULTS.days],
  reminderTime: READ_MORE_DEFAULTS.reminder,
  dailyTargetMinutes: READ_MORE_DEFAULTS.targetMinutes,
  icon: READ_MORE_DEFAULTS.icon,
  colorToken: READ_MORE_DEFAULTS.colorToken,
});

/** Applies a patch; `undefined` keeps the current value, `null` clears nullable fields. */
export function applyParams(current: ReadMoreSettings, patch: ReadMoreParams): ReadMoreSettings {
  const next = { ...current, scheduleDays: [...current.scheduleDays] };
  for (const key of Object.keys(patch) as (keyof ReadMoreParams)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    (next as Record<string, unknown>)[key] = Array.isArray(value) ? [...value] : value;
  }
  return next;
}

/** The full blueprint document for a draft. Not validated here. */
export function buildReadMoreBlueprint(
  draftId: string,
  settings: ReadMoreSettings,
  createdAt: string,
): Record<string, unknown> {
  const p = READ_MORE_PROFILE;
  const minutes = p.metrics.reading_minutes;
  const pages = p.metrics.pages_read;
  return {
    schemaVersion: '1.0.0',
    kind: 'flame.habit-blueprint',
    blueprintId: draftId,
    catalogVersion: '1.0.0',
    template: { id: p.template.id, version: p.template.version },
    habit: {
      name: settings.name,
      direction: settings.direction,
      schedule: { kind: 'weekdays', days: [...settings.scheduleDays] },
      reminder: settings.reminderTime === null ? null : { localTime: settings.reminderTime },
    },
    metrics: [
      {
        id: 'reading_minutes',
        moduleId: minutes.moduleId,
        version: minutes.version,
        label: minutes.label,
        required: minutes.required,
        unit: minutes.unit,
        entryMode: minutes.entryMode,
        constraints: { ...minutes.constraints },
        goal: settings.dailyTargetMinutes === null ? null : { kind: 'daily_target', value: settings.dailyTargetMinutes },
      },
      {
        id: 'pages_read',
        moduleId: pages.moduleId,
        version: pages.version,
        label: pages.label,
        required: pages.required,
        unit: pages.unit,
        entryMode: pages.entryMode,
        constraints: { ...pages.constraints },
        goal: null,
      },
    ],
    widgets: [
      {
        id: 'daily_metric_entry',
        moduleId: p.widgets.daily_metric_entry.moduleId,
        version: p.widgets.daily_metric_entry.version,
        config: { metricIds: [...p.widgets.daily_metric_entry.config.metricIds], allowEditToday: true },
      },
      {
        id: 'metric_summary',
        moduleId: p.widgets.metric_summary.moduleId,
        version: p.widgets.metric_summary.version,
        config: { metricIds: [...p.widgets.metric_summary.config.metricIds], period: p.widgets.metric_summary.config.period },
      },
    ],
    checkIn: { ...p.checkIn },
    presentation: { icon: settings.icon, colorToken: settings.colorToken },
    metadata: { createdBy: 'ai-draft', createdAt },
  };
}
