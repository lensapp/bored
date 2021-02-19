import WebSocket from "ws";
import { Client } from "yamux-js";

export class LensAgent {
  public socket: WebSocket;
  private client: Client;

  constructor(socket: WebSocket) {
    this.socket = socket;
    this.client = new Client();
    const duplex = WebSocket.createWebSocketStream(socket);

    this.client.pipe(duplex).pipe(this.client);
  }

  openStream() {
    return this.client.open();
  }
}
