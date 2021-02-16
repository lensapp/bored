import WebSocket, { Server } from "ws";
import { IncomingMessage } from "http";
import { LensClient } from "./lens-client";
import { LensAgent } from "./lens-agent";
import { URL } from "url";

export class SignalingServer {
  private ws?: Server;
  private clients: LensClient[] = [];
  private agents: LensAgent[] = [];

  start(port = 8080) {
    console.log("~~ Heliograph ~~");

    this.ws = new Server({
      port
    });

    this.ws.on("listening", () => {
      console.log(`listening on port ${port}`);
    });

    this.ws.on("connection", (socket: WebSocket, request: IncomingMessage) => {
      if (!request.url || !request.method) {
        socket.close();

        return;
      }

      const url = new URL(request.url, "http://localhost");

      if (url.pathname === "/client") {
        this.handleClientSocket(socket);
      } else if (url.pathname === "/agent") {
        this.handleAgentSocket(socket);
      } else {
        socket.close();
      }
    });
  }

  stop() {
    this.ws?.close();
  }

  private handleClientSocket(socket: WebSocket) {
    console.log("client connected", socket.extensions);
    this.clients.push(new LensClient(socket));

    socket.on("message", (data) => {
      this.agents.forEach((agent) => {
        agent.socket.send(data);
      });
    });

    socket.on("close", () => {
      const index = this.clients.findIndex((client) => client.socket === socket);

      if (index !== -1) {
        this.clients.splice(index, 1);
      }
    });
  }

  private handleAgentSocket(socket: WebSocket) {
    console.log("agent connected");
    this.agents.push(new LensAgent(socket));

    socket.on("message", (data) => {
      this.clients.forEach((client) => {
        client.socket.send(data);
      });
    });

    socket.on("close", () => {
      console.log("agent closed");
      const index = this.agents.findIndex((agent) => agent.socket === socket);

      if (index !== -1) {
        this.agents.splice(index, 1);
      }
    });
  }
}
