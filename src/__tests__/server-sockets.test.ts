import { TunnelServer } from "../server";
import { Client } from "../agent";
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

type IncomingSocket = {
  connection: "open" | "close";
  ws: WebSocket;
};

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
    server.disableKeepAlive();
    await server.start(port, "", idpPublicKey, tunnelAddress);
  });

  afterEach(() => {
    server?.stop();
  });

  const sleep = (amount: number) => new Promise((resolve) => setTimeout(resolve, amount));

  const incomingSocket = (type = "agent", headers: { [key: string]: string } = {}, keepOpen = 10, close = true, endpoint = "connect"): Promise<IncomingSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`http://localhost:${port}/${type}/${endpoint}`, {
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
        const client: Client = (agent as any).clients[0];

        client.socket.emit("error", new Error());

        ws.close();
      });

      it("ensures ClientConnected event", async () => {
        const callback = jest.fn();

        server.on("ClientConnected", () => callback());

        const agent = await incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, undefined, false);

        const client = await incomingSocket("client", {
          "Authorization": `Bearer ${jwtToken}`
        }, undefined, false);

        expect(callback).toBeCalledTimes(1);

        client.ws.close();
        agent.ws.close();
      });


      it("ensures ClientDisconnected event", async () => {
        const callback = jest.fn();

        server.on("ClientDisconnected", () => callback());

        const agent = await incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, undefined, false);

        const client = await incomingSocket("client", {
          "Authorization": `Bearer ${jwtToken}`
        }, undefined, false);

        client.ws.close();

        await sleep(50);

        expect(callback).toBeCalledTimes(1);

        agent.ws.close();
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

    describe("client presence socket", () => {
      it("accepts client connection if agent is connected", async () => {
        const agent = incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, 50);

        await sleep(10);

        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${jwtToken}`
          }, 10, true, "presence");
        };

        await expect(connect()).resolves.toHaveProperty("connection", "open");

        await agent;
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
          }, 10, true, "presence");
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
          }, 10, true, "presence");
        };

        await expect(connect()).rejects.toBe("4403");

        await agent;
      });

      it("does not disconnect client if agent is disconnected", async () => {
        const agent = incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, 50);

        await sleep(10);

        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${jwtToken}`
          }, 200, true, "presence");
        };

        await expect(connect()).resolves.toHaveProperty("connection", "open");

        await agent;
      });

      it("handles client connection gracefully if agent is not connected", async () => {
        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${jwtToken}`
          }, 10, true, "presence");
        };

        await expect(connect()).resolves.toHaveProperty("connection", "open");
      });

      it("sends empty presence json to client presence socket when socket is open", async () => {
        expect.assertions(1);

        const presence = await incomingSocket("client", {
          "Authorization": `Bearer ${jwtToken}`
        }, undefined, false, "presence");

        await new Promise((resolve) => {
          presence.ws.onmessage = (message) => {
            expect(message.data).toBe(JSON.stringify({
              "presence" : {
                "userIds" : []
              }
            }));
            presence.ws.close();
            resolve(true);
          };
        });
      });


      it("sends presence json to client presence socket when socket is open and clients are already connected", async () => {
        expect.assertions(1);

        const agent = await incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, undefined, false);

        const client = await incomingSocket("client", {
          "Authorization": `Bearer ${jwtToken}`
        }, undefined, false);

        const presence = await incomingSocket("client", {
          "Authorization": `Bearer ${jwtToken}`
        }, undefined, false, "presence");

        await new Promise((resolve) => {
          presence.ws.onmessage = (message) => {
            expect(message.data).toBe(JSON.stringify({
              "presence" : {
                "userIds" : ["lens-user"]
              }
            })
            );

            presence.ws.close();
            client.ws.close();
            agent.ws.close();

            resolve(true);
          };
        });
      });

      it("sends userIds per agent to client presence socket after agent and client connected", async () => {
        expect.assertions(1);

        const presence = await incomingSocket("client", {
          "Authorization": `Bearer ${jwtToken}`
        }, undefined, false, "presence");

        //await sleep(200); //waits until first message was sent

        let agent: IncomingSocket | null = null;
        let client: IncomingSocket | null = null;

        agent = await incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, undefined, false);

        client = await incomingSocket("client", {
          "Authorization": `Bearer ${jwtToken}`
        }, undefined, false);

        const testPromise = new Promise((resolve) => {
          presence.ws.onmessage = (message) => {
            expect(message.data).toBe(JSON.stringify({
              "presence" : {
                "userIds" : ["lens-user"]
              }
            }));

            presence.ws.close();
            client?.ws.close();
            agent?.ws.close();

            resolve(true);
          };
        });

        await testPromise;
      });

      it("sends empty presence json to client presence socket after agent and client connected and disconnected", async () => {
        expect.assertions(1);

        const presence = await incomingSocket("client", {
          "Authorization": `Bearer ${jwtToken}`
        }, undefined, false, "presence");

        await sleep(200); //waits until first message was sent

        const agent = await incomingSocket("agent", {
          "Authorization": `Bearer ${agentJwtToken}`
        }, undefined, false);

        const client = await incomingSocket("client", {
          "Authorization": `Bearer ${jwtToken}`
        }, undefined, false);

        const testPromise = new Promise((resolve) => {
          presence.ws.onmessage = (message) => {
            expect(message.data).toBe(JSON.stringify({
              "presence" : {
                "userIds" : []
              }
            }));

            presence.ws.close();
            resolve(true);
          };
        });

        agent.ws.close();
        client.ws.close();

        await testPromise;
      });
    });
  });
});
