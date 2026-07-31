// DynamoDB key builders for ContextKeeper single-table design.
// See CLAUDE.md section 7 for the full schema.

/**
 * Normalize a person name for use as a key component.
 * Lowercases, trims, and collapses internal whitespace.
 * Store the original casing separately in `personDisplay`.
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** PK for all user-scoped entities: `USER#<userId>` */
export function makeUserPK(userId: string): string {
  return `USER#${userId}`;
}

/** SK for a capture: `CAPTURE#<createdAt>#<captureId>` — createdAt-first for reverse-chronological queries */
export function makeCaptureSK(createdAt: string, captureId: string): string {
  return `CAPTURE#${createdAt}#${captureId}`;
}

/** SK for an item: `ITEM#<itemId>` */
export function makeItemSK(itemId: string): string {
  return `ITEM#${itemId}`;
}

/** SK for a person rollup: `PERSON#<normalizedName>` */
export function makePersonSK(normalizedName: string): string {
  return `PERSON#${normalizedName}`;
}

/** GSI1 PK — items by type: `USER#<userId>#TYPE#<type>` */
export function makeGSI1PK(userId: string, type: string): string {
  return `USER#${userId}#TYPE#${type}`;
}

const NO_DUE_DATE = '9999-12-31';

/** GSI1 SK — sort by status then due date: `<status>#<dueDate|9999-12-31>#<itemId>` */
export function makeGSI1SK(status: string, dueDate: string | null, itemId: string): string {
  return `${status}#${dueDate ?? NO_DUE_DATE}#${itemId}`;
}

/** GSI2 PK — items by person: `USER#<userId>#PERSON#<normalizedName>` */
export function makeGSI2PK(userId: string, normalizedName: string): string {
  return `USER#${userId}#PERSON#${normalizedName}`;
}

/** GSI2 SK — sort by creation time */
export function makeGSI2SK(createdAt: string): string {
  return createdAt;
}
