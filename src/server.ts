import WebSocket, { Server } from "ws";
import { IncomingMessage } from "http";
import { LensClient } from "./lens-client";
import { LensAgent } from "./lens-agent";
import { URL } from "url";
import { version } from "../package.json";

export class SignalingServer {
  private ws?: Server;
  private clients: LensClient[] = [];
  private agents: LensAgent[] = [];

  start(port = 8080) {
    console.log(`~~ Heliograph v${version} ~~`);

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
    console.log("shutting down");
    this.ws?.close();
  }

  public handleClientSocket(socket: WebSocket) {
    const agent = this.getAgentForClient();

    if (!agent) {
      socket.close();

      return;
    }

    console.log("client connected");
    const client = new LensClient(socket, agent);

    this.clients.push(client);
    socket.on("message", (data) => {
      client.agent.socket.send(data);
    });

    socket.on("close", () => {
      const index = this.clients.findIndex((client) => client.socket === socket);

      if (index !== -1) {
        this.clients.splice(index, 1);
      }
    });
  }

  public handleAgentSocket(socket: WebSocket) {
    console.log("agent connected");
    const agent = new LensAgent(socket);

    this.agents.push(agent);

    socket.on("message", (data) => {
      this.getClientsForAgent(agent).forEach((client) => {
        client.socket.send(data);
      });
    });

    socket.on("close", () => {
      console.log("agent closed");
      this.getClientsForAgent(agent).forEach((client) => client.socket.close());
      const index = this.agents.findIndex((agent) => agent.socket === socket);

      if (index !== -1) {
        this.agents.splice(index, 1);
      }
    });
  }

  public getClientsForAgent(agent: LensAgent) {
    return this.clients.filter((client) => client.agent === agent);
  }

  public getAgentForClient(): LensAgent {
    return this.agents[Math.floor(Math.random() * this.agents.length)];
  }
}
