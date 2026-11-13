import { createHash } from "crypto";
import { Firestore } from "@google-cloud/firestore";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

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
    async touch(token) {
      const ref = document(token);
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        // A transaction prevents concurrent logout from recreating a session.
        if (!snapshot.exists || snapshot.data().expiresAt.toMillis() <= Date.now()) return false;
        transaction.update(ref, { expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
        return true;
      });
    },
    async set(token) {
      await document(token).set({
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
    },
    async delete(token) {
      await document(token).delete();
    },
  };
}
