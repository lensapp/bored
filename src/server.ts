import WebSocket, { Server } from "ws";
import { IncomingMessage, ServerResponse, createServer, Server as HttpServer } from "http";
import { Agent } from "./agent";
import { Socket } from "net";
import { URL } from "url";
import * as jwt from "jsonwebtoken";
import { BoredMplex } from "bored-mplex";

export class TunnelServer {
  private agentToken = "";
  private idpPublicKey = "";
  private server?: HttpServer;
  private ws?: Server;
  public agents: Agent[] = [];

  start(port = 8080, agentToken: string, idpPublicKey: string): Promise<void> {
    this.agentToken = agentToken;
    this.idpPublicKey = idpPublicKey;

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

    if (url.pathname === "/client/public-key" && this.agents.length > 0) {
      res.writeHead(200);
      res.write(this.agents[0].publicKey);
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
      this.ws?.handleUpgrade(req, socket, head, (socket: WebSocket) => {
        this.handleClientSocket(req, socket);
      });
    }
  }

  parseAuthorization(authHeader: string) {
    const authorization = authHeader.split(" ");

    if (authorization.length !== 2) {
      return null;
    }

    return {
      type: authorization[0].toLowerCase(),
      token: authorization[1]
    };
  }

  handleAgentSocket(req: IncomingMessage, socket: WebSocket) {
    if (!req.headers.authorization) {
      console.log("SERVER: agent did not specify authorization header, closing connection.");
      socket.close(4401);

      return;
    }

    const authorization = this.parseAuthorization(req.headers.authorization);

    if (authorization?.type !== "bearer" || authorization.token !== this.agentToken) {
      console.log("SERVER: invalid agent token, closing connection.");

      socket.close(4403);

      return;
    }

    console.log("SERVER: agent connected");
    const publicKey = Buffer.from(req.headers["x-bored-publickey"]?.toString() || "", "base64").toString("utf-8");
    const agent = new Agent(socket, publicKey);

    this.agents.push(agent);

    socket.on("close", () => {
      console.log("SERVER: agent disconnected");
      const index = this.agents.findIndex((agent) => agent.socket === socket);

      if (index !== -1) {
        this.agents.splice(index, 1);
      }
    });
  }

  handleClientSocket(req: IncomingMessage, socket: WebSocket) {
    if (!req.headers.authorization) {
      console.log("SERVER: client did not specify authorization header, closing connection.");
      socket.close(4401);

      return;
    }

    const authorization = this.parseAuthorization(req.headers.authorization);

    if (authorization?.type !== "bearer") {
      console.log("SERVER: invalid client token, closing connection.");

      socket.close(4403);

      return;
    }

    try {
      jwt.verify(authorization.token, this.idpPublicKey, {
        algorithms: ["RS256", "RS384", "RS512"]
      });
    } catch (error) {
      console.log("SERVER: client token is not signed by IdP, closing connection");
      socket.close(4403);

      return;
    }


    console.log("SERVER: client connected");
    const agent = this.agents[Math.floor(Math.random() * this.agents.length)];

    if (!agent) {
      console.log("SERVER: no agents online, closing client request");
      socket.close(4404);

      return;
    }
    agent.addClient(socket);

    const mplex = new BoredMplex((stream) => {
      const agentStream = agent.openStream();

      stream.pipe(agentStream);
      agentStream.pipe(stream);

      stream.on("finish", () => agentStream.end());
      agentStream.on("finish", () => stream.end());
    });

    const duplex = WebSocket.createWebSocketStream(socket);

    duplex.pipe(mplex).pipe(duplex);
    duplex.on("unpipe", () => {
      socket.close(4410);
    });
  }
}
