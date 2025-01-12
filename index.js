const tmi = require("tmi.js");
const winston = require("winston");
require("dotenv").config();

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "zbrodniarze.log" }),
    new winston.transports.Console(),
  ],
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

// Listen for timeout events
client.on("timeout", (channel, username, reason, duration, userstate) => {
  logger.info({
    type: "timeout",
    channel: channel,
    username: username,
    reason: reason || "No reason provided",
    duration: duration,
    moderator: userstate["login"],
  });
});

// Listen for ban events
client.on("ban", (channel, username, reason, userstate) => {
  logger.info({
    type: "ban",
    channel: channel,
    username: username,
    reason: reason || "No reason provided",
    moderator: userstate["login"],
  });
});

// Error handling
client.on("error", (error) => {
  logger.error({
    type: "error",
    message: error.message,
    stack: error.stack,
  });
});
