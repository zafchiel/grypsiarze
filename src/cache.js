import { createClient } from "redis";
import { config } from "dotenv";

// Load environment variables
config();

class RedisCache {
  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set");
    }

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error("Max Redis reconnection attempts reached");
            return false;
          }
          return Math.min(retries * 50, 1000);
        },
        connectTimeout: 10000,
        commandTimeout: 5000,
      },
    });

    this.client.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });

    this.client.on("connect", () => {
      console.log("Connected to Redis");
    });

    this.client.on("reconnecting", () => {
      console.log("Reconnecting to Redis...");
    });

    this.client.on("ready", () => {
      console.log("Redis client ready");
    });

    this.isConnecting = false;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    try {
      this.isConnecting = true;
      await this.client.connect();
      this.isConnected = true;
      this.isConnecting = false;
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      this.isConnecting = false;
      this.isConnected = false;
      // Don't throw error - allow server to continue without cache
      console.log("Server will continue without Redis caching");
    }
  }

  async ensureConnection() {
    if (!this.isConnected && !this.isConnecting) {
      await this.connect();
    }
    return this.isConnected;
  }

  async set(key, value, ttlSeconds = 300) {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        return false;
      }

      const serializedValue = JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, serializedValue);
      console.log(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      console.error("Redis set error:", error);
      return false;
    }
  }

  async get(key) {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        console.log(`Cache MISS (disconnected): ${key}`);
        return null;
      }

      const value = await this.client.get(key);
      if (value) {
        console.log(`Cache HIT: ${key}`);
        return JSON.parse(value);
      } else {
        console.log(`Cache MISS: ${key}`);
        return null;
      }
    } catch (error) {
      console.error("Redis get error:", error);
      return null;
    }
  }

  async delete(key) {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        return 0;
      }

      const result = await this.client.del(key);
      console.log(`Cache DELETE: ${key} (${result} keys deleted)`);
      return result;
    } catch (error) {
      console.error("Redis delete error:", error);
      return 0;
    }
  }

  async deletePattern(pattern) {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        return 0;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        const result = await this.client.del(keys);
        console.log(
          `Cache DELETE PATTERN: ${pattern} (${result} keys deleted)`,
        );
        return result;
      }
      return 0;
    } catch (error) {
      console.error("Redis delete pattern error:", error);
      return 0;
    }
  }

  async clear() {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        return false;
      }

      await this.client.flushDb();
      console.log("Cache CLEARED");
      return true;
    } catch (error) {
      console.error("Redis clear error:", error);
      return false;
    }
  }

  async exists(key) {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error("Redis exists error:", error);
      return false;
    }
  }

  async ttl(key) {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        return -1;
      }

      return await this.client.ttl(key);
    } catch (error) {
      console.error("Redis TTL error:", error);
      return -1;
    }
  }

  async getStats() {
    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        return {
          connected: false,
          error: "Not connected to Redis",
        };
      }

      const info = await this.client.info("memory");
      const dbSize = await this.client.dbSize();

      return {
        connected: this.isConnected,
        dbSize,
        memoryInfo: info,
      };
    } catch (error) {
      console.error("Redis stats error:", error);
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  async disconnect() {
    try {
      if (this.isConnected) {
        this.client.destroy();
        this.isConnected = false;
        console.log("Disconnected from Redis");
      }
    } catch (error) {
      console.error("Redis disconnect error:", error);
    }
  }
}

export default RedisCache;
