import WebSocket from "ws";

export class Agent {
  public socket: WebSocket;
  public publicKey: string;

  constructor(socket: WebSocket, publicKey: string) {
    this.socket = socket;
    this.publicKey = publicKey;
  }

  openStream() {
    const stream = WebSocket.createWebSocketStream(this.socket);

    this.socket.on("close", () => {
      stream.unpipe();
    });

    return stream;
  }
}
