import express from "express";
import rootRouter from "./routes/root.js";

const app = express();
app.use(express.json());

app.use("/", rootRouter);

export default app;
