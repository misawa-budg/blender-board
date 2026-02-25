import express from "express";
import rootRouter from "./routes/root.js";
import modelsRouter from "./routes/models.js";

const app = express();
app.use(express.json());

app.use("/", rootRouter);
app.use("/models", modelsRouter);

export default app;
