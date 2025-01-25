import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc } from "drizzle-orm";
import { messagesTable, zbrodniarzeTable } from "./schema.js";
import { config } from "dotenv";

config();

export const db = drizzle(process.env.DATABASE_URL as string);

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
