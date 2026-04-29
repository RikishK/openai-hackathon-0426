import type { DatabaseSync } from "node:sqlite";

type QueryParam = string | number | bigint | Uint8Array | null;

export function nowIso(): string {
  return new Date().toISOString();
}

export function getDbValue<T>(
  statement: ReturnType<DatabaseSync["prepare"]>,
  ...values: QueryParam[]
): T | null {
  const row = statement.get(...values);
  if (row === undefined) {
    return null;
  }
  return row as T;
}

export function getDbRows<T>(
  statement: ReturnType<DatabaseSync["prepare"]>,
  ...values: QueryParam[]
): T[] {
  return statement.all(...values) as T[];
}
