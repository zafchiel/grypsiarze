import tmi from "tmi.js";
import winston from "winston";
import { config } from "dotenv";
import cron from "node-cron";
import {
  insertZbrodniarze,
  insertMessage,
  deleteOldMessages,
  deleteOldMessagesExceptZbrodniarze,
  incrementDailyStat,
} from "./db/index.js";

// Initialize dotenv
config();

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Configure TMI client
const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH_TOKEN,
  },
  channels: [process.env.CHANNEL_NAME],
});

// Connect to Twitch
client.connect().catch(console.error);

// Store user messages
client.on("message", async (channel, userstate, message, self) => {
  if (self || userstate.username === "streamelements") return;

  try {
    await insertMessage(userstate.username ?? "", message);
  } catch (error) {
    logger.error(error);
  }
});

// Listen for timeout events
client.on("timeout", async (channel, username, reason, duration, userstate) => {
  try {
    await insertZbrodniarze("timeout", channel, username, duration);
    // await deleteOldMessages(username);
    await incrementDailyStat("timeout");
  } catch (error) {
    logger.error(error);
  }
});

// Listen for ban events
client.on("ban", async (channel, username, reason, userstate) => {
  try {
    await insertZbrodniarze("ban", channel, username, 0);
    // await deleteOldMessages(username);
    await incrementDailyStat("ban");
  } catch (error) {
    logger.error(error);
  }
});

// Configure cron job to run every 24 hours
// cron.schedule("0 0 * * *", async () => {
//   try {
//     await deleteOldMessagesExceptZbrodniarze(24); // 24 hours = 1 day
//     logger.info("Cleaned up old messages");
//   } catch (error) {
//     logger.error("Error cleaning up old messages:", error);
//   }
// });
