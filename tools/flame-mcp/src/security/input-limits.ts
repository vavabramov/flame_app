/** Hard limits on what clients can send or make the server hold. */
export const MAX_DRAFTS = 20;
/** Server-generated draft IDs: `draft_` + 32 hex characters. */
export const DRAFT_ID_PATTERN = /^draft_[a-f0-9]{32}$/;
/** Generous caps on raw input; the blueprint validator applies the real rules. */
export const MAX_NAME_INPUT = 200;
export const MAX_TOKEN_INPUT = 40;
export const MAX_DAYS_INPUT = 14;
