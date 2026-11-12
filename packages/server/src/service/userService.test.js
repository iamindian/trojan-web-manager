import { QueryTypes } from "sequelize";
import { init, getUserExpiration } from "./userService.js";

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
