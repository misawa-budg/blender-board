import express from "express";
import { resolve } from "node:path";
import { errorHandler, notFoundHandler } from "./middlewares/error.js";
import rootRouter from "./routes/root.js";
import modelsRouter from "./routes/models.js";
import imagesRouter from "./routes/images.js";
import { ensureUploadDirectories } from "./utils/storage.js";

const app = express();
ensureUploadDirectories();
app.use(express.json());
app.use("/styles", express.static(resolve(process.cwd(), "public/styles")));
app.use("/scripts", express.static(resolve(process.cwd(), "public/scripts")));

app.get("/images", (_req, res) => {
  return res.sendFile(resolve(process.cwd(), "public/images.html"));
});

app.get("/images/:id", (_req, res) => {
  return res.sendFile(resolve(process.cwd(), "public/detail.html"));
});

app.get("/models", (_req, res) => {
  return res.sendFile(resolve(process.cwd(), "public/models.html"));
});

app.get("/models/:id", (_req, res) => {
  return res.sendFile(resolve(process.cwd(), "public/detail.html"));
});

app.use("/", rootRouter);
app.use("/api/models", modelsRouter);
app.use("/api/images", imagesRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
