import polka from "polka";
import {
  getAllZbrodniarze,
  getMessagesBeforaZbrodnia,
  getDailyStats,
} from "./db/index.js";
import cors from "cors";
import cacheService from "./cache-service.js";

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
    methods: ["GET", "HEAD", "DELETE", "POST"],
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
      day,
    );

    if (!messages) {
      console.log(
        `Cache miss for messages ${username}/${year}/${month}/${day} - fetching from database`,
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
      }),
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

// Cache management endpoints

// Get cache status and health
app.get("/cache/status", async (req, res) => {
  try {
    const [stats, health] = await Promise.all([
      cacheService.getStats(),
      cacheService.healthCheck(),
    ]);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        stats,
        health,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Cache status error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to get cache status" }));
  }
});

// Cache health check endpoint
app.get("/cache/health", async (req, res) => {
  try {
    const health = await cacheService.healthCheck();
    const statusCode = health.healthy ? 200 : 503;

    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(health));
  } catch (error) {
    console.error("Cache health check error:", error);
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    );
  }
});

// Clear all cache
app.delete("/cache", async (req, res) => {
  try {
    await cacheService.clear();
    console.log("All cache cleared via API");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Cache cleared successfully",
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Cache clear error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to clear cache" }));
  }
});

// Warm cache endpoint
app.post("/cache/warm", async (req, res) => {
  try {
    await cacheService.warmCache({
      getAllZbrodniarze,
      getDailyStats,
    });

    console.log("Cache warmed via API");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Cache warmed successfully",
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Cache warm error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to warm cache" }));
  }
});

// Clear specific cache by key
app.delete("/cache/:key", async (req, res) => {
  const { key } = req.params;

  try {
    const result = await cacheService.delete(key);
    console.log(`Cache key '${key}' deleted via API`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: `Cache key '${key}' deleted`,
        keysDeleted: result,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Cache delete error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Failed to delete cache key '${key}'` }));
  }
});

// Clear cache by pattern
app.delete("/cache/pattern/:pattern", async (req, res) => {
  const { pattern } = req.params;

  try {
    const result = await cacheService.deletePattern(pattern);
    console.log(`Cache pattern '${pattern}' deleted via API`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: `Cache pattern '${pattern}' deleted`,
        keysDeleted: result,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Cache pattern delete error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: `Failed to delete cache pattern '${pattern}'` }),
    );
  }
});

// Invalidate zbrodniarze cache
app.delete("/cache/invalidate/zbrodniarze", async (req, res) => {
  try {
    await cacheService.invalidateZbrodniarze();
    console.log("Zbrodniarze cache invalidated via API");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Zbrodniarze cache invalidated",
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Cache invalidation error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "Failed to invalidate zbrodniarze cache" }),
    );
  }
});

// Invalidate user messages cache
app.delete("/cache/invalidate/messages/:username", async (req, res) => {
  const { username } = req.params;

  if (!username) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Username parameter is required" }));
    return;
  }

  try {
    const result = await cacheService.invalidateUserMessages(username);
    console.log(`Messages cache for user '${username}' invalidated via API`);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: `Messages cache for user '${username}' invalidated`,
        keysDeleted: result,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Cache invalidation error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: `Failed to invalidate messages cache for user '${username}'`,
      }),
    );
  }
});

// Invalidate daily stats cache
app.delete("/cache/invalidate/stats", async (req, res) => {
  try {
    await cacheService.invalidateDailyStats();
    console.log("Daily stats cache invalidated via API");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Daily stats cache invalidated",
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Cache invalidation error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "Failed to invalidate daily stats cache" }),
    );
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

// Comprehensive health check
app.get("/health", async (req, res) => {
  try {
    const cacheHealth = await cacheService.healthCheck();

    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cache: cacheHealth,
      version: process.version,
    };

    // Determine overall health status
    if (!cacheHealth.healthy) {
      health.status = "degraded";
    }

    const statusCode = health.status === "healthy" ? 200 : 503;
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(health));
  } catch (error) {
    console.error("Health check error:", error);
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    );
  }
});

// 404 handler
app.use("*", (req, res) => {
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
  await initializeServer();

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Cache status: http://localhost:${PORT}/cache/status`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Clear cache: DELETE http://localhost:${PORT}/cache`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
