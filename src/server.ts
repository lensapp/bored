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

export class TunnelServer extends EventEmitter {
  private server?: HttpServer;
  private ws?: Server;

  public agentToken = "";
  public idpPublicKey = "";
  public tunnelAddress?: string;
  public agents: Map<ClusterId, Agent[]> = new Map();
  public presenceSockets: Map<ClusterId, WebSocket[]> = new Map();
  public keepAlive = 10_000;

  constructor() {
    super();

    this.on("ClientConnected", (clusterId: string) => {
      this.getPresenceSocketsForClusterId(clusterId).forEach((socket) => {
        this.sendPresenceData(socket, clusterId);
      });
    });

    this.on("ClientDisconnected", (clusterId: string) => {
      this.getPresenceSocketsForClusterId(clusterId).forEach((socket) => {
        this.sendPresenceData(socket, clusterId);
      });
    });
  }

  enableKeepAlive(keepAliveTimeMs: number) {
    this.keepAlive = keepAliveTimeMs;
  }

  disableKeepAlive() {
    this.keepAlive = 0;
  }

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

  getPresenceSocketsForClusterId(clusterId: string) {
    const sockets = this.presenceSockets.get(clusterId) || [];

    if (!this.presenceSockets.has(clusterId)) this.presenceSockets.set(clusterId, sockets);

    return sockets;
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

  sendPresenceData(socket: WebSocket, clusterId: string) {
    const agents = this.getAgentsForClusterId(clusterId);

    socket.send(
      JSON.stringify({
        "presence" : {
          "userIds": agents.flatMap(agent => agent.clients.map(client => client.userId))
        }
      })
    );
  }
}
