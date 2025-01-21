import { sql } from "drizzle-orm";
import { text, sqliteTable, integer, index } from "drizzle-orm/sqlite-core";

export const zbrodniarzeTable = sqliteTable("zbrodniarze", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`),
  type: text("type").notNull(),
  channel: text("channel").notNull(),
  username: text("username").notNull(),
  duration: integer("duration").notNull(),
});

export const messagesTable = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    message: text("message").notNull(),
    timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => {
    return {
      usernameIdx: index("username_idx").on(table.username),
      timestampIdx: index("timestamp_idx").on(table.timestamp),
    };
  }
);
