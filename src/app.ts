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

app.get("/board", (_req, res) => {
  return res.sendFile(resolve(process.cwd(), "public/board.html"));
});

app.use("/", rootRouter);
app.use("/models", modelsRouter);
app.use("/images", imagesRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
