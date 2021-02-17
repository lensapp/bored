import WebSocket from "ws";
import { LensAgent } from "./lens-agent";

export class LensClient {
  public readonly socket: WebSocket;
  public readonly agent: LensAgent;

  constructor(socket: WebSocket, agent: LensAgent) {
    this.socket = socket;
    this.agent = agent;
  }
}
