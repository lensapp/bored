import { TunnelServer } from "../server";
import got from "got";
import { Agent } from "../agent";
import WebSocket from "ws";

describe("TunnelServer", () => {
  let server: TunnelServer;
  const port = 51515;
  const secret = "doubleouseven";

  beforeEach(async () => {
    server = new TunnelServer();
    await server.start(port, secret);
  });

  afterEach(() => {
    server?.stop();
  });

  const sleep = (amount: number) => new Promise((resolve) => setTimeout(resolve, amount));

  const get = async (path: string) => {
    return got(`http://localhost:${port}${path}`, { throwHttpErrors: false });
  };

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
    it("responds 404 on /", async () => {
      const res = await get("/");

      expect(res.statusCode).toBe(404);
    });

    it("responds 200 on /healthz", async () => {
      const res = await get("/healthz");

      expect(res.statusCode).toBe(200);
    });

    it("responds 200 on /client/public-key if agent is connected", async () => {
      server.agents.push(new Agent({} as any, "rsa-public-key"));

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
          return incomingSocket("client", {});
        };

        await expect(connect()).resolves.toBe("open");

        await agent;
      });

      it("disconnects client if agent is disconnected", async () => {
        const agent = incomingSocket("agent", {
          "Authorization": `Bearer ${secret}`
        }, 50);

        await sleep(10);

        const connect = () => {
          return incomingSocket("client", {}, 200);
        };

        await expect(connect()).rejects.toBe("4410");

        await agent;
      });

      it("rejects client connection if agent is not connected", async () => {
        const connect = () => {
          return incomingSocket("client", {});
        };

        await expect(connect()).rejects.toBe("4404");
      });
    });
  });
});
