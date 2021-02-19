import { TunnelServer } from "./src/server";

const server = new TunnelServer();

process.once("SIGTERM", () => {
  server.stop();
  process.exit(0);
});

process.once("SIGINT", () => {
  server.stop();
  process.exit(0);
});

server.start(parseInt(process.env.PORT || "8080"));
