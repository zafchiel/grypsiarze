import polka from "polka";
import {
  getAllZbrodniarze,
  getLastMessages,
  getDailyStats,
} from "./db/index.js";

const PORT = 31457;
const app = polka();

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
app.get("/messages/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const messages = await getLastMessages(username);
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
