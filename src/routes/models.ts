import { Router } from "express";
import { mockModels } from "../mockObjects.js";

const router = Router();

router.get("/", (_req, res) => res.json({ items: mockModels }));

export default router;
