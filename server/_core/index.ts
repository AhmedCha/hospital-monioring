import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy.ts";
import { appRouter } from "../routers.ts";
import { createContext } from "./context.ts";
import { serveStatic, setupVite } from "./vite.ts";

const app = express();
const server = createServer(app);

// Configure body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerStorageProxy(app);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// development mode uses Vite, production mode uses static files
if (process.env.NODE_ENV === "development") {
  setupVite(app, server);
} else {
  serveStatic(app);
}

// Port finding logic for local development
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return startPort;
}

// Only start the server if this file is run directly (not as a module)
// This is important for Vercel/Serverless
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const startServer = async () => {
    const preferredPort = parseInt(process.env.PORT || "3000");
    const port = await findAvailablePort(preferredPort);
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}/`);
    });
  };
  startServer().catch(console.error);
}

// Export for Vercel
export default app;
