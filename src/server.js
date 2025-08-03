import polka from "polka";
import {
  getAllZbrodniarze,
  getMessagesBeforaZbrodnia,
  getDailyStats,
} from "./db/index.js";
import cors from "cors";
import cacheService from "./cache-service.js";
import { config } from "dotenv";

config();

const PORT = 31457;
const app = polka();

// Helper function to set HTTP cache headers
function setCacheHeaders(res, maxAge = 300) {
  res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
  res.setHeader("Vary", "Accept-Encoding");
}

// Initialize cache service and warm cache on startup
async function initializeServer() {
  try {
    console.log("Initializing cache service...");
    await cacheService.initialize();

    // Warm the cache with frequently accessed data
    console.log("Warming cache...");
    await cacheService.warmCache({
      getAllZbrodniarze,
      getDailyStats,
    });

    console.log("Cache initialization completed successfully");
  } catch (error) {
    console.error("Failed to initialize cache service:", error);
    console.log("Server will continue without caching");
  }
}

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}, shutting down server gracefully...`);
  try {
    await cacheService.disconnect();
    console.log("Cache service disconnected");
  } catch (error) {
    console.error("Error during cache service shutdown:", error);
  }
  process.exit(0);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle uncaught exceptions and rejections
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
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
  })
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
    // Check cache first
    let zbrodniarze = await cacheService.getCachedZbrodniarze();

    if (!zbrodniarze) {
      console.log("Cache miss for zbrodniarze - fetching from database");
      zbrodniarze = await getAllZbrodniarze();
      await cacheService.cacheZbrodniarze(zbrodniarze);
    }

    setCacheHeaders(res, 300);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(zbrodniarze));
  } catch (error) {
    console.error("Error in /zbrodniarze route:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch zbrodniarze" }));
  }
});

// Route to get last messages for a user (cache for 10 minutes)
app.get("/messages/:username/:year/:month/:day", async (req, res) => {
  const { username, year, month, day } = req.params;

  // Validate parameters
  if (!username || !year || !month || !day) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing required parameters" }));
    return;
  }

  try {
    // Check cache first
    let messages = await cacheService.getCachedMessages(
      username,
      year,
      month,
      day
    );

    if (!messages) {
      console.log(
        `Cache miss for messages ${username}/${year}/${month}/${day} - fetching from database`
      );
      messages = await getMessagesBeforaZbrodnia(username, year, month, day);
      await cacheService.cacheMessages(username, year, month, day, messages);
    }

    setCacheHeaders(res, 600);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(messages));
  } catch (error) {
    console.error(`Error in /messages route for ${username}:`, error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: `Failed to fetch messages for user ${username}`,
      })
    );
  }
});

// Route to get daily stats (cache for 15 minutes)
app.get("/daily-stats", async (req, res) => {
  try {
    // Check cache first
    let stats = await cacheService.getCachedDailyStats();

    if (!stats) {
      console.log("Cache miss for daily stats - fetching from database");
      stats = await getDailyStats();
      await cacheService.cacheDailyStats(stats);
    }

    setCacheHeaders(res, 900);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
  } catch (error) {
    console.error("Error in /daily-stats route:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch daily stats" }));
  }
});

// Route to check if randombrucetv is live
app.get("/twitch/live/randombrucetv", async (req, res) => {
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=randombrucetv`,
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
        },
      }
    );

    const twitchData = await response.json();
    if (twitchData.data.length > 0) {
      // Live
      res.end(
        JSON.stringify({
          isLive: true,
          viewers: twitchData.data[0].viewer_count,
          streamTitle: twitchData.data[0].title,
        })
      );
    } else {
      // Not live
      res.end(
        JSON.stringify({
          isLive: false,
        })
      );
    }
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
    })
  );
});

app.head("/alive", (req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end();
});

// 404 handler
app.use("*", (req, res) => {
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "Not Found",
      path: req.path,
      method: req.method,
    })
  );
});

// Start server
async function startServer() {
  await initializeServer();

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
