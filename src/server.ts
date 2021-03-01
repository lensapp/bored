import WebSocket, { Server } from "ws";
import { IncomingMessage, ServerResponse, createServer, Server as HttpServer } from "http";
import { Agent } from "./agent";
import { Socket } from "net";
import { URL } from "url";

export class TunnelServer {
  private agentToken = "";
  private server?: HttpServer;
  private ws?: Server;
  private agents: Agent[] = [];

  start(port = 8080, agentToken: string) {
    this.agentToken = agentToken;

    this.ws = new Server({
      noServer: true
    });

    this.server = createServer(this.handleRequest.bind(this));
    this.server.on("upgrade", this.handleUpgrade.bind(this));
    this.server.on("listening", () => {
      console.log(`SERVER: listening on port ${port}`);
    });

    this.server.listen(port);
  }

  stop() {
    console.log("SERVER: shutting down");
    this.server?.close();
  }

  handleRequest(req: IncomingMessage, res: ServerResponse) {
    if (!req.url) return;

    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/healthz") {
      res.writeHead(200);
      res.end();

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
        this.handleAgentSocket(req, socket);
      });
    } else if (url.pathname === "/client/connect") {
      this.ws?.handleUpgrade(req, socket, head, this.handleClientSocket.bind(this));
    }
  }

  handleAgentSocket(req: IncomingMessage, socket: WebSocket) {
    if (!req.headers.authorization) {
      console.log("SERVER: agent did not specify authorization header, closing connection.");
      socket.close(4401);

      return;
    }

    const authorization = req.headers.authorization.split(" ");

    if (authorization[0].toLowerCase() !== "bearer" && authorization[1] !== this.agentToken) {
      console.log("SERVER: invalid agent token, closing connection.");

      socket.close(4403);

      return;
    }

    console.log("SERVER: agent connected");
    const agent = new Agent(socket, req.headers["X-BoreD-PublicKey"]?.toString() || "");

    this.agents.push(agent);

    socket.on("close", () => {
      console.log("SERVER: agent disconnected");
      const index = this.agents.findIndex((agent) => agent.socket === socket);

      if (index !== -1) {
        this.agents.splice(index, 1);
      }
    });
  }

  handleClientSocket(socket: WebSocket) {
    console.log("SERVER: client connected");
    const agent = this.agents[Math.floor(Math.random() * this.agents.length)];

    if (!agent) {
      console.log("SERVER: no agents online, closing client request");
      socket.close();

      return;
    }

    const stream = agent.openStream();
    const duplex = WebSocket.createWebSocketStream(socket);

    duplex.pipe(stream).pipe(duplex);
  }
}
