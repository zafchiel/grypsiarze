import express from "express";
import type { Response } from "express";
import {
  getAllZbrodniarze,
  getMessagesBeforaZbrodnia,
  getDailyStats,
} from "./db/index.js";
import cors from "cors";
import { config } from "dotenv";
import type { TwitchStreamsResponse } from "./lib/types.js";

config();

const PORT = process.env.PORT;
const app = express();

// Helper function to set HTTP cache headers
function setCacheHeaders(res: Response, maxAge = 300) {
  res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
  res.setHeader("Vary", "Accept-Encoding");
}

// Handle uncaught exceptions and rejections
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// CORS middleware
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "https://glosiciele.pages.dev",
    ],
    methods: ["GET", "HEAD"],
    allowedHeaders: ["Content-Type"],
  }),
);

// Middleware for error handling
app.use((req, res, next) => {
  res.on("error", (error) => {
    console.error("Response error:", error);
  });
  next();
});

// Route to get all zbrodniarze (cache for 5 minutes)
app.get("/zbrodniarze", async (req, res) => {
  try {
    const zbrodniarze = await getAllZbrodniarze();

    setCacheHeaders(res, 300);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(zbrodniarze));
  } catch (error) {
    console.error("Error in /zbrodniarze route:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch zbrodniarze" }));
  }
});

app.get("/messages/:username/:year/:month/:day", async (req, res) => {
  const { username } = req.params;
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);
  const day = parseInt(req.params.day);

  // Validate parameters
  if (!username || !year || !month || !day) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing required parameters" }));
    return;
  }

  try {
    const messages = await getMessagesBeforaZbrodnia(
      username,
      year,
      month,
      day,
    );

    setCacheHeaders(res, 600);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(messages));
  } catch (error) {
    console.error(`Error in /messages route for ${username}:`, error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: `Failed to fetch messages for user ${username}`,
      }),
    );
  }
});

// Route to get daily stats (cache for 15 minutes)
app.get("/daily-stats", async (req, res) => {
  try {
    const stats = await getDailyStats();

    setCacheHeaders(res, 900);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
  } catch (error) {
    console.error("Error in /daily-stats route:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch daily stats" }));
  }
});

// Route to check if randombrucetv is live (cache for 1 minute)
app.get("/twitch/live/randombrucetv", async (req, res) => {
  try {
    const channel = "randombrucetv";
    let twitchData = {
      isLive: false,
      viewers: 0,
      streamTitle: "",
    };

    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${channel}`,
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID!,
          Authorization: `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
        },
      },
    );

    const apiResponse = (await response.json()) as TwitchStreamsResponse;

    if (apiResponse.data.length > 0) {
      // Live
      twitchData = {
        isLive: true,
        viewers: apiResponse.data[0]?.viewer_count ?? 0,
        streamTitle: apiResponse.data[0]?.title ?? "",
      };
    } else {
      // Not live
      twitchData = {
        isLive: false,
        viewers: 0,
        streamTitle: "",
      };
    }

    // Set cache headers - short TTL since stream status can change quickly
    setCacheHeaders(res, 60);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(twitchData));
  } catch (error) {
    console.error("Error in /twitch/live/randombrucetv route:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to check streamer status" }));
  }
});

// Health check endpoints
app.get("/alive", (req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      message: "Server is alive",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  );
});

app.head("/alive", (req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end();
});

// 404 handler
app.use("*path", (req, res) => {
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "Not Found",
      path: req.path,
      method: req.method,
    }),
  );
});

// Start server
async function startServer() {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
