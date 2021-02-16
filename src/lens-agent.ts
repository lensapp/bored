import WebSocket from "ws";
import { LensClient } from "./lens-client";

export class LensAgent {
  public socket: WebSocket;
  public clients: LensClient[] = [];

  constructor(socket: WebSocket) {
    this.socket = socket;
  }
}
