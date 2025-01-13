import { drizzle } from "drizzle-orm/libsql/node";
import { eq, desc } from "drizzle-orm";
import { messagesTable, zbrodniarzeTable } from "./schema.js";
import { config } from "dotenv";
import { createClient } from "@libsql/client";

config();

const client = createClient({
  url: "file:./zbrodniarze2.db",
});

export const db = drizzle(client);

export async function insertMessage(username: string, message: string) {
  return db.insert(messagesTable).values({ username, message });
}

export async function getMessages(username: string) {
  return db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.username, username))
    .orderBy(desc(messagesTable.timestamp))
    .limit(5);
}

export async function insertZbrodniarze(
  type: string,
  channel: string,
  username: string,
  duration: number
) {
  return db
    .insert(zbrodniarzeTable)
    .values({ type, channel, username, duration });
}
