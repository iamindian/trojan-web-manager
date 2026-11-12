import { Op, QueryTypes } from "sequelize";
import { init, getUsers, getUserExpiration } from "./userService.js";

describe("username search", () => {
  it.each([
    ["alice", "%alice%"],
    ["alice*smith", "%alice%smith%"],
    ["a%_\\b", "%a\\%\\_\\\\b%"],
  ])("filters and counts matching users for %s", async (username, pattern) => {
    const User = {
      findAll: jest.fn().mockResolvedValue([{ id: 1 }]),
      count: jest.fn().mockResolvedValue(26),
    };
    await init({ models: { User } });
    await expect(getUsers(25, 25, { id: 1 }, username))
      .resolves.toEqual({ users: [{ id: 1 }], total: 26 });
    const where = { id: 1, username: { [Op.like]: pattern } };
    expect(User.findAll).toHaveBeenCalledWith({ offset: 25, limit: 25, where });
    expect(User.count).toHaveBeenCalledWith({ where });
  });

  it("restores unfiltered listing with an empty search", async () => {
    const User = { findAll: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };
    await init({ models: { User } });
    await getUsers(0, 25, {}, "");
    expect(User.findAll).toHaveBeenCalledWith({ offset: 0, limit: 25, where: {} });
    expect(User.count).toHaveBeenCalledWith({ where: {} });
  });
});

describe("username-only expiration lookup", () => {
  it("binds the username as data rather than interpolating it into SQL", async () => {
    const rows = [{ expiration: 30 }];
    const query = jest.fn().mockResolvedValue(rows);
    await init({ query });
    const username = "alice' OR 1=1 --";
    await expect(getUserExpiration(username)).resolves.toEqual(rows);
    const [sql, options] = query.mock.calls[0];
    expect(sql).toContain("where username = :username");
    expect(sql).not.toContain(username);
    expect(sql).not.toContain("password");
    expect(options).toEqual({
      replacements: { username },
      type: QueryTypes.SELECT,
      raw: true,
    });
  });

  it("preserves an empty result for a username that does not exist", async () => {
    await init({ query: jest.fn().mockResolvedValue([]) });
    await expect(getUserExpiration("missing")).resolves.toEqual([]);
  });
});
