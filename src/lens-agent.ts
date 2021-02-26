import WebSocket from "ws";

export class LensAgent {
  public socket: WebSocket;
  public publicKey: string;

  constructor(socket: WebSocket, publicKey: string) {
    this.socket = socket;
    this.publicKey = publicKey;
  }

  openStream() {
    return WebSocket.createWebSocketStream(this.socket);
  }
}
