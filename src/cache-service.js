import RedisCache from "./cache.js";

class CacheService {
  constructor() {
    this.cache = new RedisCache();
    this.isInitialized = false;
  }

  async initialize() {
    if (!this.isInitialized) {
      try {
        await this.cache.connect();
        this.isInitialized = true;
        console.log("Cache service initialized successfully");
      } catch (error) {
        console.error("Failed to initialize cache service:", error);
        console.log("Server will continue without caching");
        this.isInitialized = true; // Mark as initialized to prevent retry loops
      }
    }
  }

  // Cache key generators
  static keys = {
    zbrodniarze: () => "zbrodniarze:all",
    dailyStats: () => "stats:daily",
    messages: (username, year, month, day) =>
      `messages:${username}:${year}:${month}:${day}`,
    userMessages: (username) => `messages:${username}:*`,
    twitchLive: (channel) => `twitch:live:${channel}`,
  };

  // Cache TTL constants (in seconds)
  static TTL = {
    ZBRODNIARZE: 300, // 5 minutes
    MESSAGES: 600, // 10 minutes
    DAILY_STATS: 900, // 15 minutes
    TWITCH_LIVE: 900, // 15 minutes
  };

  async get(key) {
    try {
      await this.initialize();
      return await this.cache.get(key);
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  async set(key, value, ttl = 300) {
    try {
      await this.initialize();
      return await this.cache.set(key, value, ttl);
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  async delete(key) {
    try {
      await this.initialize();
      return await this.cache.delete(key);
    } catch (error) {
      console.error("Cache delete error:", error);
      return 0;
    }
  }

  async deletePattern(pattern) {
    try {
      await this.initialize();
      return await this.cache.deletePattern(pattern);
    } catch (error) {
      console.error("Cache delete pattern error:", error);
      return 0;
    }
  }

  async clear() {
    try {
      await this.initialize();
      return await this.cache.clear();
    } catch (error) {
      console.error("Cache clear error:", error);
      return false;
    }
  }

  // High-level cache operations for specific entities

  async cacheZbrodniarze(data) {
    return this.set(
      CacheService.keys.zbrodniarze(),
      data,
      CacheService.TTL.ZBRODNIARZE
    );
  }

  async getCachedZbrodniarze() {
    return this.get(CacheService.keys.zbrodniarze());
  }

  async invalidateZbrodniarze() {
    try {
      await this.delete(CacheService.keys.zbrodniarze());
      // Also invalidate daily stats as they might be related
      await this.delete(CacheService.keys.dailyStats());
      console.log("Invalidated zbrodniarze and daily stats cache");
    } catch (error) {
      console.error("Error invalidating zbrodniarze cache:", error);
    }
  }

  async cacheMessages(username, year, month, day, data) {
    const key = CacheService.keys.messages(username, year, month, day);
    return this.set(key, data, CacheService.TTL.MESSAGES);
  }

  async getCachedMessages(username, year, month, day) {
    const key = CacheService.keys.messages(username, year, month, day);
    return this.get(key);
  }

  async invalidateUserMessages(username) {
    try {
      const pattern = CacheService.keys.userMessages(username);
      const result = await this.deletePattern(pattern);
      console.log(
        `Invalidated ${result} message cache entries for user: ${username}`
      );
      return result;
    } catch (error) {
      console.error(
        `Error invalidating user messages cache for ${username}:`,
        error
      );
      return 0;
    }
  }

  async cacheDailyStats(data) {
    return this.set(
      CacheService.keys.dailyStats(),
      data,
      CacheService.TTL.DAILY_STATS
    );
  }

  async getCachedDailyStats() {
    return this.get(CacheService.keys.dailyStats());
  }

  async invalidateDailyStats() {
    try {
      await this.delete(CacheService.keys.dailyStats());
      console.log("Invalidated daily stats cache");
    } catch (error) {
      console.error("Error invalidating daily stats cache:", error);
    }
  }

  // Batch invalidation methods
  async invalidateAll() {
    await this.clear();
    console.log("Invalidated all cache");
  }

  async invalidateDataChanges() {
    // Call this when new zbrodniarze or messages are added
    await this.invalidateZbrodniarze();
    await this.invalidateDailyStats();
    console.log("Invalidated caches due to data changes");
  }

  // Cache warming - preload frequently accessed data
  async warmCache(dbFunctions) {
    try {
      console.log("Warming cache...");

      // Warm zbrodniarze cache
      const zbrodniarze = await dbFunctions.getAllZbrodniarze();
      await this.cacheZbrodniarze(zbrodniarze);

      // Warm daily stats cache
      const stats = await dbFunctions.getDailyStats();
      await this.cacheDailyStats(stats);

      console.log("Cache warming completed");
    } catch (error) {
      console.error("Cache warming failed:", error);
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.initialize();
      const testKey = "health:check";
      const testValue = { timestamp: Date.now() };

      await this.set(testKey, testValue, 10);
      const result = await this.get(testKey);
      await this.delete(testKey);

      return {
        healthy: result && result.timestamp === testValue.timestamp,
        connected: this.cache.isConnected,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        healthy: false,
        connected: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  // Get cache statistics
  async getStats() {
    try {
      await this.initialize();
      return await this.cache.getStats();
    } catch (error) {
      console.error("Cache stats error:", error);
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  async disconnect() {
    if (this.isInitialized) {
      await this.cache.disconnect();
      this.isInitialized = false;
    }
  }

  async cacheTwitchLiveStatus(channel, data) {
    return this.set(
      CacheService.keys.twitchLive(channel),
      data,
      CacheService.TTL.TWITCH_LIVE
    );
  }

  async getCachedTwitchLiveStatus(channel) {
    return this.get(CacheService.keys.twitchLive(channel));
  }

  async invalidateTwitchLiveStatus(channel) {
    try {
      await this.delete(CacheService.keys.twitchLive(channel));
      console.log(`Invalidated Twitch live status cache for ${channel}`);
    } catch (error) {
      console.error(`Error invalidating Twitch live status cache for ${channel}:`, error);
    }
  }
}

// Export singleton instance
const cacheService = new CacheService();
export default cacheService;
