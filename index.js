import tmi from "tmi.js";
import winston from "winston";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";

// Initialize dotenv
dotenv.config();

// Use verbose mode for sqlite3
const sqlite = sqlite3.verbose();

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
const db = new sqlite.Database("zbrodniarze.db");

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS zbrodniarze (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    type TEXT,
    channel TEXT,
    username TEXT,
    duration INTEGER
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
        `INSERT INTO zbrodniarze (type, channel, username, duration) 
         VALUES (?, ?, ?, ?)`,
        ["timeout", channel, username, duration]
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
        `INSERT INTO zbrodniarze (type, channel, username, duration) 
         VALUES (?, ?, ?, ?)`,
        ["ban", channel, username, 0]
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
