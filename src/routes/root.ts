import { Router } from "express";
import { resolve } from "node:path";

const router = Router();

router.get("/", (_req, res) => {
  return res.sendFile(resolve(process.cwd(), "public/index.html"));
});

export default router;
