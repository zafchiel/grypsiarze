const tmi = require("tmi.js");
const winston = require("winston");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

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

// Initialize SQLite database
const db = new sqlite3.Database("zbrodniarze.db");

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS zbrodniarze (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    type TEXT,
    channel TEXT,
    username TEXT,
    reason TEXT,
    duration INTEGER,
    moderator TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Connect to Twitch
client.connect().catch(console.error);

// Store user messages
client.on("message", (channel, userstate, message, self) => {
  if (self) return;

  db.run(`INSERT INTO messages (username, message) VALUES (?, ?)`, [
    userstate.username,
    message,
  ]);
});

// Listen for timeout events
client.on("timeout", (channel, username, reason, duration, userstate) => {
  // Get last 5 messages
  db.all(
    `SELECT message FROM messages 
     WHERE username = ? 
     ORDER BY timestamp DESC LIMIT 5`,
    [username],
    (err, messages) => {
      if (err) logger.error(err);

      // Store timeout action
      db.run(
        `INSERT INTO zbrodniarze (type, channel, username, reason, duration, moderator) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "timeout",
          channel,
          username,
          reason || "No reason provided",
          duration,
          userstate["login"],
        ]
      );
    }
  );
});

// Listen for ban events
client.on("ban", (channel, username, reason, userstate) => {
  // Get last 5 messages
  db.all(
    `SELECT message FROM messages 
     WHERE username = ? 
     ORDER BY timestamp DESC LIMIT 5`,
    [username],
    (err, messages) => {
      if (err) logger.error(err);

      // Store ban action
      db.run(
        `INSERT INTO zbrodniarze (type, channel, username, reason, moderator) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          "ban",
          channel,
          username,
          reason || "No reason provided",
          userstate["login"],
        ]
      );
    }
  );
});

// Error handling
client.on("error", (error) => {
  logger.error({
    type: "error",
    message: error.message,
    stack: error.stack,
  });
});
