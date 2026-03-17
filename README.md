# SellAuth Domain Tracker

A comprehensive SellAuth domain tracker with Discord bot integration and live web dashboard.

## Features

- 🔍 **Domain Discovery**: Automatically scans for new SellAuth subdomains using crt.sh API
- 🤖 **Discord Bot**: Posts live shop alerts and responds to slash commands (/shops, /live, /dead)
- 📊 **Live Dashboard**: Real-time web interface showing all discovered shops with statistics
- 📸 **Screenshots**: Automatic screenshots of live shops for Discord embeds
- ⏰ **Scheduled Scanning**: Runs every 5 minutes to find new domains

## Deployment to Glitch

1. **Import from GitHub**:
   - Go to [glitch.com](https://glitch.com)
   - Click "New Project" → "Import from GitHub"
   - Search for your repo: `plvkztt-max/mysellauth-tracker`
   - Click "Import"

2. **Set Environment Variables**:
   - In your Glitch project, click the "Tools" button (🔧)
   - Click ".env" to open environment variables
   - Add these variables:

   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   DISCORD_GUILD_ID=your_guild_id_here
   DISCORD_CHANNEL_ID=your_channel_id_here
   WEBHOOK_URL=your_webhook_url_here
   DOMAIN=mysellauth.com
   ROLE_ID=your_role_id_here
   PORT=3000
   ```

3. **Start the App**:
   - Glitch will automatically install dependencies and start the app
   - Your app will be live at: `https://[your-project-name].glitch.me`
   - Dashboard: `https://[your-project-name].glitch.me`
   - Bot will automatically connect to Discord

## Local Development

```bash
npm install
npm start
```

Visit `http://localhost:3000` for the dashboard.

## Discord Commands

- `/shops` - Show all discovered shops
- `/live` - Show only live shops
- `/dead` - Show only dead shops

## Architecture

- **server.js**: Express/Socket.IO server serving dashboard and managing shop data
- **tracker.js**: Domain discovery and status checking module
- **discordBot.js**: Discord bot with slash command handlers
- **public/index.html**: Web dashboard with real-time updates