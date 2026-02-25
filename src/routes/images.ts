import { Router } from "express";
import { mockImages } from "../mockObjects.js";

const router = Router();

router.get("/", (req, res) => res.json({ items: mockImages }));

export default router;
