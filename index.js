const { Client, GatewayIntentBits } = require('discord.js');

console.log("Starting Cyrene Central Banking...");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);

// Prevent exit
setInterval(() => {}, 1000 * 60 * 60);
