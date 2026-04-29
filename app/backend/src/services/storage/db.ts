import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createFileStore, type FileStore } from "./fileStore.js";
import { createStorageRepositories, type StorageRepositories } from "./repositories/index.js";

const MIGRATIONS_TABLE = "schema_migrations";

interface MigrationFile {
  filename: string;
  sql: string;
}

export interface StorageContext {
  db: DatabaseSync;
  fileStore: FileStore;
  repositories: StorageRepositories;
}

export interface StorageInitOptions {
  dbPath?: string;
  migrationsDir?: string;
  dataDir?: string;
}

let storageContext: StorageContext | null = null;
const storageDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(storageDir, "../../..");
const repoRoot = resolve(backendRoot, "../..");

async function loadMigrationFiles(migrationsDir: string): Promise<MigrationFile[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const migrationFiles: MigrationFile[] = [];
  for (const filename of files) {
    const sql = await readFile(resolve(migrationsDir, filename), "utf8");
    migrationFiles.push({ filename, sql });
  }

  return migrationFiles;
}

async function ensureWritableDatabaseFile(dbPath: string): Promise<void> {
  try {
    const source = await readFile(dbPath, "utf8");
    if (!source.includes("SQLite database file placeholder")) {
      return;
    }

    await writeFile(dbPath, "", "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function ensureMigrationsTable(db: DatabaseSync): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`
  );
}

function getAppliedMigrationFilenames(db: DatabaseSync): Set<string> {
  const rows = db.prepare(`SELECT filename FROM ${MIGRATIONS_TABLE}`).all() as Array<{ filename: string }>;
  return new Set(rows.map((row) => row.filename));
}

function applyMigration(db: DatabaseSync, migration: MigrationFile): void {
  const insertAppliedMigration = db.prepare(
    `INSERT INTO ${MIGRATIONS_TABLE} (filename, applied_at) VALUES (?, ?)`
  );
  const appliedAt = new Date().toISOString();

  db.exec("BEGIN");
  try {
    db.exec(migration.sql);
    insertAppliedMigration.run(migration.filename, appliedAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function applyPendingMigrations(db: DatabaseSync, migrationsDir: string): Promise<void> {
  ensureMigrationsTable(db);
  const applied = getAppliedMigrationFilenames(db);
  const migrations = await loadMigrationFiles(migrationsDir);

  for (const migration of migrations) {
    if (applied.has(migration.filename)) {
      continue;
    }

    applyMigration(db, migration);
  }
}

export async function initializeStorage(options: StorageInitOptions = {}): Promise<StorageContext> {
  if (storageContext) {
    return storageContext;
  }

  const dbPath = options.dbPath ?? resolve(repoRoot, "data/app.db");
  const migrationsDir = options.migrationsDir ?? resolve(backendRoot, "migrations");
  const dataDir = options.dataDir ?? resolve(repoRoot, "data");

  await mkdir(dirname(dbPath), { recursive: true });
  await ensureWritableDatabaseFile(dbPath);

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");

  await applyPendingMigrations(db, migrationsDir);

  const fileStore = createFileStore({ dataRoot: dataDir });
  await fileStore.ensureStorageLayout();

  storageContext = {
    db,
    fileStore,
    repositories: createStorageRepositories(db)
  };

  return storageContext;
}

export function getStorageContext(): StorageContext {
  if (!storageContext) {
    throw new Error("Storage has not been initialized. Call initializeStorage() before using repositories.");
  }

  return storageContext;
}
