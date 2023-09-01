import dotenv from 'dotenv'
import Koa from "koa";
import Router from "koa-router";
import bodyParser from 'koa-body-parser';
import { Sequelize } from "sequelize";
import { getUsers, getUserExpiration, addUser, init as userService } from "./service/userService.js";
// import https from "https";
import { init as userModel } from "./models/User.model.js";

dotenv.config({ path: `.env` })

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
const userAuth = function(){
  return async function(ctx, next){
    const username = ctx.request.query.username
    const password = ctx.request.query.password
    let pass = false
    if(username===process.env.USERNAME && password ===process.env.PASSWORD){
      pass = true;
    }
    ctx.assert(pass, 401, 'Access denied. Please login!');
    await next();
  }
}
async function start() {
  await userModel(sequelize);
  await userService(sequelize);
  app.use(bodyParser());
  router.use(["/users"],userAuth())
  router
    .get("/users", async (ctx, next) => {
      ctx.body = await getUsers(ctx.request.query.username, ctx.request.query.password);
    })
    .get("/expiration", async (ctx, next) => {
      try {
        ctx.body = await getUserExpiration(ctx.request.query.username, ctx.request.query.password);
      } catch (e) {
        console.error(e);
        ctx.body = {}
      }
    })
  // .put("/adduser", async (ctx, next) => {
  //   try {
  //     const user = ctx.request.body;
  //     ctx.body = await addUser(user.username, user.password);
  //   } catch (e) {
  //     ctx.body = {}
  //   }
  // });
  app.use(router.routes());
  const server = app.listen(parseInt(process.env.PORT), () => {
    console.log(`Server running on http://${process.env.HOST}:${process.env.PORT}`);
  });
  return server;
}
export { sequelize, start }



