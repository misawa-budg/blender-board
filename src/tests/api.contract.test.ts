import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import request from "supertest";

const testRootPath = mkdtempSync(join(tmpdir(), "blender-board-contract-"));
process.env.BLENDER_BOARD_DB_PATH = join(testRootPath, "contract.sqlite");
process.env.BLENDER_BOARD_UPLOAD_ROOT = join(testRootPath, "uploads");

const { default: app } = await import("../app.js");
const api = request(app);

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const glbSignature = Buffer.from([
  0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x00,
]);
const blendSignature = Buffer.from("BLENDER", "ascii");

const createTempFile = (name: string, content: Buffer): string => {
  const path = join(testRootPath, name);
  writeFileSync(path, content);
  return path;
};

const countUploadedFiles = (kind: "images" | "models"): number => {
  const targetPath = join(testRootPath, "uploads", kind);
  try {
    return readdirSync(targetPath, { withFileTypes: true }).filter((entry) => entry.isFile())
      .length;
  } catch {
    return 0;
  }
};

const getErrorPayload = (body: unknown): { error: string; code: string } => {
  assert.equal(typeof body, "object");
  assert.notEqual(body, null);

  const candidate = body as Record<string, unknown>;
  assert.equal(typeof candidate.error, "string");
  assert.equal(typeof candidate.code, "string");
  return { error: candidate.error as string, code: candidate.code as string };
};

test("エラーレスポンスはcodeを含む", async () => {
  const response = await api.get("/api/images/abc");
  assert.equal(response.status, 400);

  const payload = getErrorPayload(response.body);
  assert.equal(payload.code, "bad_request");
});

test("一覧APIはpage/sort/orderを受け取りmetaを返す", async () => {
  const fileA = createTempFile("list-a.png", Buffer.concat([pngSignature, Buffer.from("A")]));
  const fileB = createTempFile("list-b.png", Buffer.concat([pngSignature, Buffer.from("B")]));

  const postA = await api
    .post("/api/images")
    .field("title", "contract-list-b")
    .field("author", "tester")
    .attach("file", fileA);
  assert.equal(postA.status, 201);

  const postB = await api
    .post("/api/images")
    .field("title", "contract-list-a")
    .field("author", "tester")
    .attach("file", fileB);
  assert.equal(postB.status, 201);

  const listResponse = await api.get(
    "/api/images?q=contract-list&limit=1&page=2&sort=title&order=asc"
  );
  assert.equal(listResponse.status, 200);

  assert.equal(typeof listResponse.body, "object");
  assert.notEqual(listResponse.body, null);
  const payload = listResponse.body as { items?: unknown; meta?: Record<string, unknown> };

  assert.ok(Array.isArray(payload.items));
  assert.equal(payload.items.length, 1);
  assert.equal(typeof payload.meta, "object");
  assert.notEqual(payload.meta, null);

  assert.equal(payload.meta?.total, 2);
  assert.equal(payload.meta?.page, 2);
  assert.equal(payload.meta?.limit, 1);
  assert.equal(payload.meta?.sort, "title");
  assert.equal(payload.meta?.order, "asc");
});

test("一覧APIはauthorで絞り込める", async () => {
  const fileA = createTempFile("author-a.png", Buffer.concat([pngSignature, Buffer.from("A")]));
  const fileB = createTempFile("author-b.png", Buffer.concat([pngSignature, Buffer.from("B")]));

  const postA = await api
    .post("/api/images")
    .field("title", "author-filter-a")
    .field("author", "alice")
    .attach("file", fileA);
  assert.equal(postA.status, 201);

  const postB = await api
    .post("/api/images")
    .field("title", "author-filter-b")
    .field("author", "bob")
    .attach("file", fileB);
  assert.equal(postB.status, 201);

  const listResponse = await api.get("/api/images?author=alice&q=author-filter");
  assert.equal(listResponse.status, 200);
  assert.ok(Array.isArray(listResponse.body.items));
  assert.equal(listResponse.body.items.length, 1);
  assert.equal(listResponse.body.items[0].author, "alice");
});

test("page指定時にlimit未指定なら400", async () => {
  const response = await api.get("/api/images?page=2");
  assert.equal(response.status, 400);

  const payload = getErrorPayload(response.body);
  assert.equal(payload.code, "bad_request");
});

test("拡張子偽装ファイルを拒否する", async () => {
  const fakePngPath = createTempFile("invalid-signature.png", Buffer.from("not-image"));
  const response = await api
    .post("/api/images")
    .field("title", "invalid-signature")
    .field("author", "tester")
    .attach("file", fakePngPath);

  assert.equal(response.status, 400);
  const payload = getErrorPayload(response.body);
  assert.equal(payload.code, "invalid_file_signature");
});

test("画像POSTのバリデーション失敗時に保存ファイルを残さない", async () => {
  const filePath = createTempFile(
    "post-validation-cleanup.png",
    Buffer.concat([pngSignature, Buffer.from("VALID")])
  );
  const beforeCount = countUploadedFiles("images");

  const response = await api
    .post("/api/images")
    .field("title", " ")
    .field("author", "cleanup-user")
    .attach("file", filePath);

  assert.equal(response.status, 400);
  const payload = getErrorPayload(response.body);
  assert.equal(payload.code, "bad_request");

  const afterCount = countUploadedFiles("images");
  assert.equal(afterCount, beforeCount);
});

test("モデルPOSTでpreviewFile不正時にsourceFileを残さない", async () => {
  const sourcePath = createTempFile(
    "model-post-cleanup-source.glb",
    Buffer.concat([glbSignature, Buffer.from("SOURCE")])
  );
  const invalidPreviewPath = createTempFile(
    "model-post-cleanup-preview.glb",
    Buffer.from("not-glb-data")
  );
  const beforeCount = countUploadedFiles("models");

  const response = await api
    .post("/api/models")
    .field("title", "cleanup-model")
    .field("author", "cleanup-user")
    .attach("file", sourcePath)
    .attach("previewFile", invalidPreviewPath);

  assert.equal(response.status, 400);
  const payload = getErrorPayload(response.body);
  assert.equal(payload.code, "invalid_file_signature");

  const afterCount = countUploadedFiles("models");
  assert.equal(afterCount, beforeCount);
});

test("画像差し替え時にpreviewUrlが更新される", async () => {
  const firstImagePath = createTempFile(
    "preview-refresh-a.png",
    Buffer.concat([pngSignature, Buffer.from("AAAA")])
  );
  const secondImagePath = createTempFile(
    "preview-refresh-b.png",
    Buffer.concat([pngSignature, Buffer.from("BBBB")])
  );

  const created = await api
    .post("/api/images")
    .field("title", "preview-refresh")
    .field("author", "tester")
    .attach("file", firstImagePath);
  assert.equal(created.status, 201);

  const createdItem = (created.body as { item?: Record<string, unknown> }).item;
  assert.equal(typeof createdItem, "object");
  assert.notEqual(createdItem, null);
  const imageId = Number((createdItem as Record<string, unknown>).id);
  const firstPreviewUrl = (createdItem as Record<string, unknown>).previewUrl;
  assert.equal(typeof firstPreviewUrl, "string");
  assert.match(firstPreviewUrl as string, /\?v=/);

  const patched = await api
    .patch(`/api/images/${imageId}`)
    .field("title", "preview-refresh")
    .field("author", "tester")
    .attach("file", secondImagePath);
  assert.equal(patched.status, 200);

  const patchedItem = (patched.body as { item?: Record<string, unknown> }).item;
  assert.equal(typeof patchedItem, "object");
  assert.notEqual(patchedItem, null);
  const secondPreviewUrl = (patchedItem as Record<string, unknown>).previewUrl;
  assert.equal(typeof secondPreviewUrl, "string");
  assert.match(secondPreviewUrl as string, /\?v=/);
  assert.notEqual(secondPreviewUrl, firstPreviewUrl);
});

test("OpenAPI定義を返す", async () => {
  const response = await api.get("/api/openapi.json");
  assert.equal(response.status, 200);

  assert.equal(response.body.openapi, "3.1.0");
  assert.equal(typeof response.body.paths?.["/api/images"], "object");
  assert.equal(typeof response.body.paths?.["/api/models"], "object");
});

test("画像とモデルの関連付けを保存・取得できる", async () => {
  const modelPath = createTempFile("linked-model.glb", Buffer.concat([glbSignature, Buffer.from("M")]));
  const imagePath = createTempFile("linked-image.png", Buffer.concat([pngSignature, Buffer.from("I")]));

  const modelCreated = await api
    .post("/api/models")
    .field("title", "linked-model")
    .field("author", "tester")
    .attach("file", modelPath);
  assert.equal(modelCreated.status, 201);
  const modelId = Number(modelCreated.body.item.id);

  const imageCreated = await api
    .post("/api/images")
    .field("title", "linked-image")
    .field("author", "tester")
    .field("modelIds", String(modelId))
    .attach("file", imagePath);
  assert.equal(imageCreated.status, 201);
  const imageId = Number(imageCreated.body.item.id);

  const imageDetail = await api.get(`/api/images/${imageId}`);
  assert.equal(imageDetail.status, 200);
  assert.ok(Array.isArray(imageDetail.body.relatedModels));
  assert.equal(imageDetail.body.relatedModels.length, 1);
  assert.equal(imageDetail.body.relatedModels[0].id, modelId);
  assert.equal(typeof imageDetail.body.relatedModels[0].downloadUrl, "string");

  const modelDetail = await api.get(`/api/models/${modelId}`);
  assert.equal(modelDetail.status, 200);
  assert.ok(Array.isArray(modelDetail.body.relatedImages));
  assert.equal(modelDetail.body.relatedImages.length, 1);
  assert.equal(modelDetail.body.relatedImages[0].id, imageId);
});

test("画像PATCHでmodelIdsのみ更新できる", async () => {
  const modelPath = createTempFile("patch-model.glb", Buffer.concat([glbSignature, Buffer.from("P")]));
  const imagePath = createTempFile("patch-image.png", Buffer.concat([pngSignature, Buffer.from("P")]));

  const modelCreated = await api
    .post("/api/models")
    .field("title", "patch-model")
    .field("author", "tester")
    .attach("file", modelPath);
  assert.equal(modelCreated.status, 201);
  const modelId = Number(modelCreated.body.item.id);

  const imageCreated = await api
    .post("/api/images")
    .field("title", "patch-image")
    .field("author", "tester")
    .attach("file", imagePath);
  assert.equal(imageCreated.status, 201);
  const imageId = Number(imageCreated.body.item.id);

  const patched = await api.patch(`/api/images/${imageId}`).field("modelIds", String(modelId));
  assert.equal(patched.status, 200);

  const imageDetail = await api.get(`/api/images/${imageId}`);
  assert.equal(imageDetail.status, 200);
  assert.ok(Array.isArray(imageDetail.body.relatedModels));
  assert.equal(imageDetail.body.relatedModels[0].id, modelId);
});

test("モデル投稿時にpreviewFileを任意添付でき、previewAPIで返せる", async () => {
  const modelSourcePath = createTempFile(
    "preview-source.blend",
    Buffer.concat([blendSignature, Buffer.from("SOURCE")])
  );
  const modelPreviewPath = createTempFile(
    "preview-binary.glb",
    Buffer.concat([glbSignature, Buffer.from("PREVIEW")])
  );

  const created = await api
    .post("/api/models")
    .field("title", "preview-model")
    .field("author", "tester")
    .attach("file", modelSourcePath)
    .attach("previewFile", modelPreviewPath);
  assert.equal(created.status, 201);
  assert.equal(typeof created.body.item.previewUrl, "string");

  const modelId = Number(created.body.item.id);
  const preview = await api.get(`/api/models/${modelId}/preview`);
  assert.equal(preview.status, 200);
  assert.match(String(preview.headers["content-type"] ?? ""), /model\/gltf-binary/);
});

test.after(() => {
  rmSync(testRootPath, { recursive: true, force: true });
});
