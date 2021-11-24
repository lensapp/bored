import { IncomingMessage, ServerResponse } from "http";
import { Agent } from "../agent";
import { TunnelServer } from "../server";
import { parseAuthorization, verifyClientToken } from "../util";

export function handleClientPublicKey(req: IncomingMessage, res: ServerResponse, server: TunnelServer) {
  const url = new URL(req.url || "/", "http://localhost");
  let clusterId = url.searchParams.get("clusterId");

  if (!clusterId) {
    const authorization = parseAuthorization(req?.headers?.authorization);

    if (!authorization || !authorization.token) {
      res.writeHead(403);
      res.end();

      return;
    }

    try {
      const tokenData = verifyClientToken(authorization?.token, server);
      
      clusterId = tokenData.clusterId;
    } catch(error) {
      res.writeHead(403);
      res.end();
    }
  }

  if (clusterId) {
    const agents = server.getAgentsForClusterId(clusterId);

    respondWithAgentPublicKey(res, agents, clusterId);
  } else {
    res.writeHead(404);
    res.end();
  }

  return;
}

function respondWithAgentPublicKey(res: ServerResponse, agents: Agent[], clusterId: String) {
  if (agents.length === 0) {
    console.log(`SERVER: respondWithAgentPublicKey - Agents Length is 0. Cluster id: ${clusterId}`);
    res.writeHead(404);
    res.end();

    return;
  }

  res.writeHead(200);
  res.write(agents[0].publicKey);
  res.end();
}
