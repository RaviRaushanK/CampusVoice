const { randomUUID } = require("node:crypto");
const ConnectionString = require("mongodb-connection-string-url").default;
const { MongoClient } = require("mongoose").mongo;

const parseUri = (uri, variable) => {
  if (typeof uri !== "string" || !uri.trim()) throw new Error(`${variable} is required; development database fallback is disabled.`);
  try {
    const parsed = new ConnectionString(uri);
    // Validate driver options as well as URL syntax, without opening a connection.
    new MongoClient(uri);
    return parsed;
  } catch {
    throw new Error(`${variable} is not a valid MongoDB URI. Connection details are omitted.`);
  }
};

const createTestDatabase = (suite, settings = process.env) => {
  if (!/^[a-z]+$/.test(suite)) throw new Error("Invalid test suite database suffix.");
  const parsed = parseUri(settings.TEST_MONGODB_URI, "TEST_MONGODB_URI");
  let baseName, developmentName;
  try {
    baseName = decodeURIComponent(parsed.pathname.slice(1));
    developmentName = settings.MONGODB_URI
      ? decodeURIComponent(parseUri(settings.MONGODB_URI, "MONGODB_URI").pathname.slice(1))
      : "campusvoice";
  } catch {
    throw new Error("Cannot validate database names; refusing database-backed tests.");
  }
  if (!/^campusvoice_test(?:_[a-z0-9]+)*$/.test(baseName) || baseName === developmentName) {
    throw new Error("TEST_MONGODB_URI must name campusvoice_test or campusvoice_test_* and must not name the development database.");
  }
  const databaseName = `${baseName}_${suite}_${randomUUID().replaceAll("-", "")}`;
  if (Buffer.byteLength(databaseName) > 63) throw new Error("Test database base name is too long for a unique isolated database.");
  // Keep credentials and topology options intact when replacing the database path.
  // Non-SRV credentials without authSource authenticate against the original path.
  const options = parsed.typedSearchParams();
  if (parsed.username && !parsed.isSRV && !options.has("authSource")) options.set("authSource", baseName);
  parsed.pathname = `/${databaseName}`;
  const uri = parsed.toString();

  const assertConnection = connection => {
    if (connection.readyState !== 1 || connection.name !== databaseName || connection.db?.databaseName !== databaseName) {
      throw new Error("Refusing test database writes or cleanup: active connection is not this run's isolated database.");
    }
  };
  const drop = async connection => {
    assertConnection(connection);
    await connection.dropDatabase();
  };
  const subprocessEnv = (overrides = {}) => ({
    ...process.env, ...overrides, NODE_ENV: "test", MONGODB_URI: uri, TEST_MONGODB_URI: uri,
  });
  return { uri, databaseName, assertConnection, drop, subprocessEnv };
};

module.exports = { createTestDatabase };
