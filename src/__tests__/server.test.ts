import { TunnelServer } from "../server";
import got from "got";
import { Agent } from "../agent";

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
});
