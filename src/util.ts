import * as jwt from "jsonwebtoken";
import { TunnelServer } from "./server";

export type ClientTokenData = {
  sub: string;
  aud: string;
  clusterId: string;
};

export type AgentTokenData = {
  sub: string;
  aud: string;
};

export function parseAuthorization(authHeader: string) {
  const authorization = authHeader.split(" ");

  if (authorization.length !== 2) {
    return null;
  }

  return {
    type: authorization[0].toLowerCase(),
    token: authorization[1]
  };
}

export function verifyClientToken(token: string, server: TunnelServer) {
  return jwt.verify(token, server.idpPublicKey, {
    algorithms: ["RS256", "RS384", "RS512"],
    audience: server.clusterAddress
  }) as ClientTokenData;
}


export function verifyAgentToken(token: string, server: TunnelServer) {
  return jwt.verify(token, server.idpPublicKey, {
    algorithms: ["RS256", "RS384", "RS512"],
    audience: server.clusterAddress
  }) as AgentTokenData;
}
