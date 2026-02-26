import Database from "better-sqlite3";
import { runMigrations } from "./migrations.js";

const databasePath = process.env.BLENDER_BOARD_DB_PATH ?? "blender-board.sqlite";
const db: Database.Database = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

runMigrations(db);

export { db };
