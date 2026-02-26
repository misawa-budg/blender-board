import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  return res.json({
    message: "Blender board API root.",
    routes: [
      { method: "GET", path: "/models", description: "List and search 3D models." },
      { method: "GET", path: "/images", description: "List and search images." },
    ],
  });
});

export default router;
