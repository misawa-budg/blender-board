import type Database from "better-sqlite3";

type Migration = {
  id: string;
  up: (db: Database.Database) => void;
};

const hasColumn = (db: Database.Database, tableName: string, columnName: string): boolean => {
  const rows = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
};

const createMediaTablesMigration: Migration = {
  id: "001_create_media_tables",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at TEXT NOT NULL,
        stored_path TEXT NOT NULL DEFAULT '',
        original_name TEXT NOT NULL DEFAULT '',
        mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        file_size INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at TEXT NOT NULL,
        stored_path TEXT NOT NULL DEFAULT '',
        original_name TEXT NOT NULL DEFAULT '',
        mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        file_size INTEGER NOT NULL DEFAULT 0
      );
    `);
  },
};

const addFileColumnsMigration: Migration = {
  id: "002_add_file_columns_to_existing_tables",
  up: (db) => {
    const tables = ["models", "images"] as const;

    for (const tableName of tables) {
      if (!hasColumn(db, tableName, "stored_path")) {
        db.prepare(`ALTER TABLE ${tableName} ADD COLUMN stored_path TEXT NOT NULL DEFAULT ''`).run();
      }
      if (!hasColumn(db, tableName, "original_name")) {
        db.prepare(`ALTER TABLE ${tableName} ADD COLUMN original_name TEXT NOT NULL DEFAULT ''`).run();
      }
      if (!hasColumn(db, tableName, "mime_type")) {
        db.prepare(
          `ALTER TABLE ${tableName} ADD COLUMN mime_type TEXT NOT NULL DEFAULT 'application/octet-stream'`
        ).run();
      }
      if (!hasColumn(db, tableName, "file_size")) {
        db.prepare(`ALTER TABLE ${tableName} ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0`).run();
      }

      if (hasColumn(db, tableName, "filename")) {
        db.prepare(
          `UPDATE ${tableName} SET stored_path = filename WHERE stored_path = ''`
        ).run();
        db.prepare(
          `UPDATE ${tableName} SET original_name = filename WHERE original_name = ''`
        ).run();
      }
    }
  },
};

const migrations: Migration[] = [createMediaTablesMigration, addFileColumnsMigration];

export const runMigrations = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const hasMigrationStatement = db.prepare(
    "SELECT 1 FROM schema_migrations WHERE id = ? LIMIT 1"
  );
  const insertMigrationStatement = db.prepare(
    "INSERT INTO schema_migrations (id) VALUES (?)"
  );

  for (const migration of migrations) {
    const existing = hasMigrationStatement.get(migration.id);
    if (existing) {
      continue;
    }

    const applyMigration = db.transaction(() => {
      migration.up(db);
      insertMigrationStatement.run(migration.id);
    });

    applyMigration();
  }
};
