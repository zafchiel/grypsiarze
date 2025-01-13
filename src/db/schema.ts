import { sql } from "drizzle-orm";
import { text, sqliteTable, integer } from "drizzle-orm/sqlite-core";

export const zbrodniarzeTable = sqliteTable("zbrodniarze", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`),
  type: text("type").notNull(),
  channel: text("channel").notNull(),
  username: text("username").notNull(),
  duration: integer("duration").notNull(),
});

export const messagesTable = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  message: text("message").notNull(),
  timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`),
});
