import Database from "better-sqlite3";
import { mockImages, mockModels } from "../mockObjects.js";

const db: Database.Database = new Database("blender-board.sqlite");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TEXT NOT NULL,
    filename TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TEXT NOT NULL,
    filename TEXT NOT NULL
  );
`);

const seedModels = (): void => {
  const result = db
    .prepare("SELECT COUNT(*) AS count FROM models")
    .get() as { count: number };
  if (result.count > 0) {
    return;
  }

  const insertModelStatement = db.prepare(`
    INSERT INTO models (title, author, created_at, filename)
    VALUES (@title, @author, @createdAt, @filename)
  `);

  const insertModels = db.transaction(() => {
    for (const model of mockModels) {
      insertModelStatement.run(model);
    }
  });

  insertModels();
};

const seedImages = (): void => {
  const result = db
    .prepare("SELECT COUNT(*) AS count FROM images")
    .get() as { count: number };
  if (result.count > 0) {
    return;
  }

  const insertImageStatement = db.prepare(`
    INSERT INTO images (title, author, created_at, filename)
    VALUES (@title, @author, @createdAt, @filename)
  `);

  const insertImages = db.transaction(() => {
    for (const image of mockImages) {
      insertImageStatement.run(image);
    }
  });

  insertImages();
};

seedModels();
seedImages();

export { db };
