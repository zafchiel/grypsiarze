import polka from "polka";
import {
  getAllZbrodniarze,
  getMessagesBeforaZbrodnia,
  getDailyStats,
} from "./db/index.js";
import cors from "cors";

const PORT = 31457;
const app = polka();

app.use(
  cors({
    origin: [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "https://glosiciele.pages.dev",
    ],
    methods: ["GET", "HEAD"],
    allowedHeaders: ["Content-Type"],
  })
);

// Route to get all zbrodniarze
app.get("/zbrodniarze", async (req, res) => {
  try {
    const zbrodniarze = await getAllZbrodniarze();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(zbrodniarze));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch zbrodniarze" }));
  }
});

// Route to get last messages for a user
app.get("/messages/:username/:year/:month/:day", async (req, res) => {
  const { username, year, month, day } = req.params;
  try {
    const messages = await getMessagesBeforaZbrodnia(
      username,
      year,
      month,
      day
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(messages));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: `Failed to fetch messages for user ${username}` })
    );
  }
});

// Route to get daily stats
app.get("/daily-stats", async (req, res) => {
  try {
    const stats = await getDailyStats();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch daily stats" }));
  }
});

app.get("/alive", (req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "Server is alive" }));
});

app.head("/alive", (req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "Server is alive" }));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
