import { IncomingMessage } from "http";
import WebSocket from "ws";
import { defaultClusterId, TunnelServer } from "../server";
import { parseAuthorization, verifyClientToken } from "../util";

export function handleClientSocket(req: IncomingMessage, socket: WebSocket, server: TunnelServer) {
  if (!req.headers.authorization) {
    console.log("SERVER: client did not specify authorization header, closing connection.");
    socket.close(4401);

    return;
  }

  const authorization = parseAuthorization(req.headers.authorization);

  if (authorization?.type !== "bearer") {
    console.log("SERVER: invalid client token, closing connection.");

    socket.close(4403);

    return;
  }

  let clusterId: string;
  let userId: string;

  try {
    const tokenData = verifyClientToken(authorization.token, server);

    userId = tokenData.sub;
    clusterId = server.agentToken === "" ? tokenData.clusterId : defaultClusterId;
  } catch (error) {
    console.log("SERVER: client token is not signed by IdP, or token aud invalid, closing connection");
    socket.close(4403);

    return;
  }

  console.log("SERVER: client connected");
  const agents = server.getAgentsForClusterId(clusterId);
  const agent = agents[Math.floor(Math.random() * agents.length)];

  if (!agent) {
    console.log("SERVER: no agents online, closing client request");
    socket.close(4404);

    return;
  }
  agent.addClient(socket, userId);
}


export function handleClientPresenceSocket(req: IncomingMessage, socket: WebSocket, server: TunnelServer, firstMessageDelay = 0) {

  if (!req.headers.authorization) {
    console.log("SERVER: client did not specify authorization header, closing connection.");
    socket.close(4401);

    return;
  }

  const authorization = parseAuthorization(req.headers.authorization);

  if (authorization?.type !== "bearer") {
    console.log("SERVER: invalid client token, closing connection.");

    socket.close(4403);

    return;
  }

  let clusterId: string;

  try {
    const tokenData = verifyClientToken(authorization.token, server);

    clusterId = server.agentToken === "" ? tokenData.clusterId : defaultClusterId;
  } catch (error) {
    console.log("SERVER: client token is not signed by IdP, or token aud invalid, closing connection");
    socket.close(4403);

    return;
  }

  const presenceSockets = server.getPresenceSocketsForClusterId(clusterId);

  presenceSockets.push(socket);
  socket.on("close", () => {
    const index = presenceSockets.findIndex((presence) => presence === socket);

    if (index !== -1) {
      presenceSockets.splice(index, 1);
    }
  });

  console.log("SERVER: client listening to user presence socket");

  setTimeout(function() {
    server.sendPresenceData(socket, clusterId);
  }, firstMessageDelay);
}
