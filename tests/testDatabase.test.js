const ConnectionString = require("mongodb-connection-string-url").default;
const { createTestDatabase } = require("./helpers/testDatabase");
const developmentUri = "mongodb://localhost:27017/campusvoice";
const settings = uri => ({ TEST_MONGODB_URI: uri, MONGODB_URI: developmentUri });

test.each([
  undefined, "", "not-a-uri", "https://localhost/campusvoice_test",
  "mongodb://localhost:27017/", "mongodb://localhost:27017/campusvoice",
  "mongodb://localhost:27017/admin", "mongodb://localhost:27017/local",
  "mongodb://localhost:27017/config", "mongodb://localhost:27017/campusvoice_test?unknownOption=true",
  "mongodb://localhost:27017/campusvoice_test/other",
])("refuses missing, malformed or non-test database configuration %#", uri => {
  expect(() => createTestDatabase("auth", settings(uri))).toThrow();
});

test("never falls back to the development URI when TEST_MONGODB_URI is missing", () => {
  expect(() => createTestDatabase("auth", { MONGODB_URI: developmentUri })).toThrow(/TEST_MONGODB_URI is required/);
});

test("rejects even a test-prefixed name when it is the configured development database", () => {
  const uri = "mongodb://localhost:27017/campusvoice_test_development";
  expect(() => createTestDatabase("auth", { TEST_MONGODB_URI: uri, MONGODB_URI: uri })).toThrow(/development database/);
});

test("decodes database names before enforcing the development exclusion", () => {
  const uri = "mongodb://localhost:27017/campusvoice_test";
  expect(() => createTestDatabase("auth", { TEST_MONGODB_URI: uri, MONGODB_URI: "mongodb://localhost:27017/%63ampusvoice_test" })).toThrow(/development database/);
});

test.each([
  "mongodb://testuser:fixture%21@db1.example:27017,db2.example:27018/campusvoice_test?replicaSet=test-rs&authSource=admin&tls=true",
  "mongodb+srv://testuser:fixture%21@cluster.example/campusvoice_test_ci?authSource=admin&retryWrites=true",
])("preserves credentials, hosts and options while creating a unique database %#", uri => {
  const original = new ConnectionString(uri);
  const first = createTestDatabase("auth", settings(uri));
  const second = createTestDatabase("auth", settings(uri));
  const isolated = new ConnectionString(first.uri);
  expect(first.databaseName).not.toBe(second.databaseName);
  expect(isolated.pathname).toBe(`/${first.databaseName}`);
  expect(first.databaseName).toMatch(/^campusvoice_test(?:_ci)?_auth_[a-f0-9]{32}$/);
  expect(isolated.username).toBe(original.username);
  expect(isolated.password).toBe(original.password);
  expect(isolated.hosts).toEqual(original.hosts);
  expect([...isolated.searchParams]).toEqual([...original.searchParams]);
});

test("preserves the original implicit authentication source for non-SRV credentials", () => {
  const database = createTestDatabase("auth", settings("mongodb://testuser:fixture@localhost:27017/campusvoice_test"));
  expect(new ConnectionString(database.uri).searchParams.get("authSource")).toBe("campusvoice_test");
});

test("seeder subprocess overrides cannot redirect it to development", () => {
  const database = createTestDatabase("auth", settings("mongodb://localhost:27017/campusvoice_test"));
  const childEnv = database.subprocessEnv({ NODE_ENV: "development", MONGODB_URI: developmentUri, TEST_MONGODB_URI: developmentUri, PRINCIPAL_PASSWORD: "Test_Only_123!" });
  expect(childEnv.NODE_ENV).toBe("test");
  expect(childEnv.MONGODB_URI).toBe(database.uri);
  expect(childEnv.TEST_MONGODB_URI).toBe(database.uri);
  expect(childEnv.PRINCIPAL_PASSWORD).toBe("Test_Only_123!");
});

test("cleanup refuses development, base test databases, disconnected and mismatched connections", async () => {
  const database = createTestDatabase("auth", settings("mongodb://localhost:27017/campusvoice_test"));
  for (const name of ["campusvoice", "campusvoice_test", "campusvoice_test_auth_another_run"]) {
    const connection = { readyState: 1, name, db: { databaseName: name }, dropDatabase: vi.fn() };
    await expect(database.drop(connection)).rejects.toThrow(/Refusing/);
    expect(connection.dropDatabase).not.toHaveBeenCalled();
  }
  expect(() => database.assertConnection({ readyState: 0, name: database.databaseName, db: { databaseName: database.databaseName } })).toThrow(/Refusing/);
  expect(() => database.assertConnection({ readyState: 1, name: database.databaseName, db: { databaseName: "campusvoice" } })).toThrow(/Refusing/);
});

test("cleanup drops only the connected database generated for this run", async () => {
  const database = createTestDatabase("browser", settings("mongodb://localhost:27017/campusvoice_test"));
  const connection = { readyState: 1, name: database.databaseName, db: { databaseName: database.databaseName }, dropDatabase: vi.fn().mockResolvedValue({}) };
  await database.drop(connection);
  expect(connection.dropDatabase).toHaveBeenCalledOnce();
});
