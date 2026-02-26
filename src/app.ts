import express from "express";
import { errorHandler, notFoundHandler } from "./middlewares/error.js";
import rootRouter from "./routes/root.js";
import modelsRouter from "./routes/models.js";
import imagesRouter from "./routes/images.js";

const app = express();
app.use(express.json());

app.use("/", rootRouter);
app.use("/models", modelsRouter);
app.use("/images", imagesRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
