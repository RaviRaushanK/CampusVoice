const app = require("./app");
const env = require("./config/env");
const connectDB = require("./config/db");
const { createServer } = require("node:http");
const mongoose = require("mongoose");

const startServer = async () => {
  let server;
  let failed = false;
  let stage = "database";

  const handleFailure = async (error) => {
    if (failed) return;
    failed = true;
    process.exitCode = 1;
    const messages = {
      EADDRINUSE: `Port ${env.port} is already in use (EADDRINUSE). Choose another PORT or stop the existing server.`,
      EACCES: `Permission denied when listening on port ${env.port} (EACCES). Check PORT and operating system permissions.`,
    };
    console.error("Failed to start CampusVoice API:", messages[error?.code] || (stage === "database"
      ? "Unable to connect to MongoDB. Check the database configuration and availability."
      : "Unable to start the HTTP server. Check the server configuration."));
    try {
      if (server?.listening) await new Promise(resolve => server.close(resolve));
    } catch {
      console.error("Could not close the HTTP server after startup failure.");
    } finally {
      try { await mongoose.disconnect(); }
      catch { console.error("Could not close the MongoDB connection after startup failure."); }
    }
  };

  try {
    await connectDB();
    stage = "http";
    server = createServer(app);
    server.on("error", handleFailure);
    server.listen(env.port, () => {
      if (!failed) console.log(`CampusVoice API running in ${env.nodeEnv} mode on port ${env.port}`);
    });
    return server;
  } catch (error) {
    await handleFailure(error);
  }
};

if (require.main === module) startServer();

module.exports = { startServer };
