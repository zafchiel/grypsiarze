import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc, notInArray, and, sql } from "drizzle-orm";
import { dailyStatsTable, messagesTable, zbrodniarzeTable } from "./schema.js";
import { config } from "dotenv";

config();

export const db = drizzle(process.env.DATABASE_URL);

export async function insertMessage(username, message) {
  return db.insert(messagesTable).values({ username, message });
}

export function getAllZbrodniarze() {
  return db
    .select()
    .from(zbrodniarzeTable)
    .orderBy(desc(zbrodniarzeTable.timestamp));
}

export function getLastMessages(username) {
  return db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.username, username))
    .orderBy(desc(messagesTable.timestamp))
    .limit(5);
}

export async function getDailyStats(days = 365) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return db
    .select()
    .from(dailyStatsTable)
    .where(gte(dailyStatsTable.date, startDate))
    .orderBy(asc(dailyStatsTable.date));
}

export async function insertZbrodniarze(type, channel, username, duration) {
  return db
    .insert(zbrodniarzeTable)
    .values({ type, channel, username, duration });
}

export async function deleteOldMessages(username) {
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

export async function deleteOldMessagesExceptZbrodniarze(hours) {
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

// Function to update daily stats when new ban/timeout is added
export async function incrementDailyStat(type) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingRecord = await db
    .select()
    .from(dailyStatsTable)
    .where(eq(dailyStatsTable.date, today))
    .limit(1);

  if (existingRecord.length > 0) {
    // Update existing record
    return db
      .update(dailyStatsTable)
      .set({
        [type === "ban" ? "bans" : "timeouts"]: sql`${
          type === "ban" ? dailyStatsTable.bans : dailyStatsTable.timeouts
        } + 1`,
      })
      .where(eq(dailyStatsTable.date, today));
  } else {
    // Create new record
    return db.insert(dailyStatsTable).values({
      date: today,
      timeouts: type === "timeout" ? 1 : 0,
      bans: type === "ban" ? 1 : 0,
    });
  }
}
