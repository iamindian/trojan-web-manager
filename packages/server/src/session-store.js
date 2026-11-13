import { createHash } from "crypto";
import { Firestore } from "@google-cloud/firestore";

export function createSessionStore() {
  const db = new Firestore({
    ...(process.env.GOOGLE_CLOUD_PROJECT ? { projectId: process.env.GOOGLE_CLOUD_PROJECT } : {}),
  });
  const prefix = process.env.FIRESTORE_COLLECTION_PREFIX || "twm";
  if (prefix.includes("/")) {
    throw new Error("FIRESTORE_COLLECTION_PREFIX must not contain slashes");
  }
  const document = (token) => db.collection(`${prefix}_sessions`)
    .doc(createHash("sha256").update(token).digest("hex"));

  return {
    async has(token) {
      const snapshot = await document(token).get();
      if (!snapshot.exists) return false;
      // TTL deletion is asynchronous; enforce expiration on every read.
      return snapshot.data().expiresAt.toMillis() > Date.now();
    },
    async set(token) {
      await document(token).set({
        expiresAt: new Date(Date.now() + 120 * 1000),
      });
    },
  };
}
