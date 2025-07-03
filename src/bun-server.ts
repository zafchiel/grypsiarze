import {
  getAllZbrodniarze,
  getMessagesBeforaZbrodnia,
  getDailyStats,
} from "./db/index.ts";
import cacheService from "./cache-service.ts";

const PORT = 31457;

// Helper function to set HTTP cache headers
function setCacheHeaders(headers: Headers, maxAge = 300) {
  headers.set("Cache-Control", `public, max-age=${maxAge}`);
  headers.set("Vary", "Accept-Encoding");
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
const gracefulShutdown = async (signal: string) => {
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

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const headers = new Headers();

    // CORS headers
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, DELETE, POST");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (url.pathname === "/zbrodniarze") {
      try {
        let zbrodniarze = await cacheService.getCachedZbrodniarze();
        if (!zbrodniarze) {
          console.log("Cache miss for zbrodniarze - fetching from database");
          zbrodniarze = await getAllZbrodniarze();
          await cacheService.cacheZbrodniarze(zbrodniarze);
        }
        setCacheHeaders(headers, 300);
        return new Response(JSON.stringify(zbrodniarze), { headers });
      } catch (error) {
        console.error("Error in /zbrodniarze route:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch zbrodniarze" }),
          { status: 500, headers },
        );
      }
    }

    if (url.pathname.startsWith("/messages/")) {
      const params = url.pathname.split("/").slice(2);
      const [username, year, month, day] = params;

      if (!username || !year || !month || !day) {
        return new Response(
          JSON.stringify({ error: "Missing required parameters" }),
          { status: 400, headers },
        );
      }

      try {
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
          messages = await getMessagesBeforaZbrodnia(
            username,
            year,
            month,
            day,
          );
          await cacheService.cacheMessages(
            username,
            year,
            month,
            day,
            messages,
          );
        }
        setCacheHeaders(headers, 600);
        return new Response(JSON.stringify(messages), { headers });
      } catch (error) {
        console.error(`Error in /messages route for ${username}:`, error);
        return new Response(
          JSON.stringify({
            error: `Failed to fetch messages for user ${username}`,
          }),
          { status: 500, headers },
        );
      }
    }

    if (url.pathname === "/daily-stats") {
      try {
        let stats = await cacheService.getCachedDailyStats();
        if (!stats) {
          console.log("Cache miss for daily stats - fetching from database");
          stats = await getDailyStats();
          await cacheService.cacheDailyStats(stats);
        }
        setCacheHeaders(headers, 900);
        return new Response(JSON.stringify(stats), { headers });
      } catch (error) {
        console.error("Error in /daily-stats route:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch daily stats" }),
          { status: 500, headers },
        );
      }
    }

    if (url.pathname === "/alive") {
      return new Response(
        JSON.stringify({
          message: "Server is alive",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        }),
        { headers },
      );
    }

    if (url.pathname === "/health") {
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
        if (!cacheHealth.healthy) {
          health.status = "degraded";
        }
        const statusCode = health.status === "healthy" ? 200 : 503;
        return new Response(JSON.stringify(health), {
          status: statusCode,
          headers,
        });
      } catch (error) {
        console.error("Health check error:", error);
        return new Response(
          JSON.stringify({
            status: "unhealthy",
            error: error.message,
            timestamp: new Date().toISOString(),
          }),
          { status: 503, headers },
        );
      }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers,
    });
  },
});

console.log(`Server is running on http://localhost:${PORT}`);
