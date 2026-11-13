import fs from "fs";
import os from "os";
import path from "path";
import supertest from "supertest";

jest.mock("./session-store.js", () => {
  const records = new Map();
  return {
    createSessionStore: jest.fn(() => ({
      has: jest.fn(async (token) => records.has(token)),
      set: jest.fn(async (token) => {
        records.set(token, true);
      }),
    })),
  };
});

jest.mock("./models/User.model.js", () => ({ init: jest.fn() }));
jest.mock("./service/userService.js", () => ({
  init: jest.fn(),
  getUsers: jest.fn().mockResolvedValue({ users: [], total: 0 }),
  getUserExpiration: jest.fn(),
  addUser: jest.fn(),
  extendExpiration: jest.fn(),
  extendExpirationById: jest.fn().mockResolvedValue({ id: 1, delta: 2 }),
}));

describe("combined Cloud Run service", () => {
  let server, request, sequelize, nodeCache, sessionStore, clientRoot;
  const originalEnv = { ...process.env };
  const originalArgv = [...process.argv];

  beforeAll(async () => {
    clientRoot = fs.mkdtempSync(path.join(os.tmpdir(), "twm-client-"));
    fs.writeFileSync(path.join(clientRoot, "index.html"), "<html>Trojan Web Manager</html>");
    fs.mkdirSync(path.join(clientRoot, "assets"));
    fs.writeFileSync(path.join(clientRoot, "assets", "app.js"), "console.log('client');");
    const envPath = path.join(clientRoot, "database.env");
    fs.writeFileSync(envPath, "DB_HOST=203.0.113.10\nDB_PORT=3307\n");
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_SOCKET_PATH;
    process.argv.push("--env", envPath);
    Object.assign(process.env, {
      HOST: "127.0.0.1",
      PORT: "0",
      DATABASE: "test",
      USERNAME: "test",
      PASSWORD: "test",
      ADMIN: "test-admin",
      ADMIN_PASSWORD: "test-password",
      API_PREFIX: "/api",
      CLIENT_DIST: clientRoot,
      TRUST_PROXY: "true",
    });
    const httpServer = require("./http-server.js");
    sequelize = httpServer.sequelize;
    nodeCache = httpServer.nodeCache;
    sessionStore = httpServer.sessionStore;
    server = await httpServer.start();
    request = supertest(server);
  });

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (sequelize) await sequelize.close();
    if (nodeCache) nodeCache.close();
    fs.rmSync(clientRoot, { recursive: true });
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  it("loads an external database IP and port from the selected .env file", () => {
    expect(sequelize.config.host).toBe("203.0.113.10");
    expect(sequelize.config.port).toBe(3307);
    expect(sequelize.options.dialectOptions).toEqual({});
  });

  it.each(["/", "/login", "/users", "/admin/42"])("serves the SPA at %s", async (url) => {
    const response = await request.get(url);
    expect(response.status).toBe(200);
    expect(response.type).toBe("text/html");
    expect(response.text).toContain("Trojan Web Manager");
  });

  it("serves built assets and HEAD requests", async () => {
    const response = await request.get("/assets/app.js");
    expect(response.status).toBe(200);
    expect(response.text).toContain("console.log('client')");
    await request.head("/").expect(200).expect("Content-Type", /text\/html/);
  });

  it.each(["/api", "/api/missing", "/assets/missing.js"])("does not return HTML for %s", async (url) => {
    const response = await request.get(url);
    expect(response.status).toBe(404);
    expect(response.text).not.toContain("Trojan Web Manager");
  });

  it("keeps the prefixed API protected", async () => {
    await request.get("/api/users").query({ offset: 0, limit: 5 }).expect(401);
    await request.put("/api/extendById").send({ id: 1, quantity: 1 }).expect(401);
  });

  it("issues secure same-origin cookies behind the HTTPS proxy and accepts them", async () => {
    const signin = await request.get("/api/signin")
      .set("X-Forwarded-Proto", "https")
      .query({ username: "test-admin", password: "test-password" })
      .expect(200);
    const cookie = signin.headers["set-cookie"][0];
    expect(cookie).toMatch(/httponly/i);
    expect(cookie).toMatch(/secure/i);
    expect(cookie).toMatch(/samesite=lax/i);
    await request.get("/api/users")
      .set("Cookie", cookie.split(";")[0])
      .query({ offset: 0, limit: 5 })
      .expect(200, { users: [], total: 0 });
    await request.put("/api/extendById")
      .set("Cookie", cookie.split(";")[0])
      .send({ id: 1, quantity: 1 })
      .expect(200, { id: 1, delta: 2 });
  });

  it("supports sign-in over local HTTP without secure cookies", async () => {
    const response = await request.get("/api/signin")
      .query({ username: "test-admin", password: "test-password" })
      .expect(200);
    expect(response.headers["set-cookie"][0]).not.toMatch(/;\s*secure/i);
  });

  it("renews a persisted session without putting the token in the response cache", async () => {
    const signin = await request.get("/api/signin")
      .query({ username: "test-admin", password: "test-password" })
      .expect(200);
    const cookie = signin.headers["set-cookie"][0].split(";")[0];
    expect(nodeCache.has(cookie.split("=")[1])).toBe(false);
    const renewed = await request.get("/api/signin").set("Cookie", cookie).expect(200);
    expect(renewed.headers["set-cookie"][0].split(";")[0]).not.toBe(cookie);
  });

  it("checks persisted authentication even when a response is cached", async () => {
    const signin = await request.get("/api/signin")
      .query({ username: "test-admin", password: "test-password" })
      .expect(200);
    const cookie = signin.headers["set-cookie"][0].split(";")[0];
    await request.get("/api/users")
      .set("Cookie", cookie).query({ offset: 0, limit: 5 }).expect(200);
    sessionStore.has.mockResolvedValueOnce(false);
    await request.get("/api/users")
      .set("Cookie", cookie).query({ offset: 0, limit: 5 }).expect(401);
  });

  it("awaits session persistence before issuing a cookie", async () => {
    sessionStore.set.mockRejectedValueOnce(new Error("Firestore unavailable"));
    const response = await request.get("/api/signin")
      .query({ username: "test-admin", password: "test-password" })
      .expect(500);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("does not authenticate when session storage is unavailable", async () => {
    sessionStore.has.mockRejectedValueOnce(new Error("Firestore unavailable"));
    await request.get("/api/users")
      .set("Cookie", "access_token=unavailable")
      .query({ offset: 0, limit: 5 })
      .expect(500);
  });
});
