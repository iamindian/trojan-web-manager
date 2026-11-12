import path from "path";
import send from "koa-send";

export function serveClient(root, apiPrefix) {
  return async (ctx, next) => {
    if (!["GET", "HEAD"].includes(ctx.method) ||
        ctx.path === apiPrefix || ctx.path.startsWith(`${apiPrefix}/`)) {
      return next();
    }
    try {
      await send(ctx, ctx.path, { root, index: "index.html" });
    } catch (error) {
      if (error.status !== 404 || path.extname(ctx.path)) throw error;
    }
    if (!ctx.body && !path.extname(ctx.path)) {
      await send(ctx, "index.html", { root });
    }
  };
}
