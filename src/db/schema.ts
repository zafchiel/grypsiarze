import {
  text,
  mysqlTable,
  int,
  index,
  timestamp,
} from "drizzle-orm/mysql-core";

export const zbrodniarzeTable = mysqlTable("zbrodniarze", {
  id: int("id").primaryKey().autoincrement(),
  timestamp: timestamp("timestamp").defaultNow(),
  type: text("type").notNull(),
  channel: text("channel").notNull(),
  username: text("username").notNull(),
  duration: int("duration").notNull(),
});

export const messagesTable = mysqlTable(
  "messages",
  {
    id: int("id").primaryKey().autoincrement(),
    username: text("username").notNull(),
    message: text("message").notNull(),
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => {
    return {
      usernameIdx: index("username_idx").on(table.username),
      timestampIdx: index("timestamp_idx").on(table.timestamp),
    };
  }
);
