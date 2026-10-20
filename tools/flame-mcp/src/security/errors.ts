/** Tool-level errors with a stable code. Never include user text or blueprints. */
export type ToolErrorCode = 'draft_not_found' | 'too_many_drafts';

export class ToolError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}
