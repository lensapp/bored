import { IncomingMessage } from "http";
import WebSocket from "ws";
import { Agent } from "../agent";
import { defaultClusterId, TunnelServer } from "../server";
import { parseAuthorization, verifyAgentToken } from "../util";

export function handleAgentSocket(req: IncomingMessage, socket: WebSocket, server: TunnelServer) {
  if (!req.headers.authorization) {
    console.log("SERVER: agent did not specify authorization header, closing connection.");
    socket.close(4401);

    return;
  }

  const authorization = parseAuthorization(req.headers.authorization);

  if (authorization?.type !== "bearer") {
    console.log("SERVER: invalid agent token, closing connection.");
    socket.close(4403);

    return;
  }

  let clusterId: string;

  if (server.agentToken) {
    if (authorization.token !== server.agentToken) {
      console.log("SERVER: invalid agent token, closing connection.");
      socket.close(4403);

      return;
    }

    clusterId = defaultClusterId;
  } else {
    try {
      const tokenData = verifyAgentToken(authorization.token, server);

      clusterId = tokenData.sub;
    } catch(error) {
      console.error(error);
      console.log("SERVER: invalid agent jwt token, closing connection.");
      socket.close(4403);

      return;
    }
  }

  const agents = server.getAgentsForClusterId(clusterId);

  console.log("SERVER: agent connected");
  const publicKey = Buffer.from(req.headers["x-bored-publickey"]?.toString() || "", "base64").toString("utf-8");
  const agent = new Agent(socket, publicKey);

  agents.push(agent);

  socket.on("close", () => {
    console.log("SERVER: agent disconnected");
    const index = agents.findIndex((agent) => agent.socket === socket);

    if (index !== -1) {
      agents.splice(index, 1);
    }
  });
}
