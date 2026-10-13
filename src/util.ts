import * as jwt from "jsonwebtoken";
import { IncomingMessage } from "http";
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

export function parseAuthorization(authHeader?: string) {
  if (!authHeader) {
    return null;
  }

  const authorization = authHeader.split(" ");

  if (authorization.length !== 2) {
    return null;
  }

  return {
    type: authorization[0].toLowerCase(),
    token: authorization[1]
  };
}

export const clientAuthProtocolPrefix = "bored-auth.";

export function clientSocketAuthorization(req: IncomingMessage) {
  if (req.headers.authorization !== undefined) {
    return req.headers.authorization;
  }

  const protocols = req.headers["sec-websocket-protocol"]?.split(",").map(protocol => protocol.trim()) || [];
  const credentials = protocols.filter(protocol => protocol.startsWith(clientAuthProtocolPrefix));

  if (!protocols.includes("bored") || credentials.length !== 1) {
    return undefined;
  }

  return `Bearer ${credentials[0].slice(clientAuthProtocolPrefix.length)}`;
}

export function verifyClientToken(token: string, server: TunnelServer) {
  return jwt.verify(token, server.idpPublicKey, {
    algorithms: ["RS256", "RS384", "RS512"],
    audience: server.tunnelAddress
  }) as ClientTokenData;
}


export function verifyAgentToken(token: string, server: TunnelServer) {
  return jwt.verify(token, server.idpPublicKey, {
    algorithms: ["RS256", "RS384", "RS512"],
    audience: server.tunnelAddress
  }) as AgentTokenData;
}
