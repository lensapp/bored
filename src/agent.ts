import WebSocket from "ws";
import { BoredMplex, BoredMplexClient } from "bored-mplex";
import { captureException } from "./error-reporter";

interface Client {
  socket: WebSocket;
  userId: string;
}

export class Agent {
  public socket: WebSocket;
  public publicKey: string;
  public clients: Client[] = [];
  public users: string[] = [];
  private mplex: BoredMplexClient;

  constructor(socket: WebSocket, publicKey: string) {
    this.socket = socket;
    this.publicKey = publicKey;

    const stream = WebSocket.createWebSocketStream(this.socket);

    this.mplex = new BoredMplexClient();
    this.mplex.pipe(stream).pipe(this.mplex);

    this.socket.on("close", () => {
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
  }

  removeClient(socket: WebSocket) {
    const index = this.clients.findIndex(client => client.socket === socket);

    if (index === -1) {
      return;
    }

    const client = this.clients.splice(index, 1)[0];

    client.socket.close(4410);
  }

  openStream() {
    return this.mplex.openStream();
  }
}
