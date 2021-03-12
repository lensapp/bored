import WebSocket from "ws";
import { Client } from "yamux-js";

export class Agent {
  public socket: WebSocket;
  public publicKey: string;
  private client: Client;

  constructor(socket: WebSocket, publicKey: string) {
    this.socket = socket;
    this.publicKey = publicKey;

    const stream = WebSocket.createWebSocketStream(this.socket);

    this.client = new Client({ enableKeepAlive: false });
    this.client.pipe(stream).pipe(this.client);
  }

  openStream() {
    return this.client.open();
  }
}
