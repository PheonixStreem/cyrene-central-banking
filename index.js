require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

console.log("Starting bot...");
console.log("TOKEN present:", !!process.env.TOKEN);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
