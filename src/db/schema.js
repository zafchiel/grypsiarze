import { text, mysqlTable, int, timestamp, date } from "drizzle-orm/mysql-core";

export const zbrodniarzeTable = mysqlTable("zbrodniarze", {
  id: int("id").primaryKey().autoincrement(),
  timestamp: timestamp("timestamp").defaultNow(),
  type: text("type").notNull(),
  channel: text("channel").notNull(),
  username: text("username").notNull(),
  duration: int("duration").notNull(),
});

export const messagesTable = mysqlTable("messages", {
  id: int("id").primaryKey().autoincrement(),
  username: text("username").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const dailyStatsTable = mysqlTable("daily_stats", {
  id: int("id").primaryKey().autoincrement(),
  date: date("date").notNull(),
  timeouts: int("timeouts").notNull().default(0),
  bans: int("bans").notNull().default(0),
});
