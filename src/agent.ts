import WebSocket from "ws";
import { Client } from "yamux-js";

export class Agent {
  public socket: WebSocket;
  public publicKey: string;
  private yamux: Client;
  private clients: WebSocket[] = [];

  constructor(socket: WebSocket, publicKey: string) {
    this.socket = socket;
    this.publicKey = publicKey;

    const stream = WebSocket.createWebSocketStream(this.socket);

    this.yamux = new Client({ enableKeepAlive: false });
    this.yamux.pipe(stream).pipe(this.yamux);

    this.socket.on("close", () => {
      this.clients.forEach((client) => this.removeClient(client));
    });
  }

  addClient(socket: WebSocket) {
    this.clients.push(socket);
  }

  removeClient(socket: WebSocket) {
    const index = this.clients.findIndex(client => client === socket);

    if (index === -1) {
      return;
    }

    const client = this.clients.splice(index, 1)[0];

    client.close(4410);
  }

  openStream() {
    return this.yamux.open();
  }
}
