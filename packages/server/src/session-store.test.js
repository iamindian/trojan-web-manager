import { createHash } from "crypto";
import { createSessionStore } from "./session-store.js";
import { Firestore } from "@google-cloud/firestore";

jest.mock("@google-cloud/firestore", () => ({ Firestore: jest.fn() }));

describe("Firestore sessions", () => {
  const originalEnv = { ...process.env };
  let records, collection, doc, write;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00Z"));
    jest.clearAllMocks();
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    process.env.FIRESTORE_COLLECTION_PREFIX = "test";
    records = new Map();
    write = jest.fn(async (id, value) => {
      records.set(id, { expiresAt: { toMillis: () => value.expiresAt.getTime() } });
    });
    doc = jest.fn((id) => ({
      set: (value) => write(id, value),
      get: async () => ({ exists: records.has(id), data: () => records.get(id) }),
    }));
    collection = jest.fn(() => ({ doc }));
    Firestore.mockImplementation(() => ({ collection }));
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...originalEnv };
  });

  it("shares persisted sessions across independent store instances without storing raw tokens", async () => {
    const first = createSessionStore();
    await first.set("secret-token");
    const second = createSessionStore();
    expect(await second.has("secret-token")).toBe(true);
    expect(collection).toHaveBeenCalledWith("test_sessions");
    expect(doc).toHaveBeenCalledWith(createHash("sha256").update("secret-token").digest("hex"));
    expect(JSON.stringify([...records])).not.toContain("secret-token");
    expect(Firestore).toHaveBeenCalledWith({
      projectId: "test-project",
    });
  });

  it("rejects unknown tokens and sessions at their original 120-second expiry even before TTL deletion", async () => {
    const store = createSessionStore();
    expect(await store.has("missing")).toBe(false);
    await store.set("token");
    jest.advanceTimersByTime(119999);
    expect(await store.has("token")).toBe(true);
    jest.advanceTimersByTime(1);
    expect(await store.has("token")).toBe(false);
    expect(records.size).toBe(1);
  });

  it("propagates read and write failures rather than using local sessions", async () => {
    const store = createSessionStore();
    write.mockRejectedValueOnce(new Error("write failed"));
    await expect(store.set("token")).rejects.toThrow("write failed");
    doc.mockReturnValueOnce({ get: async () => { throw new Error("read failed"); } });
    await expect(store.has("token")).rejects.toThrow("read failed");
  });

});
