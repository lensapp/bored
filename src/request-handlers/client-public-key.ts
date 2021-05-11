import { IncomingMessage, ServerResponse } from "http";
import { Agent } from "../agent";
import { TunnelServer } from "../server";
import { parseAuthorization, verifyClientToken } from "../util";

export function handleClientPublicKey(req: IncomingMessage, res: ServerResponse, server: TunnelServer) {
  const authorization = parseAuthorization(req?.headers?.authorization);

  if (!authorization || !authorization.token) {
    res.writeHead(403);
    res.end();

    return;
  }

  try {
    const tokenData = verifyClientToken(authorization?.token, server);
    const agents = server.getAgentsForClusterId(tokenData.clusterId);

    respondWithAgentPublicKey(res, agents);
  } catch(error) {
    res.writeHead(403);
    res.end();
  }


  return;
}

function respondWithAgentPublicKey(res: ServerResponse, agents: Agent[]) {
  if (agents.length === 0) {
    res.writeHead(404);
    res.end();

    return;
  }

  res.writeHead(200);
  res.write(agents[0].publicKey);
  res.end();
}