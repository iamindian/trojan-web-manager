import { createHash } from "crypto";
import { createSessionStore } from "./session-store.js";
import { Firestore } from "@google-cloud/firestore";

jest.mock("@google-cloud/firestore", () => ({ Firestore: jest.fn() }));

describe("Firestore sessions", () => {
  const originalEnv = { ...process.env };
  let records, collection, doc, write, transaction;

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
      id,
      set: (value) => write(id, value),
      delete: async () => records.delete(id),
      get: async () => ({ exists: records.has(id), data: () => records.get(id) }),
    }));
    collection = jest.fn(() => ({ doc }));
    transaction = {
      get: (ref) => ref.get(),
      update: (ref, value) => write(ref.id, value),
    };
    Firestore.mockImplementation(() => ({
      collection,
      runTransaction: async (callback) => {
        const result = await callback(transaction);
        await Promise.resolve();
        return result;
      },
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...originalEnv };
  });

  it("shares persisted sessions across independent store instances without storing raw tokens", async () => {
    const first = createSessionStore();
    await first.set("secret-token");
    const second = createSessionStore();
    expect(await second.touch("secret-token")).toBe(true);
    expect(collection).toHaveBeenCalledWith("test_sessions");
    expect(doc).toHaveBeenCalledWith(createHash("sha256").update("secret-token").digest("hex"));
    expect(JSON.stringify([...records])).not.toContain("secret-token");
    expect(Firestore).toHaveBeenCalledWith({
      projectId: "test-project",
    });
  });

  it("extends activity by 24 hours and rejects expired sessions even before TTL deletion", async () => {
    const store = createSessionStore();
    expect(await store.touch("missing")).toBe(false);
    await store.set("token");
    jest.advanceTimersByTime(23 * 60 * 60 * 1000);
    expect(await store.touch("token")).toBe(true);
    jest.advanceTimersByTime(23 * 60 * 60 * 1000);
    expect(await store.touch("token")).toBe(true);
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(await store.touch("token")).toBe(false);
    expect(records.size).toBe(1);
  });

  it("deletes only the requested session and does not recreate it on activity", async () => {
    const store = createSessionStore();
    await store.set("token");
    await store.set("other");
    await store.delete("token");
    expect(await store.touch("token")).toBe(false);
    expect(await store.touch("other")).toBe(true);
  });

  it("propagates read and write failures rather than using local sessions", async () => {
    const store = createSessionStore();
    write.mockRejectedValueOnce(new Error("write failed"));
    await expect(store.set("token")).rejects.toThrow("write failed");
    transaction.get = async () => { throw new Error("read failed"); };
    await expect(store.touch("token")).rejects.toThrow("read failed");
    doc.mockReturnValueOnce({ delete: async () => { throw new Error("delete failed"); } });
    await expect(store.delete("token")).rejects.toThrow("delete failed");
  });

});
