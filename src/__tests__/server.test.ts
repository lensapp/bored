import { TunnelServer } from "../server";
import got from "got";
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
  const clusterAddress = "http://localhost/bored/a026e50d-f9b4-4aa8-ba02-c9722f7f0663";
  /**
   * {
   *   "sub": "lens-user",
   *   "groups": [
   *     "dev"
   *   ],
   *   "iat": 1516239022,
   *   "aud": "http://localhost/bored/a026e50d-f9b4-4aa8-ba02-c9722f7f0663"
   * }
   */
  const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsZW5zLXVzZXIiLCJncm91cHMiOlsiZGV2Il0sImlhdCI6MTUxNjIzOTAyMiwiYXVkIjoiaHR0cDovL2xvY2FsaG9zdC9ib3JlZC9hMDI2ZTUwZC1mOWI0LTRhYTgtYmEwMi1jOTcyMmY3ZjA2NjMifQ.UuBNbUAT6_xcFHarHCR6CSdT63Yuu5_AA9Y5igPHdU8AvawYiY68yAxnms_xIK5d9W3Bq_Sf520dLSyl-Q4se5-Y0uT7LaFCy4nf8nbpbMdZQ0Q7b6j-G-MrcgqdU-FQeBalcuA4YoLEiXDbHioq3LKOtP0AwYNDMSwSJcMuVS-JQOtEaqPDmk-L2Jn-oWw2pV48u82_xg-RMnoCmSm5MPQ_CHPETTH2yRrXD_279Pog47_yi8Qq8a_9_GxbaHTpzxZ3Zb2n1STfVu-hOvkeRTzoydfpJ5lUYroX-YPQ8ZWeCycVAamlvW2KulDdSuPE1R-vTSE9j-Ng9kcyl8rE_w";

  beforeEach(async () => {
    server = new TunnelServer();
    await server.start(port, secret, idpPublicKey, clusterAddress);
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

      it("disconnects client connection if token is not signed by IdP", async () => {
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

      it("disconnects client connection if token audience doesn't match cluster address", async () => {
        const agent = incomingSocket("agent", {
          "Authorization": `Bearer ${secret}`
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
