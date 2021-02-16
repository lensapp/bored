import WebSocket from "ws";

export class LensClient {
  public socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
  }
}
