import { IncomingMessage } from "http";
import WebSocket from "ws";
import { defaultClusterId, TunnelServer } from "../server";
import { clientSocketAuthorization, verifyClientToken } from "../util";

function authenticateClient(req: IncomingMessage, socket: WebSocket, server: TunnelServer) {
  const authorization = clientSocketAuthorization(req);

  if (!authorization) {
    console.log("SERVER: client did not specify authorization, closing connection.");
    socket.close(4401);

    return;
  }

  if (authorization.type !== "bearer") {
    console.log("SERVER: invalid client token, closing connection.");
    socket.close(4403);

    return;
  }

  try {
    const tokenData = verifyClientToken(authorization.token, server);

    return {
      userId: tokenData.sub,
      clusterId: server.agentToken === "" ? tokenData.clusterId : defaultClusterId
    };
  } catch (error) {
    console.log("SERVER: client token is not signed by IdP, or token aud invalid, closing connection");
    socket.close(4403);

    return;
  }
}

export function handleClientSocket(req: IncomingMessage, socket: WebSocket, server: TunnelServer) {
  const identity = authenticateClient(req, socket, server);

  if (!identity) return;

  const { clusterId, userId } = identity;

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

  const identity = authenticateClient(req, socket, server);

  if (!identity) return;

  const { clusterId } = identity;

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
