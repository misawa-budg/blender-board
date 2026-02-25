import { Router } from "express";

const router = Router();

router.get("/", (req, res) => res.send("This is the route '/models'"));

export default router;
