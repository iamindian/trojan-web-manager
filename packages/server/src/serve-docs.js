import fs from "fs";
import path from "path";
import send from "koa-send";
import { parse } from "yaml";

export function serveDocs(apiPrefix) {
  const spec = parse(fs.readFileSync(path.resolve(__dirname, "../openapi.yaml"), "utf8"));
  spec.servers = [{ url: apiPrefix || "/", description: "This server" }];
  const assetsRoot = path.dirname(require.resolve("swagger-ui-dist/package.json"));
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trojan Web Manager API</title>
  <link rel="stylesheet" href="/docs/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/docs/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/openapi.json",
      dom_id: "#swagger-ui",
      validatorUrl: null,
      withCredentials: true
    });
  </script>
</body>
</html>`;
  return async (ctx, next) => {
    if (!["GET", "HEAD"].includes(ctx.method)) return next();
    if (ctx.path === "/openapi.json") {
      ctx.body = spec;
    } else if (ctx.path === "/docs" || ctx.path === "/docs/") {
      ctx.type = "html";
      ctx.body = html;
    } else if (["/docs/swagger-ui.css", "/docs/swagger-ui-bundle.js"].includes(ctx.path)) {
      await send(ctx, path.basename(ctx.path), { root: assetsRoot });
    } else if (ctx.path.startsWith("/docs/")) {
      ctx.status = 404;
    } else {
      await next();
    }
  };
}
