import WebSocket, { Server } from "ws";
import { IncomingMessage, ServerResponse, createServer, Server as HttpServer } from "http";
import { Agent } from "./agent";
import { Socket } from "net";
import { URL } from "url";
import { handleClientPublicKey } from "./request-handlers/client-public-key";
import { handleAgentSocket } from "./request-handlers/agent-socket";
import { handleClientSocket, handleClientPresenceSocket } from "./request-handlers/client-socket";
import { EventEmitter } from "events";

export type ClusterId = string;
export const defaultClusterId: ClusterId = "default";
const eventEmitter = new EventEmitter();

export class TunnelServer {
  private server?: HttpServer;
  private ws?: Server;

  public agentToken = "";
  public idpPublicKey = "";
  public tunnelAddress?: string;
  public agents: Map<ClusterId, Agent[]> = new Map();
  emit = eventEmitter.emit;
  on = eventEmitter.on;
  off = eventEmitter.off;

  start(port = 8080, agentToken: string, idpPublicKey: string, tunnelAddress = process.env.TUNNEL_ADDRESS || ""): Promise<void> {
    this.agentToken = agentToken;
    this.idpPublicKey = idpPublicKey;
    this.tunnelAddress = tunnelAddress;

    this.ws = new Server({
      noServer: true
    });

    this.server = createServer(this.handleRequest.bind(this));
    this.server.on("upgrade", this.handleUpgrade.bind(this));

    const listenPromise = new Promise<void>((resolve) => {
      this.server?.on("listening", () => {
        console.log(`SERVER: listening on port ${port}`);
        resolve();
      });
    });

    this.server.listen(port);

    return listenPromise;
  }

  stop() {
    console.log("SERVER: shutting down");
    this.server?.close();
  }

  getAgentsForClusterId(clusterId: string): Agent[] {
    const agents = this.agents.get(clusterId) || [];

    if (!this.agents.has(clusterId)) this.agents.set(clusterId, agents);

    return agents;
  }

  handleRequest(req: IncomingMessage, res: ServerResponse) {
    if (!req.url) return;

    const url = new URL(req.url, "http://localhost");

    res.on("finish", () => {
      console.log(`SERVER: "${req.method} ${req.url}" ${res.statusCode}`);
    });

    if (url.pathname === "/") {
      res.writeHead(200);
      res.end("BoreD");

      return;
    }

    if (url.pathname === "/healthz") {
      res.writeHead(200);
      res.end("ok");

      return;
    }

    if (url.pathname === "/.well-known/public_key") {
      res.writeHead(200);
      res.write(this.idpPublicKey);
      res.end();

      return;
    }

    if (url.pathname === "/client/public-key") {
      handleClientPublicKey(req, res, this);

      return;
    }

    console.log(`SERVER: Unknown request URL path: ${url.pathname}`);
    res.writeHead(404);
    res.end();
  }

  handleUpgrade(req: IncomingMessage, socket: Socket, head: Buffer) {
    if (!req.url || !req.method) {
      socket.end();

      return;
    }

    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/agent/connect") {
      this.ws?.handleUpgrade(req, socket, head, (socket: WebSocket) => {
        handleAgentSocket(req, socket, this);
      });
    } else if (url.pathname === "/client/connect") {
      this.ws?.handleUpgrade(req, socket, head, (socket: WebSocket) => {
        handleClientSocket(req, socket, this);
      });
    } else if (url.pathname === "/client/presence") {
      this.ws?.handleUpgrade(req, socket, head, (socket: WebSocket) => {
        handleClientPresenceSocket(req, socket, this, parseInt(process.env.WS_FIRST_MESSAGE_DELAY || ""));
      });
    }
  }
}
