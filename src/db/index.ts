import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc, notInArray, and, sql } from "drizzle-orm";
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

export async function deleteOldMessages(username: string) {
  // First get IDs of messages to keep (latest 5)
  const latestMessages = await db
    .select({ id: messagesTable.id })
    .from(messagesTable)
    .where(eq(messagesTable.username, username))
    .orderBy(desc(messagesTable.timestamp))
    .limit(5);

  const messageIdsToKeep = latestMessages.map((msg) => msg.id);

  // Delete all messages for the user except the ones we want to keep
  return db
    .delete(messagesTable)
    .where(
      and(
        eq(messagesTable.username, username),
        notInArray(messagesTable.id, messageIdsToKeep)
      )
    );
}

export async function deleteOldMessagesExceptZbrodniarze(
  hours: number
): Promise<void> {
  const hourAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

  await db
    .delete(messagesTable)
    .where(
      and(
        sql`${messagesTable.timestamp} < ${hourAgo}`,
        notInArray(
          messagesTable.username,
          db
            .select({ username: zbrodniarzeTable.username })
            .from(zbrodniarzeTable)
        )
      )
    );
}
