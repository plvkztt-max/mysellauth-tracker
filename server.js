require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

console.log('Starting SellAuth Tracker...');
console.log('Discord Token:', process.env.DISCORD_TOKEN ? 'SET' : 'NOT SET');
console.log('Discord Guild ID:', process.env.DISCORD_GUILD_ID ? 'SET' : 'NOT SET');
console.log('Discord Channel ID:', process.env.DISCORD_CHANNEL_ID ? 'SET' : 'NOT SET');

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
});

const liveShopListeners = [];

function onLiveShop(callback) {
  if (typeof callback === 'function') {
    liveShopListeners.push(callback);
  }
}

function emitLiveShop(shop) {
  liveShopListeners.forEach(cb => {
    try {
      cb(shop);
    } catch (err) {
      console.warn('Live shop listener error:', err.message);
    }
  });
}

// Function to add or update shop
function addOrUpdateShop(domain, status = 'unknown', lastChecked = null) {
  const existingIndex = shops.findIndex(shop => shop.domain === domain);
  const now = Date.now();
  const isNew = existingIndex === -1;

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

  // Notify listeners if it's a live shop
  if (status === 'live' && isNew) {
    emitLiveShop(shops.find(shop => shop.domain === domain));
  }
}

// Export functions for tracker.js
module.exports = {
  io,
  addOrUpdateShop,
  onLiveShop
};

// Start tracker after server is configured
const { startTracker, getAllShops } = require("./tracker");
const { startBot } = require("./discordBot");

console.log('Loading tracker and bot...');

try {
  startTracker((shopData) => {
    addOrUpdateShop(shopData.domain, shopData.status, shopData.lastChecked);
  });
  console.log('Tracker started successfully');
} catch (err) {
  console.error('Error starting tracker:', err.message);
}

const liveShopListeners = [];

function onLiveShop(callback) {
  if (typeof callback === 'function') {
    liveShopListeners.push(callback);
  }
}

function emitLiveShop(shop) {
  liveShopListeners.forEach(cb => {
    try {
      cb(shop);
    } catch (err) {
      console.warn('Live shop listener error:', err.message);
    }
  });
}

startBot({
  getAll: getAllShops,
  onLive: onLiveShop
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));