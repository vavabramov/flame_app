/** Milestones are reached by total check-ins across all habits, archived ones included. */
export const MILESTONES = [7, 14, 30, 100] as const;

export type MilestoneProgress = {
  reached: number[];
  next: number | null;
  remaining: number;
};

export function milestoneProgress(totalCheckIns: number): MilestoneProgress {
  const reached = MILESTONES.filter((m) => totalCheckIns >= m);
  const next = MILESTONES.find((m) => totalCheckIns < m) ?? null;
  return { reached, next, remaining: next === null ? 0 : next - totalCheckIns };
}
