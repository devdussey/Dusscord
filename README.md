### Dusscord - Utility bot with tons of detailed logs.



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
   # BOT_OWNER_IDS=123456789012345678 234567890123456789
   # BOT_OWNER_ID=123456789012345678
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

### Environment Variables

- `OWNER_FALLBACK_ON_CHANNEL_FAIL`: When set to `true`, if a guild’s log delivery mode is set to `channel` and sending to the configured channel fails (missing/not set/inaccessible), the bot will fall back to DMing bot owners. When unset or `false`, no owner-DM fallback occurs in `channel` mode. Applies to both moderation and security logs.
- `BOT_OWNER_IDS`: Space or comma separated list of bot owner user IDs. Takes precedence over `BOT_OWNER_ID` when both are set.
- `BOT_OWNER_ID`: Single bot owner user ID used if `BOT_OWNER_IDS` is unset.
