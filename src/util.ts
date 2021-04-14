
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
