import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  return res.type("html").send(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blender Board</title>
  </head>
  <body>
    <main>
      <h1>Blender Board</h1>
      <p>Choose a gallery:</p>
      <ul>
        <li><a href="/images">Images</a></li>
        <li><a href="/models">Models</a></li>
      </ul>
      <p>API base: <code>/api/images</code> and <code>/api/models</code></p>
    </main>
  </body>
</html>
  `);
});

export default router;
