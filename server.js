require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SEEN_FILE = "seen.json";

// Global shops data
let shops = [];

// Load seen shops on startup
if (fs.existsSync(SEEN_FILE)) {
  try {
    const seenData = JSON.parse(fs.readFileSync(SEEN_FILE));
    shops = seenData.map(domain => ({
      domain,
      status: 'unknown',
      discoveredAt: Date.now(), // We don't have exact timestamp, use current
      lastChecked: null
    }));
  } catch (err) {
    console.error("Error loading seen.json:", err);
  }
}

// Serve public folder
app.use(express.static(path.join(__dirname, "public")));

// API endpoint to get shops data
app.get('/api/shops', (req, res) => {
  res.json(shops);
});

// Socket.IO connection
io.on("connection", socket => {
  console.log("Dashboard connected");

  // Send initial shops data
  socket.emit("initialShops", shops);

  // Handle getShops request
  socket.on("getShops", () => {
    socket.emit("initialShops", shops);
  });

  // Handle refresh request
  socket.on("refresh", () => {
    // Could trigger a manual check here
    socket.emit("initialShops", shops);
  });

  // Handle new shop from tracker
  socket.on("newShop", (shopData) => {
    addOrUpdateShop(shopData.domain, shopData.status, shopData.lastChecked);
  });

  // Handle shop update from tracker
  socket.on("shopUpdate", (shopData) => {
    addOrUpdateShop(shopData.domain, shopData.status, shopData.lastChecked);
  });

// Function to add or update shop
function addOrUpdateShop(domain, status = 'unknown', lastChecked = null) {
  const existingIndex = shops.findIndex(shop => shop.domain === domain);
  const now = Date.now();

  if (existingIndex >= 0) {
    // Update existing
    shops[existingIndex] = {
      ...shops[existingIndex],
      status,
      lastChecked: lastChecked || now
    };
  } else {
    // Add new
    shops.unshift({
      domain,
      status,
      discoveredAt: now,
      lastChecked: lastChecked || now
    });
  }

  // Save to seen.json
  const domainsOnly = shops.map(shop => shop.domain);
  fs.writeFileSync(SEEN_FILE, JSON.stringify(domainsOnly, null, 2));

  // Broadcast update
  io.emit("shopUpdate", shops.find(shop => shop.domain === domain));
}

// Export functions for tracker.js
module.exports = {
  io,
  addOrUpdateShop
};

// Start tracker after server is configured
const { startTracker, getAllShops } = require("./tracker");
const { startBot } = require("./discordBot");

startTracker((shopData) => {
  addOrUpdateShop(shopData.domain, shopData.status, shopData.lastChecked);
});

startBot({
  getAll: getAllShops
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));