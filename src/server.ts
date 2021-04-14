import WebSocket, { Server } from "ws";
import { IncomingMessage, ServerResponse, createServer, Server as HttpServer } from "http";
import { Agent } from "./agent";
import { Socket } from "net";
import { URL } from "url";
import { handleClientPublicKey } from "./request-handlers/client-public-key";
import { handleAgentSocket } from "./request-handlers/agent-socket";
import { handleClientSocket } from "./request-handlers/client-socket";

export type ClusterId = string;
export const defaultClusterId: ClusterId = "default";

export class TunnelServer {
  private server?: HttpServer;
  private ws?: Server;

  public agentToken = "";
  public idpPublicKey = "";
  public clusterAddress?: string;
  public agents: Map<ClusterId, Agent[]> = new Map();

  start(port = 8080, agentToken: string, idpPublicKey: string, clusterAddress = process.env.CLUSTER_ADDRESS || ""): Promise<void> {
    this.agentToken = agentToken;
    this.idpPublicKey = idpPublicKey;
    this.clusterAddress = clusterAddress;

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
    }
  }
}
