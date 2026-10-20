const { EventEmitter } = require("node:events");
const http = require("node:http");
const mongoose = require("mongoose");

const modules = ["../app", "../config/env", "../config/db", "../server"].map(path => require.resolve(path));
let originalModules, originalExitCode, connectDB, server, startServer;

beforeEach(() => {
  originalModules = modules.map(path => require.cache[path]);
  originalExitCode = process.exitCode;
  connectDB = vi.fn().mockResolvedValue({});
  server = new EventEmitter();
  server.listening = false;
  server.listen = vi.fn().mockReturnValue(server);
  server.close = vi.fn(callback => { server.listening = false; callback(); });
  require.cache[modules[0]] = { exports: () => {} };
  require.cache[modules[1]] = { exports: { port: 5000, nodeEnv: "test" } };
  require.cache[modules[2]] = { exports: connectDB };
  delete require.cache[modules[3]];
  vi.spyOn(http, "createServer").mockReturnValue(server);
  vi.spyOn(mongoose, "disconnect").mockResolvedValue();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  ({ startServer } = require("../server"));
});

afterEach(() => {
  modules.forEach((path, index) => {
    if (originalModules[index]) require.cache[path] = originalModules[index];
    else delete require.cache[path];
  });
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

test("does not listen until MongoDB connects and logs success only after listening", async () => {
  let completeConnection;
  connectDB.mockImplementation(() => new Promise(resolve => { completeConnection = resolve; }));
  const startup = startServer();
  expect(http.createServer).not.toHaveBeenCalled();
  completeConnection({});
  await startup;
  expect(server.listenerCount("error")).toBe(1);
  expect(server.listen).toHaveBeenCalledOnce();
  expect(console.log).not.toHaveBeenCalled();
  server.listen.mock.calls[0][1]();
  expect(console.log).toHaveBeenCalledWith(expect.stringContaining("running in test mode on port 5000"));
});

test.each([
  ["EADDRINUSE", "already in use"],
  ["EACCES", "Permission denied"],
  ["EOTHER", "Unable to start the HTTP server"],
])("handles asynchronous %s without exposing error details", async (code, message) => {
  await startServer();
  server.emit("error", Object.assign(new Error("sensitive connection details"), { code }));
  await vi.waitFor(() => expect(mongoose.disconnect).toHaveBeenCalledOnce());
  expect(process.exitCode).toBe(1);
  expect(console.error).toHaveBeenCalledWith("Failed to start CampusVoice API:", expect.stringContaining(message));
  expect(JSON.stringify(console.error.mock.calls)).not.toContain("sensitive");
  expect(console.log).not.toHaveBeenCalled();
});

test("repeated errors perform failure logging and cleanup only once", async () => {
  await startServer();
  server.emit("error", new Error("first"));
  server.emit("error", new Error("second"));
  await vi.waitFor(() => expect(mongoose.disconnect).toHaveBeenCalledOnce());
  expect(console.error).toHaveBeenCalledOnce();
});

test("connection failure exits nonzero without creating an HTTP server", async () => {
  connectDB.mockRejectedValue(new Error("sensitive database URI"));
  await startServer();
  expect(http.createServer).not.toHaveBeenCalled();
  expect(mongoose.disconnect).toHaveBeenCalledOnce();
  expect(process.exitCode).toBe(1);
  expect(console.error).toHaveBeenCalledWith("Failed to start CampusVoice API:", expect.stringContaining("Unable to connect to MongoDB"));
});

test("synchronous listen exceptions use the same cleanup path", async () => {
  server.listen.mockImplementation(() => { throw Object.assign(new Error("listen failed"), { code: "EACCES" }); });
  await startServer();
  expect(mongoose.disconnect).toHaveBeenCalledOnce();
  expect(process.exitCode).toBe(1);
});

test("HTTP close failure still disconnects MongoDB without an unhandled rejection", async () => {
  await startServer();
  server.listening = true;
  server.close.mockImplementation(() => { throw new Error("close failed"); });
  server.emit("error", new Error("server failed"));
  await vi.waitFor(() => expect(mongoose.disconnect).toHaveBeenCalledOnce());
  expect(process.exitCode).toBe(1);
});
