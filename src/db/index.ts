import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc, notInArray, and, sql, gte, asc, lt } from "drizzle-orm";
import { dailyStatsTable, messagesTable, zbrodniarzeTable } from "./schema.js";
import { config } from "dotenv";

config();

if (!process.env.MYSQL_DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const db = drizzle(process.env.MYSQL_DATABASE_URL);

export async function insertMessage(username: string, message: string) {
  const result = await db.insert(messagesTable).values({ username, message });
  return result;
}

export function getAllZbrodniarze() {
  return db
    .select()
    .from(zbrodniarzeTable)
    .orderBy(desc(zbrodniarzeTable.timestamp));
}

export async function getMessagesBeforaZbrodnia(
  username: string,
  year: number,
  month: number,
  day: number,
) {
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
        lt(
          messagesTable.timestamp,
          zbrodniaTimestamp[0]?.timestamp || new Date(),
        ), // Messages before the zbrodnia
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

export async function insertZbrodniarze(
  type: "timeout" | "ban",
  channel: string,
  username: string,
  duration: number,
) {
  const result = await db
    .insert(zbrodniarzeTable)
    .values({ type, channel, username, duration });

  return result;
}

// Function to update daily stats when new ban/timeout is added
export async function incrementDailyStat(type: "timeout" | "ban") {
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

  return result;
}
