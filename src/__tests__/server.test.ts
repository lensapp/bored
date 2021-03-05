import { TunnelServer } from "../server";
import got from "got";
import { Agent } from "../agent";
import WebSocket from "ws";

describe("TunnelServer", () => {
  let server: TunnelServer;
  const port = 51515;
  const secret = "doubleouseven";

  beforeAll(() => {
    server = new TunnelServer();
    server.start(port, secret);
  });

  afterEach(() => {
    server.agents = [];
  });

  afterAll(() => {
    server?.stop();
  });

  const get = async (path: string) => {
    return got(`http://localhost:${port}${path}`, { throwHttpErrors: false });
  };

  const incomingSocket = (type = "agent", headers: { [key: string]: string } = {}): Promise<string> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`http://localhost:${port}/${type}/connect`, {
        headers
      });

      let timer: NodeJS.Timeout;

      ws.on("open", () => {
        timer = setTimeout(() => {
          resolve("open");
          ws.close();
        }, 10);
      });

      ws.on("close", (code) => {
        clearTimeout(timer);
        if (code >= 4000) reject(code.toString());
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
  });
});
