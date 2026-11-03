// Read-only development-record audit. Never creates indexes or writes documents.
require("dotenv").config({ quiet: true });
const { MongoClient, BSON } = require("mongoose").mongo;
const { createHash } = require("node:crypto");
const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect(); const db = client.db();
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const result = {};
    for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      if (name.startsWith("system.")) continue;
      const hash = createHash("sha256"); let count = 0;
      for await (const document of db.collection(name).find().sort({ _id: 1 })) { hash.update(BSON.EJSON.stringify(document)); count++; }
      result[name] = { count, sha256: hash.digest("hex") };
    }
    console.log(JSON.stringify(result, null, 2));
  } finally { await client.close(); }
};
run().catch(() => { console.error("Database fingerprint failed; connection details omitted."); process.exitCode = 1; });
