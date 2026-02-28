require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');

console.log("Starting bot...");
console.log("TOKEN present:", !!process.env.TOKEN);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ================= MEMORY STORAGE =================

const balances = {};

function getBalance(userId) {
  if (!balances[userId]) balances[userId] = 300;
  return balances[userId];
}

// ================= COMMANDS =================

const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credits')
].map(cmd => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log("Registering commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("Commands registered.");
  } catch (err) {
    console.error(err);
  }
}

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'balance') {
    const credits = getBalance(interaction.user.id);
    await interaction.reply(`Balance: ${credits} credits`);
  }
});

// ================= START BOT =================

client.once('clientReady', async () => {
  console.log(`Online as ${client.user.tag}`);
  await registerCommands();
});

client.login(process.env.TOKEN);
