# Drugscord Multi Bot

# Stage 1 of Drugscord Multibot

## ✨ Features

- **Quick Embed Creation**: Create embeds instantly with `/embed quick`
- **Interactive Builder**: Step-by-step embed creation with `/embed create`
- **Customizable**: Full control over colors, images, footers, and more
- **User-friendly**: Intuitive commands with helpful descriptions
- **Error Handling**: Robust error handling with clear feedback

## 🚀 Available Commands

### `/embed`
- `create` - Interactive embed builder with modal form
- `quick` - Fast embed creation with command options

### `/template`
- `list` - View all available templates
- `use` - Use a pre-built template (announcement, welcome, poll, etc.)

### `/help`
- Get detailed information about all commands and features

### `/getembed`
- Retrieve a embed code from elsewhere
 
## 🛠️ Setup Instructions

### Prerequisites
- Node.js 16.9.0 or higher
- A Discord application and bot token

### 1. Discord Bot Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Copy the bot token
5. Copy the application ID (Client ID)

### 2. Bot Permissions
Your bot needs these permissions:
- `Send Messages`
- `Use Slash Commands`
- `Embed Links`
- `Read Message History`

**Quick Permission Calculator**: Use permission integer `414464723008` for all required permissions.

### 3. Installation
1. Clone this repository or download the files
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_for_testing
   NODE_ENV=production
   ```

4. Deploy slash commands:
   ```bash
   node deploy-commands.js
   ```

5. Start the bot:
   ```bash
   npm start
   ```

### 4. Development Mode
For faster command testing in a specific server:
1. Set `NODE_ENV=development` in your `.env`
2. Add your test server's `GUILD_ID`
3. Run `node deploy-commands.js`

## 💡 Usage Examples

### Quick Embed
```
/embed quick title:"Welcome to our server!" description:"Thanks for joining us!" color:#00ff00
```

### Using Templates
```
/template use name:announcement title:"Server Update" description:"We've added new channels!"
```

### Interactive Builder
```
/embed create
```
Then fill out the modal form with your embed details.

## 🎨 Color Options

You can use colors in several formats:
- Hex codes: `#ff0000`, `#00ff00`, `#0099ff`
- Color names: `red`, `green`, `blue`, `purple`, `orange`
- Discord colors: `Blurple`, `Greyple`, `DarkButNotBlack`

## 📁 Project Structure

```
discord-embed-bot/
├── src/
│   ├── commands/          # Slash commands
│   ├── events/           # Discord event handlers
│   ├── handlers/         # Command and event loaders
│   └── utils/           # Embed utilities and templates
├── deploy-commands.js    # Command deployment script
├── .env.example         # Environment variables template
└── README.md           # This file
```

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests to improve the bot!

## 📄 License

This project is licensed under the MIT License.

---

**Need Help?** Use `/help` in Discord or check the troubleshooting section below.

### Troubleshooting

**Commands not appearing?**
- Make sure you ran `node deploy-commands.js`
- Check that your bot has the required permissions
- Global commands can take up to 1 hour to appear

**Bot not responding?**
- Verify your bot token is correct
- Ensure the bot is online (check Discord)
- Check console for error messages

**Permission errors?**
- Verify bot has `Send Messages` and `Use Slash Commands` permissions
- Make sure the bot role is above any role restrictions