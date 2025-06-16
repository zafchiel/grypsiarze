import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc, notInArray, and, sql, gte, asc, lt } from "drizzle-orm";
import { dailyStatsTable, messagesTable, zbrodniarzeTable } from "./schema.js";
import { config } from "dotenv";
import cacheService from "../cache-service.js";

config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const db = drizzle(process.env.DATABASE_URL);

export async function insertMessage(username, message) {
  const result = await db.insert(messagesTable).values({ username, message });
  // Invalidate user messages cache
  await cacheService.invalidateUserMessages(username);
  return result;
}

export function getAllZbrodniarze() {
  return db
    .select()
    .from(zbrodniarzeTable)
    .orderBy(desc(zbrodniarzeTable.timestamp));
}

export async function getMessagesBeforaZbrodnia(username, year, month, day) {
  // Create timestamp strings in mysql format
  // JavaScript months are 0-indexed (0=Jan, 11=Dec), so subtract 1 from month.
  const startDate = `${year}-${month}-${day} 00:00:00`;

  const endDateObject = new Date(year, month - 1, day + 1);
  const endDate = `${endDateObject.getFullYear()}-${
    endDateObject.getMonth() + 1
  }-${endDateObject.getDate()} 00:00:00`;

  // Validate dates 'YYYY-MM-DD HH:MM:SS'
  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    isNaN(new Date(startDate).getTime()) ||
    isNaN(new Date(endDate).getTime())
  ) {
    console.error(`Invalid date provided: ${year}-${month}-${day}`);
    return [];
  }

  // Get the timestamp of the zbrodnia event from provided date range
  const zbrodniaTimestamp = await db
    .select({ timestamp: zbrodniarzeTable.timestamp })
    .from(zbrodniarzeTable)
    .where(
      and(
        eq(zbrodniarzeTable.username, username),
        and(
          sql`${zbrodniarzeTable.timestamp} >= ${startDate} AND ${zbrodniarzeTable.timestamp} <= ${endDate}`,
        ),
      ),
    )
    .limit(1);

  if (zbrodniaTimestamp.length === 0) {
    // If no messages before zbrodnia timestamp are found, return last 5 messages from the user
    return db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.username, username))
      .orderBy(desc(messagesTable.timestamp))
      .limit(5);
  }

  // Fetch 5 messages for the user sent *before* that timestamp
  const messagesBeforeZbrodnia = await db
    .select()
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.username, username),
        lt(messagesTable.timestamp, zbrodniaTimestamp[0].timestamp), // Messages before the zbrodnia
      ),
    )
    .orderBy(desc(messagesTable.timestamp)) // Get the ones closest to the zbrodnia time
    .limit(5);

  if (messagesBeforeZbrodnia.length > 0) {
    return messagesBeforeZbrodnia;
  }

  // If no messages before zbrodnia timestamp are found, return last 5 messages from the user
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
  const result = await db
    .insert(zbrodniarzeTable)
    .values({ type, channel, username, duration });

  // Invalidate related caches
  await cacheService.invalidateZbrodniarze();
  await cacheService.invalidateUserMessages(username);

  return result;
}

// New function to delete messages except the 5 before each zbrodnia
export async function deleteMessagesExceptLastFiveBeforeEachZbrodnia(username) {
  // 1. Get all zbrodnia timestamps for the user
  const zbrodniaEvents = await db
    .selectDistinct({ timestamp: zbrodniarzeTable.timestamp })
    .from(zbrodniarzeTable)
    .where(eq(zbrodniarzeTable.username, username))
    .orderBy(desc(zbrodniarzeTable.timestamp));

  if (zbrodniaEvents.length === 0) {
    // No zbrodnia events for this user, nothing to base deletion on.
    console.log(
      `No zbrodnia events found for ${username}, no messages deleted.`,
    );
    return;
  }

  // 2. For each zbrodnia, find the IDs of the 5 preceding messages
  let messageIdsToKeep = new Set();
  for (const event of zbrodniaEvents) {
    const messagesBeforeEvent = await db
      .select({ id: messagesTable.id })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.username, username),
          lt(messagesTable.timestamp, event.timestamp),
        ),
      )
      .orderBy(desc(messagesTable.timestamp))
      .limit(5);

    messagesBeforeEvent.forEach((msg) => messageIdsToKeep.add(msg.id));
  }

  const uniqueIdsToKeep = Array.from(messageIdsToKeep);

  // 3. Delete all messages for the user NOT in the keep list
  if (uniqueIdsToKeep.length === 0) {
    // If no messages were found before *any* zbrodnia event, delete all messages for the user.
    console.log(
      `No preceding messages found for any zbrodnia for ${username}. Deleting all messages.`,
    );
    return db.delete(messagesTable).where(eq(messagesTable.username, username));
  } else {
    // Delete messages for the user whose IDs are not in the list
    console.log(
      `Keeping ${uniqueIdsToKeep.length} messages for ${username}. Deleting others.`,
    );
    return db
      .delete(messagesTable)
      .where(
        and(
          eq(messagesTable.username, username),
          notInArray(messagesTable.id, uniqueIdsToKeep),
        ),
      );
  }
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
            .from(zbrodniarzeTable),
        ),
      ),
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

  let result;
  if (existingRecord.length > 0) {
    // Update existing record
    result = await db
      .update(dailyStatsTable)
      .set({
        [type === "ban" ? "bans" : "timeouts"]: sql`${
          type === "ban" ? dailyStatsTable.bans : dailyStatsTable.timeouts
        } + 1`,
      })
      .where(eq(dailyStatsTable.date, today));
  } else {
    // Create new record
    result = await db.insert(dailyStatsTable).values({
      date: today,
      timeouts: type === "timeout" ? 1 : 0,
      bans: type === "ban" ? 1 : 0,
    });
  }

  // Invalidate daily stats cache
  await cacheService.invalidateDailyStats();

  return result;
}
