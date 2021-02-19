import WebSocket from "ws";
import { Client } from "yamux-js";

export class LensAgent {
  public socket: WebSocket;
  private client: Client;

  constructor(socket: WebSocket) {
    this.socket = socket;
    this.client = new Client({
      enableKeepAlive: true,
      keepAliveInterval: 30
    });
    const duplex = WebSocket.createWebSocketStream(socket);

    socket.on("close", () => {
      this.client.end();
    });

    socket.on("error", () => {
      this.client.close();
    });

    this.client.on("error", () => {
      this.socket.close();
    });

    this.client.pipe(duplex).pipe(this.client);
  }

  openStream() {
    return this.client.open();
  }
}
