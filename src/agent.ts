import WebSocket from "ws";
import { BoredMplex, BoredMplexClient } from "bored-mplex";
import { captureException } from "./error-reporter";
import { TunnelServer } from "./server";

export interface Client {
  socket: WebSocket;
  userId: string;
}

export interface AgentOpts {
  socket: WebSocket;
  publicKey: string;
  server: TunnelServer;
  clusterId: string,
  keepalive: number
}

export class Agent {
  public socket: WebSocket;
  public publicKey: string;
  public clusterId: string;
  public clients: Client[] = [];
  private mplex: BoredMplexClient;
  private server: TunnelServer;

  constructor(opts: AgentOpts) {
    const { socket, publicKey, server, clusterId, keepalive } = opts;

    this.socket = socket;
    this.publicKey = publicKey;
    this.server = server;
    this.clusterId = clusterId;

    const stream = WebSocket.createWebSocketStream(this.socket);

    this.mplex = new BoredMplexClient();

    if (keepalive) {
      this.mplex.enableKeepAlive(keepalive);
    }

    this.mplex.pipe(stream).pipe(this.mplex);

    this.socket.on("close", () => {
      this.mplex.disableKeepAlive();
      this.clients.forEach((client) => this.removeClient(client.socket));
    });

    stream.on("error", error => {
      console.error(error);
      this.clients.forEach((client) => this.removeClient(client.socket));
      captureException(error);
    });

    this.mplex.on("error", error => {
      console.error(error);
      this.clients.forEach((client) => this.removeClient(client.socket));
      captureException(error);
    });
  }

  addClient(socket: WebSocket, userId: string) {
    this.clients.push({ socket, userId });

    const mplex = new BoredMplex((stream) => {
      const agentStream = this.openStream();

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

    duplex.on("error", (error) => {
      console.error(error);
      socket.close(4410);
    });

    mplex.on("error", (error) => {
      console.error(error);
      socket.close(4410);
    });

    socket.on("close", () => {
      this.removeClient(socket);
    });

    this.server.emit("ClientConnected", this.clusterId);
  }

  removeClient(socket: WebSocket) {
    const index = this.clients.findIndex(client => client.socket === socket);

    if (index === -1) {
      return;
    }

    const client = this.clients.splice(index, 1)[0];

    client.socket.close(4410);

    this.server.emit("ClientDisconnected", this.clusterId);
    console.log("SERVER: client disconnected");
  }

  openStream() {
    return this.mplex.openStream();
  }
}
