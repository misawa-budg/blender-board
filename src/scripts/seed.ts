import { existsSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../db/database.js";
import { ensureUploadDirectories, getUploadDir } from "../utils/storage.js";

type RemoteAsset = {
  name: string;
  url: string;
};

type InsertedModel = {
  id: number;
  author: string;
};

const SEED_PREFIX = "seed-";

const modelSources: RemoteAsset[] = [
  {
    name: "Duck",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb",
  },
  {
    name: "BoxTextured",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoxTextured/glTF-Binary/BoxTextured.glb",
  },
  {
    name: "Fox",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb",
  },
  {
    name: "CesiumMan",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMan/glTF-Binary/CesiumMan.glb",
  },
];

const imageSources: RemoteAsset[] = [
  { name: "ForestLake", url: "https://picsum.photos/id/1015/1280/860.jpg" },
  { name: "Mountains", url: "https://picsum.photos/id/1002/1280/860.jpg" },
  { name: "Field", url: "https://picsum.photos/id/1039/1280/860.jpg" },
  { name: "River", url: "https://picsum.photos/id/1043/1280/860.jpg" },
  { name: "Sky", url: "https://picsum.photos/id/1056/1280/860.jpg" },
  { name: "Road", url: "https://picsum.photos/id/1067/1280/860.jpg" },
  { name: "Clouds", url: "https://picsum.photos/id/1074/1280/860.jpg" },
  { name: "Sunset", url: "https://picsum.photos/id/1084/1280/860.jpg" },
];

const authors = ["Aoi", "Ren", "Mika", "Sora", "Kenta", "Hana"];

const modelCount = 14;
const imageCount = 24;

const fetchCache = new Map<string, Buffer>();

const mimeTypeFromExtension = (extension: ".glb" | ".jpg"): string => {
  if (extension === ".glb") {
    return "model/gltf-binary";
  }
  return "image/jpeg";
};

const buildSeedFilename = (kind: "models" | "images", index: number, extension: ".glb" | ".jpg"): string => {
  const serial = String(index + 1).padStart(3, "0");
  return `${SEED_PREFIX}${kind}-${serial}${extension}`;
};

const buildCreatedAt = (offsetHours: number): string => {
  const date = new Date(Date.now() - offsetHours * 60 * 60 * 1000);
  return date.toISOString();
};

const getSourceAt = (sources: RemoteAsset[], index: number): RemoteAsset => {
  const source = sources[index % sources.length];
  if (!source) {
    throw new Error("シード用アセット定義が空です。");
  }
  return source;
};

const fetchBufferWithRetry = async (url: string, attempts = 3): Promise<Buffer> => {
  if (fetchCache.has(url)) {
    return fetchCache.get(url) as Buffer;
  }

  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fetchCache.set(url, buffer);
      return buffer;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`アセット取得に失敗しました: ${url} (${String(lastError)})`);
};

const unlinkIfExists = async (absolutePath: string): Promise<void> => {
  if (!existsSync(absolutePath)) {
    return;
  }
  await unlink(absolutePath);
};

const cleanupExistingSeedData = async (): Promise<void> => {
  const likePattern = `${SEED_PREFIX}%`;

  const seededModelRows = db
    .prepare(
      `
      SELECT
        stored_path AS storedPath,
        preview_stored_path AS previewStoredPath
      FROM models
      WHERE stored_path LIKE ? OR preview_stored_path LIKE ?
      `
    )
    .all(likePattern, likePattern) as Array<{
    storedPath: string;
    previewStoredPath: string;
  }>;

  const seededImageRows = db
    .prepare(
      `
      SELECT stored_path AS storedPath
      FROM images
      WHERE stored_path LIKE ?
      `
    )
    .all(likePattern) as Array<{ storedPath: string }>;

  const deleteSeedRecords = db.transaction(() => {
    db.prepare("DELETE FROM images WHERE stored_path LIKE ?").run(likePattern);
    db.prepare("DELETE FROM models WHERE stored_path LIKE ? OR preview_stored_path LIKE ?").run(
      likePattern,
      likePattern
    );
  });

  deleteSeedRecords();

  const modelUploadDir = getUploadDir("models");
  const imageUploadDir = getUploadDir("images");

  for (const row of seededModelRows) {
    if (row.storedPath.startsWith(SEED_PREFIX)) {
      await unlinkIfExists(join(modelUploadDir, row.storedPath));
    }
    if (row.previewStoredPath.startsWith(SEED_PREFIX)) {
      await unlinkIfExists(join(modelUploadDir, row.previewStoredPath));
    }
  }

  for (const row of seededImageRows) {
    if (row.storedPath.startsWith(SEED_PREFIX)) {
      await unlinkIfExists(join(imageUploadDir, row.storedPath));
    }
  }
};

const chooseRelatedModelIds = (
  allModels: InsertedModel[],
  modelsByAuthor: Map<string, number[]>,
  author: string,
  index: number
): number[] => {
  const authorModels = modelsByAuthor.get(author) ?? [];
  const pool = authorModels.length > 0 ? authorModels : allModels.map((item) => item.id);

  if (pool.length === 0) {
    return [];
  }

  const linkCount = 1 + (index % 3 === 0 ? 1 : 0);
  const start = index % pool.length;
  const selected: number[] = [];

  for (let cursor = 0; cursor < linkCount; cursor += 1) {
    const id = pool[(start + cursor) % pool.length];
    if (typeof id === "number" && !selected.includes(id)) {
      selected.push(id);
    }
  }

  return selected;
};

const run = async (): Promise<void> => {
  ensureUploadDirectories();

  await cleanupExistingSeedData();

  const modelUploadDir = getUploadDir("models");
  const imageUploadDir = getUploadDir("images");

  const insertModelStatement = db.prepare(
    `
    INSERT INTO models (
      title,
      author,
      created_at,
      filename,
      stored_path,
      original_name,
      mime_type,
      file_size,
      preview_stored_path,
      preview_original_name,
      preview_mime_type,
      preview_file_size
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', '', 0)
    `
  );

  const insertImageStatement = db.prepare(
    `
    INSERT INTO images (
      title,
      author,
      created_at,
      filename,
      stored_path,
      original_name,
      mime_type,
      file_size
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  const insertLinkStatement = db.prepare(
    `
    INSERT OR IGNORE INTO image_model_links (image_id, model_id)
    VALUES (?, ?)
    `
  );

  const insertedModels: InsertedModel[] = [];
  const modelsByAuthor = new Map<string, number[]>();

  for (let index = 0; index < modelCount; index += 1) {
    const source = getSourceAt(modelSources, index);
    const author = authors[index % authors.length] as string;
    const fileBuffer = await fetchBufferWithRetry(source.url);
    const storedPath = buildSeedFilename("models", index, ".glb");
    const originalName = `${source.name}.glb`;
    const createdAt = buildCreatedAt(72 + index * 6);
    const absolutePath = join(modelUploadDir, storedPath);

    await writeFile(absolutePath, fileBuffer);

    const result = insertModelStatement.run(
      `${source.name} Variant ${Math.floor(index / modelSources.length) + 1}`,
      author,
      createdAt,
      storedPath,
      storedPath,
      originalName,
      mimeTypeFromExtension(".glb"),
      fileBuffer.byteLength
    );

    const modelId = Number(result.lastInsertRowid);
    insertedModels.push({ id: modelId, author });
    const existing = modelsByAuthor.get(author) ?? [];
    existing.push(modelId);
    modelsByAuthor.set(author, existing);
  }

  for (let index = 0; index < imageCount; index += 1) {
    const source = getSourceAt(imageSources, index);
    const author = authors[(index + 1) % authors.length] as string;
    const fileBuffer = await fetchBufferWithRetry(source.url);
    const storedPath = buildSeedFilename("images", index, ".jpg");
    const originalName = `${source.name}-${String(index + 1).padStart(2, "0")}.jpg`;
    const createdAt = buildCreatedAt(48 + index * 3);
    const absolutePath = join(imageUploadDir, storedPath);

    await writeFile(absolutePath, fileBuffer);

    const imageResult = insertImageStatement.run(
      `${source.name} Capture ${String(index + 1).padStart(2, "0")}`,
      author,
      createdAt,
      storedPath,
      storedPath,
      originalName,
      mimeTypeFromExtension(".jpg"),
      fileBuffer.byteLength
    );

    const imageId = Number(imageResult.lastInsertRowid);
    const relatedModelIds = chooseRelatedModelIds(insertedModels, modelsByAuthor, author, index);
    for (const modelId of relatedModelIds) {
      insertLinkStatement.run(imageId, modelId);
    }
  }

  const modelTotal = db.prepare("SELECT COUNT(*) AS total FROM models").get() as { total: number };
  const imageTotal = db.prepare("SELECT COUNT(*) AS total FROM images").get() as { total: number };
  const linkTotal = db
    .prepare("SELECT COUNT(*) AS total FROM image_model_links")
    .get() as { total: number };

  console.log("Seed completed.");
  console.log(`models: ${modelTotal.total}`);
  console.log(`images: ${imageTotal.total}`);
  console.log(`image_model_links: ${linkTotal.total}`);
};

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
