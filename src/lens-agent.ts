import WebSocket from "ws";
export class LensAgent {
  public socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
  }

  openStream() {
    return WebSocket.createWebSocketStream(this.socket);
  }
}
