import { TunnelServer } from "../server";
import got, { Headers } from "got";
import { Agent } from "../agent";

// jwt.io public key, new tokens can be created in https://jwt.io/
const idpPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnzyis1ZjfNB0bBgKFMSv
vkTtwlvBsaJq7S5wA+kzeVOVpVWwkWdVha4s38XM/pa/yr47av7+z3VTmvDRyAHc
aT92whREFpLv9cj5lTeJSibyr/Mrm/YtjCZVWgaOYIhwrXwKLqPr/11inWsAkfIy
tvHWTxZYEcXLgAXFuUuaS3uF9gEiNQwzGTU1v0FqkqTBr4B8nW3HCN47XUu0t8Y0
e+lf4s4OxQawWD79J9/5d3Ry0vbV3Am1FtGJiJvOwRsIfVChDpYStTcHTCMqtvWb
V6L11BWkpzGXSW4Hv43qa+GSYOD2QU68Mb59oSk2OB+BtOLpJofmbGEGgvmwyCI9
MwIDAQAB
-----END PUBLIC KEY-----`;

describe("TunnelServer", () => {
  let server: TunnelServer;
  const port = 51516;
  const clusterId = "a026e50d-f9b4-4aa8-ba02-c9722f7f0663";
  const tunnelAddress = `http://localhost/bored/${clusterId}`;

  /**
   * {
   *   "sub": "lens-user",
   *   "groups": [
   *     "dev"
   *   ],
   *   "iat": 1516239022,
   *   "clusterId": "a026e50d-f9b4-4aa8-ba02-c9722f7f0663",
   *   "aud": "http://localhost/bored/a026e50d-f9b4-4aa8-ba02-c9722f7f0663"
   * }
   */
  const jwtToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsZW5zLXVzZXIiLCJncm91cHMiOlsiZGV2Il0sImlhdCI6MTUxNjIzOTAyMiwiY2x1c3RlcklkIjoiYTAyNmU1MGQtZjliNC00YWE4LWJhMDItYzk3MjJmN2YwNjYzIiwiYXVkIjoiaHR0cDovL2xvY2FsaG9zdC9ib3JlZC9hMDI2ZTUwZC1mOWI0LTRhYTgtYmEwMi1jOTcyMmY3ZjA2NjMifQ.jkTbX_O8UWbYdCRiTv4NEgDkewEOB9QrLOHOm_Ox8BKt7DC4696bbdOwVn_VHist0g6889ms0m8Nr_RKW5BW90ItAsfDx_0cp34_WKPuMBeXYxkfAEabBbhjATfrW1IUTVtV9R_qQ71nbqlhY9UudByfETI8CanjbDP7QYZCxmVCf2HvRML3h6mS1tqHmqZvjRAHY-cFmO8qa6xLp2c1vFMxuCoSZGoGIqoNPaLKIVBbDdjxzOEjO__gQX6ksUZxsHOy13iBre8gbBVi85lhkSCZa9OtXDEAICqsrlpHZvxIYqYMgBNG0YY4sVvvDGJgDxxTyWn8lphKrZyWWtNvjw";

  beforeEach(async () => {
    server = new TunnelServer();
    server.disableKeepAlive();
    await server.start(port, "", idpPublicKey, tunnelAddress);
  });

  afterEach(() => {
    server?.stop();
  });

  const get = async (path: string, headers?: Headers) => got(`http://localhost:${port}${path}`, { throwHttpErrors: false, headers });

  describe("http endpoints", () => {
    it("responds 200 on /", async () => {
      const res = await get("/");

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe("BoreD");
    });

    it("responds 404 on invalid path", async () => {
      const res = await get("/does-not-exist");

      expect(res.statusCode).toBe(404);
    });

    it("responds 200 on /healthz", async () => {
      const res = await get("/healthz");

      expect(res.statusCode).toBe(200);
    });

    it("responds 200 on /.well-known/public_key without bearer token", async () => {
      const res = await get("/.well-known/public_key");

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(idpPublicKey);
    });

    describe("/client/public-key", () => {
      it("responds 200 with token if agent is connected", async () => {
        const ws = {
          once: jest.fn(),
          on: jest.fn()
        };
  
        const agents = server.getAgentsForClusterId("a026e50d-f9b4-4aa8-ba02-c9722f7f0663");
  
        agents.push(new Agent({ socket: ws as any, publicKey: "rsa-public-key", server, clusterId: "test-id", keepalive: 0 }));
  
        const res = await get("/client/public-key", { "Authorization": `Bearer ${jwtToken}`});
  
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe("rsa-public-key");
      });

      it("responds 200 with url param if agent is connected", async () => {
        const ws = {
          once: jest.fn(),
          on: jest.fn()
        };
        const clusterId = "a026e50d-f9b4-4aa8-ba02-c9722f7f0663";
  
        const agents = server.getAgentsForClusterId(clusterId);
  
        agents.push(new Agent({ socket: ws as any, publicKey: "rsa-public-key", server, clusterId: "test-id", keepalive: 0 }));
  
        const res = await get(`/client/public-key?clusterId=${clusterId}`);
  
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe("rsa-public-key");
      });
  
      it("responds 403 without token if agent is not connected", async () => {
        const res = await get("/client/public-key");
  
        expect(res.statusCode).toBe(403);
      });
  
      it("responds 404 with token if agent is not connected", async () => {
        const res = await get("/client/public-key", { "Authorization": `Bearer ${jwtToken}`});
  
        expect(res.statusCode).toBe(404);
      });
  
      it("responds 403 with invalid token", async () => {
        const res = await get("/client/public-key", { "Authorization": `Bearer this.is.invalid`});
  
        expect(res.statusCode).toBe(403);
      });
    });
  });
});
