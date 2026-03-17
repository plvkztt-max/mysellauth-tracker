const axios = require("axios");
const fs = require("fs");
const cron = require("node-cron");
const puppeteer = require("puppeteer");
const FormData = require("form-data");

console.log('✅ Tracker module loaded');

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

function saveSeen() {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
}

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
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
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

// Send Discord alert
async function sendDiscord(subdomain, screenshotPath) {
  try {
    const formData = new FormData();
    const payload = {
      content: `<@&${ROLE_ID}>`,
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
async function checkShops(emitShop) {
  console.log("Checking for new shops...");
  const subs = await getSubdomains();

  for (const s of subs) {
    const isNew = !seen.includes(s);
    const isLive = await checkLive(s);
    const status = isLive ? 'live' : 'dead';
    const now = Date.now();

    if (isNew) {
      if (isLive) {
        const shotPath = await screenshot(s);
        console.log(`New LIVE shop: ${s}`);
        await sendDiscord(s, shotPath);
      } else {
        console.log(`New DEAD shop: ${s}`);
      }

      seen.push(s);
      saveSeen();
    }

    const shopData = {
      domain: s,
      status,
      discoveredAt: isNew ? now : undefined,
      lastChecked: now
    };

    emitShop(shopData);
  }
}

function startTracker(emitShop) {
  if (typeof emitShop !== 'function') {
    throw new Error('startTracker requires an emitShop callback function');
  }

  // Run every 5 minutes
  cron.schedule("*/5 * * * *", () => checkShops(emitShop));

  // Run immediately
  checkShops(emitShop);
}

function getAllShops() {
  return shops;
}

module.exports = { startTracker, getAllShops };
