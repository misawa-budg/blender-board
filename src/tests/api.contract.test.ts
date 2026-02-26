import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

const createTempFile = (name: string, content: Buffer): string => {
  const path = join(testRootPath, name);
  writeFileSync(path, content);
  return path;
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

test("OpenAPI定義を返す", async () => {
  const response = await api.get("/api/openapi.json");
  assert.equal(response.status, 200);

  assert.equal(response.body.openapi, "3.1.0");
  assert.equal(typeof response.body.paths?.["/api/images"], "object");
  assert.equal(typeof response.body.paths?.["/api/models"], "object");
});

test.after(() => {
  rmSync(testRootPath, { recursive: true, force: true });
});
