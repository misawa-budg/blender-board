import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  return res.type("html").send(`
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blender Board</title>
  </head>
  <body>
    <main>
      <h1>Blender Board</h1>
      <p>表示する一覧を選択してください。</p>
      <ul>
        <li><a href="/images">画像</a></li>
        <li><a href="/models">モデル</a></li>
      </ul>
      <p>APIベース: <code>/api/images</code> と <code>/api/models</code></p>
    </main>
  </body>
</html>
  `);
});

export default router;
