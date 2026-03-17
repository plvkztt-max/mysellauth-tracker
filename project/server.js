require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve public folder
app.use(express.static(path.join(__dirname, "public")));

// Socket.IO connection
io.on("connection", socket => {
  console.log("Dashboard connected");
});

// Export io for tracker.js
module.exports = io;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));