import WebSocket, { Server } from "ws";
import { IncomingMessage, ServerResponse, createServer, Server as HttpServer } from "http";
import { LensAgent } from "./lens-agent";
import { Socket } from "net";
import { URL } from "url";
import { version } from "../package.json";

export class TunnelServer {
  private server?: HttpServer;
  private ws?: Server;
  private agents: LensAgent[] = [];

  start(port = 8080) {
    console.log(`~~ Heliograph v${version} ~~`);

    this.ws = new Server({
      noServer: true
    });

    this.server = createServer(this.handleRequest.bind(this));
    this.server.on("upgrade", this.handleUpgrade.bind(this));
    this.server.on("listening", () => {
      console.log(`listening on port ${port}`);
    });

    this.server.listen(port);
  }

  stop() {
    console.log("shutting down");
    this.server?.close();
  }

  handleRequest(req: IncomingMessage, res: ServerResponse) {
    console.log(`${req.method}: ${req.headers.host}${req.url}`);

    const agent = this.agents[0];

    if (!agent) {
      res.writeHead(503);
      res.end();

      return;
    }

    if (!res.socket) {
      return;
    }

    req.socket.pipe(agent.openStream()).pipe(res.socket);
  }

  handleUpgrade(req: IncomingMessage, socket: Socket, head: Buffer) {
    if (!req.url || !req.method) {
      socket.end();

      return;
    }

    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/lens-agent/connect") {
      this.ws?.handleUpgrade(req, socket, head, this.handleAgentSocket);
    }
  }

  handleAgentSocket(socket: WebSocket) {
    console.log("agent connected");
    const agent = new LensAgent(socket);

    this.agents.push(agent);

    socket.on("close", () => {
      console.log("agent disconnected");
      const index = this.agents.findIndex((agent) => agent.socket === socket);

      if (index !== -1) {
        this.agents.splice(index, 1);
      }
    });
  }

  public getAgent() {
    return this.agents.shift() || null;
  }
}
