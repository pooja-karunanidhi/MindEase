import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { authRouter } from "./src/server/routes/auth.js";
import { apiRouter } from "./src/server/routes/api.js";
import pool, { initDb } from "./src/server/db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// API Routes
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);

// WebSocket Setup
const wss = new WebSocketServer({ server });

// Map to track which appointmentId each client is in
const clientRooms = new Map<any, string>();

wss.on("connection", (ws) => {
  console.log("Client connected");
  
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      const { type, appointmentId } = data;

      if (type === 'join') {
        clientRooms.set(ws, appointmentId);
        return;
      }

      // Broadcast to all clients who are in the same appointment
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && clientRooms.get(client) === appointmentId) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (err) {
      console.error("WS Message Error:", err);
    }
  });

  ws.on("close", () => {
    clientRooms.delete(ws);
  });
});

// Vite middleware for development
async function setupVite() {
  await initDb();
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }
}

setupVite();

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
