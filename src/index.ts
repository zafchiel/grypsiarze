import tmi from "tmi.js";
import winston from "winston";
import { config } from "dotenv";
import { insertZbrodniarze, insertMessage } from "./db/index.js";

// Initialize dotenv
config();

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "grypsiarze.log" }),
  ],
});

// Configure TMI client
const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH_TOKEN,
  },
  channels: [process.env.CHANNEL_NAME as string],
});

// Connect to Twitch
client.connect().catch(console.error);

// Store user messages
client.on("message", async (channel, userstate, message, self) => {
  if (self) return;

  try {
    await insertMessage(userstate.username ?? "", message);
  } catch (error) {
    console.log(error);
    logger.error(error);
  }
});

// Listen for timeout events
client.on("timeout", async (channel, username, reason, duration, userstate) => {
  try {
    await insertZbrodniarze("timeout", channel, username, duration);
  } catch (error) {
    logger.error(error);
  }
});

// Listen for ban events
client.on("ban", async (channel, username, reason, userstate) => {
  try {
    await insertZbrodniarze("ban", channel, username, 0);
  } catch (error) {
    logger.error(error);
  }
});

// Error handling
// client.on("error", (error) => {
//   logger.error({
//     type: "error",
//     message: error.message,
//     stack: error.stack,
//   });
// });
