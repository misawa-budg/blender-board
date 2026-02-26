import { Router } from "express";

const router = Router();

const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Blender Board API",
    version: "1.0.0",
    description: "3Dモデル・画像投稿API",
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/images": {
      get: {
        summary: "画像一覧",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          {
            name: "sort",
            in: "query",
            schema: { type: "string", enum: ["id", "createdAt", "title"] },
          },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListResponse" },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        summary: "画像投稿",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["title", "author", "file"],
                properties: {
                  title: { type: "string" },
                  author: { type: "string" },
                  file: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    item: { $ref: "#/components/schemas/MediaItem" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/images/{id}": {
      get: {
        summary: "画像詳細",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    item: { $ref: "#/components/schemas/MediaItem" },
                  },
                },
              },
            },
          },
          "404": {
            description: "Not Found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      patch: {
        summary: "画像更新",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  author: { type: "string" },
                  file: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    item: { $ref: "#/components/schemas/MediaItem" },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        summary: "画像削除",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        responses: {
          "204": { description: "No Content" },
        },
      },
    },
    "/api/models": {
      get: {
        summary: "モデル一覧",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          {
            name: "sort",
            in: "query",
            schema: { type: "string", enum: ["id", "createdAt", "title"] },
          },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListResponse" },
              },
            },
          },
        },
      },
      post: {
        summary: "モデル投稿",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["title", "author", "file"],
                properties: {
                  title: { type: "string" },
                  author: { type: "string" },
                  file: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    item: { $ref: "#/components/schemas/MediaItem" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/models/{id}": {
      get: {
        summary: "モデル詳細",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    item: { $ref: "#/components/schemas/MediaItem" },
                  },
                },
              },
            },
          },
        },
      },
      patch: {
        summary: "モデル更新",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  author: { type: "string" },
                  file: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
        },
      },
      delete: {
        summary: "モデル削除",
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        responses: {
          "204": { description: "No Content" },
        },
      },
    },
  },
  components: {
    parameters: {
      IdParam: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "integer", minimum: 1 },
      },
    },
    schemas: {
      MediaItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          author: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          originalName: { type: "string" },
          mimeType: { type: "string" },
          fileSize: { type: "integer" },
          downloadUrl: { type: "string" },
        },
      },
      ListResponse: {
        type: "object",
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/MediaItem" } },
          meta: {
            type: "object",
            properties: {
              total: { type: "integer" },
              page: { type: "integer" },
              limit: { type: ["integer", "null"] },
              sort: { type: "string", enum: ["id", "createdAt", "title"] },
              order: { type: "string", enum: ["asc", "desc"] },
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
          code: { type: "string" },
        },
      },
    },
  },
} as const;

router.get("/", (_req, res) => {
  return res.json(openApiDocument);
});

export default router;
