import dotenv from "dotenv"
import path from "path"
import Koa from "koa";
import Router from "koa-router";
import bodyParser from 'koa-body-parser';
import { Sequelize } from "sequelize";
import { getUsers, getUserExpiration, addUser, init as userService, extendExpiration, extendExpirationById } from "./service/userService.js";
import { v4 as uuidv4 } from 'uuid';
import NodeCache from 'node-cache';
// import https from "https";
import { init as userModel } from "./models/User.model.js";
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);
import yargs from 'yargs'
import { ssh224 } from "./utils/index.js";
const args = yargs(process.argv.slice(2)).argv
if (args.env) {
  dotenv.config({ path: args.env });
} else {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}
console.info('admin:' + process.env.ADMIN);
console.info('admin_password:' + process.env.ADMIN_PASSWORD)
console.info('database:' + process.env.DATABASE)
console.info('host:' + process.env.HOST)
console.info('username:' + process.env.USERNAME)
console.info('password' + process.env.PASSWORD)
const nodeCache = new NodeCache({ stdTTL: 120, checkperiod: 120 });
nodeCache.on('set', (key, value) => {
  console.log(`node cache set ${key}->${value}`)
})
const database = process.env.DATABASE;
const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const sequelize = new Sequelize(database, username, password, {
  dialect: "mysql",
  pool: {
    max: 5,
    idle: 30000,
    acquire: 60000,
    evict: 0
  },
  logging: true,
});
const app = new Koa();
const router = new Router();
const HOST = process.env.HOST;
const HTTP_PORT = process.env.PORT;
// const HTTPS_PORT = 443;
const userAuth = function () {
  return async function (ctx, next) {
    let token = ctx.cookies.get("access_token");
    if (!token) {
      ctx.throw('Access denied. Please login!', 401);
      return
    }
    if (!nodeCache.get(token)) {
      ctx.throw('Access denied. Please login!', 401);
      return
    }
    await next();
  }
}
const cached = async (ctx, key, func) => {
  try {
    if (nodeCache.has(key)) {
      ctx.body = JSON.parse(nodeCache.get(key));
      console.info(`${key} hitted`);
    } else {
      const result = await func()()
      nodeCache.set(key, JSON.stringify(result), 5)
      console.info(`${key} cached`);
      ctx.body = result;
    }
  } catch (e) {
    handleError(ctx, e);
  }

}
function setToken(ctx) {
  const newToken = uuidv4();
  nodeCache.set(newToken, Date.now());
  ctx.cookies.set('access_token', newToken, { httpOnly: true, secure: false, sameSite: "none", secureProxy: true });
  ctx.status = 200;
}
async function start() {
  await userModel(sequelize);
  await userService(sequelize);
  app.use(bodyParser());
  router.use(["/users", "/extend", "/adduser"], userAuth())
  const handleError = function (ctx, e) {
    ctx.body = { error: e.message };
  }
  router
    .get("/signin", async (ctx, next) => {
      const username = ctx.request.query.username;
      const password = ctx.request.query.password;
      try {
        /**
         * update token
         */
        const accessToken = ctx.cookies.get('access_token')
        if (accessToken && nodeCache.has(accessToken)) {
          setToken(ctx)
          return
        }
        /**
         * check username and password
         */
        if (username && password && username === process.env.ADMIN && password === process.env.ADMIN_PASSWORD) {
          setToken(ctx)
          return
        }
        ctx.status = 401;

      } catch (e) {
        handleError(ctx, e);
      }
    })
    .get("/users", async (ctx, next) => {
      const offset = parseInt(ctx.request.query.offset);
      const limit = parseInt(ctx.request.query.limit);
      const id = ctx.request.query.id;
      if (Number.isNaN(offset) || Number.isNaN(limit)) {
        ctx.body = { error: 'wrong params' }
        return;
      }
      let where = {}
      if (id && !Number.isNaN(id)) {
        where = Object.assign({}, where, { id })
      }
      const key = ssh224(`/users`, `${id ? id : ""}:${offset}:${limit}`);
      await cached(ctx, key, () => {
        return async () => {
          return await getUsers(offset, limit, where);
        }
      });

    })
    .get("/expiration", async (ctx, next) => {
      const username = ctx.request.query.username;
      const password = ctx.request.query.password;
      const key = ssh224("/expiration", `${username}:${password}`)
      await cached(ctx, key, () => {
        return async () => {
          return await getUserExpiration(username, password);
        }
      });
    })
    .put("/extend", async (ctx, next) => {
      const username = ctx.request.body.username;
      const password = ctx.request.body.password;
      const quantity = ctx.request.body.quantity;
      try {
        const user = await extendExpiration(username, password, quantity)
        ctx.body = user;
      } catch (e) {
        handleError(ctx, e)
      }

    })
    .put("/extendById", async (ctx, next) => {
      const id = ctx.request.body.id;
      const quantity = ctx.request.body.quantity;
      try {
        const user = await extendExpirationById(id, quantity)
        ctx.body = user;
      } catch (e) {
        handleError(ctx, e)
      }

    })
    .post("/adduser", async (ctx, next) => {
      try {
        const user = ctx.request.body;
        ctx.body = await addUser(user.username, user.password);
      } catch (e) {
        handleError(ctx, e)
      }
    });
  app.use(router.routes());
  const server = await app.listen(parseInt(process.env.PORT), () => {
    console.log(`Server running on http://${process.env.HOST}:${process.env.PORT}`);
  });
  return server;
}
export { sequelize, start, nodeCache }



