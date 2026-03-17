require('dotenv').config();
const axios = require("axios");
const fs = require("fs");
const cron = require("node-cron");
const puppeteer = require("puppeteer");
const FormData = require("form-data");
const ioClient = require("socket.io-client");

// Socket.IO client for live updates
const DASHBOARD_URL = `http://localhost:${process.env.PORT || 3000}`;
const socket = ioClient(DASHBOARD_URL);

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const DOMAIN = process.env.DOMAIN || "mysellauth.com";
const ROLE_ID = process.env.ROLE_ID;
const SEEN_FILE = "seen.json";
const SCREENSHOT_DIR = "./screenshots";

// Ensure screenshot folder exists
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

// Load seen shops
let seen = [];
if (fs.existsSync(SEEN_FILE)) seen = JSON.parse(fs.readFileSync(SEEN_FILE));

// Get subdomains from crt.sh
async function getSubdomains() {
  try {
    const url = `https://crt.sh/?q=%25.${DOMAIN}&output=json`;
    const res = await axios.get(url);
    const subdomains = new Set();

    res.data.forEach(entry => {
      let names = entry.name_value.replace(/\*\./g, "").split("\n");
      names.forEach(n => {
        if (n.includes(DOMAIN)) subdomains.add(n.trim());
      });
    });

    return [...subdomains];
  } catch (err) {
    console.error("Error fetching subdomains:", err.message);
    return [];
  }
}

// Check if website is live
async function checkLive(url) {
  try {
    await axios.get("https://" + url, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Take screenshot
async function screenshot(url) {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("https://" + url, { waitUntil: "domcontentloaded" });
  const filepath = `${SCREENSHOT_DIR}/${url.replace(/\./g, "_")}.png`;
  await page.screenshot({ path: filepath, fullPage: true });
  await browser.close();
  return filepath;
}

// Save seen shops
function saveSeen() {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
}

// Send Discord alert (only LIVE shops)
async function sendDiscord(subdomain, screenshotPath) {
  try {
    const formData = new FormData();
    const payload = {
      content: `<@&${ROLE_ID}>`, // Ping role
      embeds: [{
        title: `🚨 New LIVE ${DOMAIN} shop detected`,
        description: subdomain + " ✅ Live",
        image: screenshotPath ? { url: `attachment://${screenshotPath.split("/").pop()}` } : undefined,
        color: 5814783,
        timestamp: new Date()
      }]
    };

    formData.append('payload_json', JSON.stringify(payload));
    if (screenshotPath) formData.append('file', fs.createReadStream(screenshotPath));

    await axios.post(WEBHOOK_URL, formData, { headers: formData.getHeaders() });
  } catch (err) {
    console.error("Discord webhook error:", err.message);
  }
}

// Main function
async function checkShops() {
  console.log("Checking for new shops...");
  const subs = await getSubdomains();

  for (const s of subs) {
    if (!seen.includes(s)) {
      const isLive = await checkLive(s);
      if (isLive) {
        const shotPath = await screenshot(s);
        console.log(`New LIVE shop: ${s}`);

        // Discord alert
        await sendDiscord(s, shotPath);

        // Live dashboard update
        socket.emit("newShop", s);
      } else {
        console.log(`Skipped offline shop: ${s}`);
      }
      seen.push(s);
      saveSeen();
    }
  }
}

// Run every 5 minutes
cron.schedule("*/5 * * * *", () => checkShops());

// Run immediately on startup
checkShops();