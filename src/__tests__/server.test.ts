import { TunnelServer } from "../server";
import got from "got";
import { Agent } from "../agent";
import WebSocket from "ws";

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
  const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsZW5zLXVzZXIiLCJncm91cHMiOlsiZGV2Il0sImlhdCI6MTUxNjIzOTAyMiwiYXVkIjoiIn0.ECrhCVhYJgQAg2CCkY6IY4g9WG7otNDEcujNA8ncKpYmzZQJxRASNY8-gUNlHJhzQMlHJd0jYOLL-hEmqSCJ-WupORgtnzriDljRrqEzAE6Cbsu1MJsi1Y9dM6vg6PjFqONmfDh2KhEai9nQURD4prYfKeMkwoVgey5fuqjiMTw5rdcdULxxZx133Wd4_Y4hQFdOBGtfs54ckXMa5aVDX6itePuhJtt00oMWync-Qlomb9U8m8_VdRRS6cwa2nUEmeLDAGwuPiNKgkBX_noU_AM4UdUmz2_3x3_zkJO9IVMddxuwGSUGsExKoOWs0_l-660YJA7Z5ajI67xLPOFIvQ";

  beforeEach(async () => {
    server = new TunnelServer();
    await server.start(port, secret, idpPublicKey);
  });

  afterEach(() => {
    server?.stop();
  });

  const sleep = (amount: number) => new Promise((resolve) => setTimeout(resolve, amount));
  const get = async (path: string) => got(`http://localhost:${port}${path}`, { throwHttpErrors: false });

  const incomingSocket = (type = "agent", headers: { [key: string]: string } = {}, keepOpen = 10): Promise<string> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`http://localhost:${port}/${type}/connect`, {
        headers
      });

      let timer: NodeJS.Timeout;

      ws.on("open", () => {
        timer = setTimeout(() => {
          resolve("open");
          ws.close();
        }, keepOpen);
      });

      ws.on("close", (code) => {
        if (code >= 4000) {
          clearTimeout(timer);
          reject(code.toString());
        } else if (!timer) {
          resolve("close");
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

    it("responds 200 on /.well-known/public_key", async () => {
      const res = await get("/.well-known/public_key");

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(idpPublicKey);
    });

    it("responds 200 on /client/public-key if agent is connected", async () => {
      const ws = {
        once: jest.fn(),
        on: jest.fn()
      };

      server.agents.push(new Agent(ws as any, "rsa-public-key"));

      const res = await get("/client/public-key");

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe("rsa-public-key");
    });

    it("responds 404 on /client/public-key if agent is not connected", async () => {
      const res = await get("/client/public-key");

      expect(res.statusCode).toBe(404);
    });
  });

  describe("websockets", () => {
    describe("agent socket", () => {
      it("accepts agent connection with correct authorization header", async () => {
        const connect = () => {
          return incomingSocket("agent", {
            "Authorization": `Bearer ${secret}`
          });
        };

        await expect(connect()).resolves.toBe("open");
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
          "Authorization": `Bearer ${secret}`
        }, 50);

        await sleep(10);

        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${token}`
          });
        };

        await expect(connect()).resolves.toBe("open");

        await agent;
      });

      it("disconnects client connection token is not signed by IdP", async () => {
        const agent = incomingSocket("agent", {
          "Authorization": `Bearer ${secret}`
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

      it("disconnects client if agent is disconnected", async () => {
        const agent = incomingSocket("agent", {
          "Authorization": `Bearer ${secret}`
        }, 50);

        await sleep(10);

        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${token}`
          }, 200);
        };

        await expect(connect()).rejects.toBe("4410");

        await agent;
      });

      it("rejects client connection if agent is not connected", async () => {
        const connect = () => {
          return incomingSocket("client", {
            "Authorization": `Bearer ${token}`
          });
        };

        await expect(connect()).rejects.toBe("4404");
      });
    });
  });
});
