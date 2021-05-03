import { TunnelServer } from "../server";
import got, { Headers } from "got";
import { Agent } from "../agent";
import WebSocket from "ws";

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
  const port = 51515;
  const secret = "doubleouseven";
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

  /**
   * {
   *   "sub": "a026e50d-f9b4-4aa8-ba02-c9722f7f0663",
   *   "iat": 1516239022,
   *   "aud": "http://localhost/bored/a026e50d-f9b4-4aa8-ba02-c9722f7f0663"
   * }
   */
  const agentJwtToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMDI2ZTUwZC1mOWI0LTRhYTgtYmEwMi1jOTcyMmY3ZjA2NjMiLCJpYXQiOjE1MTYyMzkwMjIsImF1ZCI6Imh0dHA6Ly9sb2NhbGhvc3QvYm9yZWQvYTAyNmU1MGQtZjliNC00YWE4LWJhMDItYzk3MjJmN2YwNjYzIn0.ih-cyGWn83lwyQRVF4ccZ2fDt8AL78jF533RmAACt-YMR0GtcVuobZZCEoe6pGKI4uujwD8SXMaxPlTA6-bcJcVdgvmo3w4E48Lbz_PLe8A9_o1Q3RP-ak_a7Pq9igB5Whu2pK8E5IeAqjYkE34Uv7HkT9f3UvJRL1ERSZVdVMciW_1BeUfm713gdbGY89leAnff19slPdDAmMghHO1ZoRGzsFM4MvxbxjgPZiZxsOeKqTv3jWLCZ2XEFT1-s7c1K5bS9T3mctd6lgN7tJPVz4ewCsdddSgB0SoYQSMPBrfzOcLgpXl8vvow1chOQb-W-ZuQ7AZeme8CFqdqCDMpAA";

  beforeEach(async () => {
    server = new TunnelServer();
    await server.start(port, "", idpPublicKey, tunnelAddress);
  });

  afterEach(() => {
    server?.stop();
  });

  const sleep = (amount: number) => new Promise((resolve) => setTimeout(resolve, amount));
  const get = async (path: string, headers?: Headers) => got(`http://localhost:${port}${path}`, { throwHttpErrors: false, headers });

  const incomingSocket = (type = "agent", headers: { [key: string]: string } = {}, keepOpen = 10, close = true): Promise<{
    connection: "open" | "close";
    ws: WebSocket;
  }> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`http://localhost:${port}/${type}/connect`, {
        headers
      });

      let timer: NodeJS.Timeout;

      ws.on("open", () => {
        timer = setTimeout(() => {
          resolve({ connection: "open", ws });

          if (close) {
            ws.close();
          }
        }, keepOpen);
      });

      ws.on("close", (code) => {
        if (code >= 4000) {
          clearTimeout(timer);
          reject(code.toString());
        } else if (!timer) {
          resolve({ connection: "close", ws });
        }
      });
    });
  };

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

    it("responds 200 on /client/public-key with token if agent is connected", async () => {
      const ws = {
        once: jest.fn(),
        on: jest.fn()
      };

      const agents = server.getAgentsForClusterId("a026e50d-f9b4-4aa8-ba02-c9722f7f0663");

      agents.push(new Agent(ws as any, "rsa-public-key"));

      const res = await get("/client/public-key", { "Authorization": `Bearer ${jwtToken}`});

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe("rsa-public-key");
    });

    it("responds 403 on /client/public-key without token if agent is not connected", async () => {
      const res = await get("/client/public-key");

      expect(res.statusCode).toBe(403);
    });

    it("responds 404 on /client/public-key with token if agent is not connected", async () => {
      const res = await get("/client/public-key", { "Authorization": `Bearer ${jwtToken}`});

      expect(res.statusCode).toBe(404);
    });
  });

  describe("websockets", () => {
    describe("agent socket", () => {
      it("accepts agent connection with shared-secret authorization header", async () => {
        server.stop();
        server = new TunnelServer();
        await server.start(port, secret, idpPublicKey, tunnelAddress);

        const connect = () => {
          return incomingSocket("agent", {
            "Authorization": `Bearer ${secret}`
          });
        };

        await expect(connect()).resolves.toHaveProperty("connection", "open");
      });

      it("handles agent errors", async () => {
        server.stop();
        server = new TunnelServer();
        await server.start(port, secret, idpPublicKey, tunnelAddress);

        const connect = () => {
          return incomingSocket("agent", {
            "Authorization": `Bearer ${secret}`
          }, undefined, false);
        };

        const { connection, ws } = await connect();

        expect(connection).toBe("open");

        const agent = server.agents.get("default")?.[0];

        // Simulate error in agent mplex stream
        (agent as any).mplex.emit("error", new Error());

        ws.close();
      });

      it("accepts agent connection with jwt authorization header", async () => {
        const connect = () => {
          return incomingSocket("agent", {
            "Authorization": `Bearer ${agentJwtToken}`
          });
        };

        await expect(connect()).resolves.toHaveProperty("connection", "open");
      });

      it("rejects agent connection with invalid authorization header", async () => {
        const connect = () => {
          return incomingSocket("agent", {
            "Authorization": `Bearer invalid`
          });
        };

        await expect(connect()).rejects.toBe("4403");
      });
    });

    describe("client socket", () => {
      it("accepts client connection if agent is connected", async () => {
        const agent = incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, 50);

        await sleep(10);

        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${jwtToken}`
          });
        };

        await expect(connect()).resolves.toHaveProperty("connection", "open");

        await agent;
      });

      it("handles client errors", async () => {
        const agentSocket = incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, 50);

        await sleep(10);

        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${jwtToken}`
          }, undefined, false);
        };

        const { connection, ws } = await connect();

        expect(connection).toBe("open");

        await agentSocket;

        const agent = server.agents.get(clusterId)?.[0];
        const client: WebSocket = (agent as any).clients[0];

        client.emit("error", new Error());

        ws.close();
      });

      it("disconnects client connection if token is not signed by IdP", async () => {
        const agent = incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, 50);

        await sleep(10);

        const invalidToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsZW5zLXVzZXIiLCJncm91cHMiOlsiZGV2Il0sImlhdCI6MTUxNjIzOTAyMiwiYXVkIjoiIn0.-6lOaGEVNaq-sxg-NlMMfmE7VQ-KPEqgnIgjUAFVMfQ";
        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${invalidToken}`
          });
        };

        await expect(connect()).rejects.toBe("4403");

        await agent;
      });

      it("disconnects client connection if token audience doesn't match cluster address", async () => {
        const agent = incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, 50);

        await sleep(10);

        // { "aud": "wrong_audience" }
        const invalidToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsZW5zLXVzZXIiLCJncm91cHMiOlsiZGV2Il0sImlhdCI6MTUxNjIzOTAyMiwiYXVkIjoid3JvbmdfYXVkaWVuY2UifQ.MjFrCg2a53pBdZg3xXgnC2zvvynExk_ybDq44logg_C7kHseWH7SFxeHjFLF_ID5ifZaT6d2lhYSH1O3MpOdohdYPSIQ8WrIi8PGy743K52smyURK41G1BkVOVfr8x4kRARVav0JGaWn4RYNlvyiGIyPAo4_CmmUOC7sv93AGF_HF5wXVUO7gpSayFP_pFEUnUe9L7zwqE9QbGqb0KKzOgORbeHbSe49gaeezUu-8F-CiZcnh_3O2bUFK3GBzmYuMlG3cMBE-C5UZmEaQfteGwB7_h5rb9j53SspUmUl7ukWe4D3xsqglgcSxnI3bo0nY09gEQvQZyXNwAkNjeClGA";
        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${invalidToken}`
          });
        };

        await expect(connect()).rejects.toBe("4403");

        await agent;
      });

      it("disconnects client if agent is disconnected", async () => {
        const agent = incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, 50);

        await sleep(10);

        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${jwtToken}`
          }, 200);
        };

        await expect(connect()).rejects.toBe("4410");

        await agent;
      });

      it("rejects client connection if agent is not connected", async () => {
        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${jwtToken}`
          });
        };

        await expect(connect()).rejects.toBe("4404");
      });
    });
  });
});
