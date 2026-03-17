require('dotenv').config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SEEN_FILE = "seen.json";
const SCREENSHOT_DIR = "./screenshots";

// Serve screenshots
app.use("/screenshots", express.static(path.join(__dirname, "screenshots")));
app.use("/socket.io", express.static(path.join(__dirname, "node_modules/socket.io/client-dist")));

// Serve main dashboard HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Socket.IO for live updates
io.on("connection", (socket) => {
  console.log("Dashboard client connected");

  // Send initial shops
  if (fs.existsSync(SEEN_FILE)) {
    const seen = JSON.parse(fs.readFileSync(SEEN_FILE));
    socket.emit("initialShops", seen);
  }

  socket.on("disconnect", () => console.log("Client disconnected"));
});

// Listen for new shops emitted by tracker
io.on("newShop", (shop) => {
  io.emit("newShop", shop);
});

server.listen(PORT, () => console.log(`Dashboard running at http://localhost:${PORT}`));