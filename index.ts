import { TunnelServer } from "./src/server";
import { version } from "./package.json";
import { captureException, initExceptionHandler } from "./src/error-reporter";

process.title = "bored";
console.log(`~~ BoreD v${version} ~~`);


const tunnelAddress = process.env.TUNNEL_ADDRESS || "";

initExceptionHandler(tunnelAddress);

const serverPort = parseInt(process.env.PORT || "8080");
const agentToken = process.env.AGENT_TOKEN || "";
const idpPublicKey = process.env.IDP_PUBLIC_KEY;

if (!idpPublicKey) {
  console.error("missing IDP_PUBLIC_KEY env, cannot continue");
  process.exit(1);
}

process.on("uncaughtException", (err) => {
  captureException(err);
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

const server = new TunnelServer();

process.once("SIGTERM", () => {
  server.stop();
  process.exit(0);
});

process.once("SIGINT", () => {
  server.stop();
  process.exit(0);
});

server.start(serverPort, agentToken, idpPublicKey, tunnelAddress);
