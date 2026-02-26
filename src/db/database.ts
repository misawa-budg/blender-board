import Database from "better-sqlite3";
import { runMigrations } from "./migrations.js";

const db: Database.Database = new Database("blender-board.sqlite");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

runMigrations(db);

export { db };
