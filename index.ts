import { SignalingServer } from "./src/server";

const server = new SignalingServer();

process.once("SIGTERM", () => {
  server.stop();
  process.exit(0);
});

process.once("SIGINT", () => {
  server.stop();
  process.exit(0);
});

server.start(8080);
