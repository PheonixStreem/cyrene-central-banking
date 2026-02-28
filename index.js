const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const DATA_FILE = './data.json';

// ===== Load Data =====
let data = { balances: {}, inventories: {} };

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE));
}

// ===== Save Function =====
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== Commands =====
const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check your credits'),
  new SlashCommandBuilder().setName('inventory').setDescription('View your registered assets'),
  new SlashCommandBuilder().setName('medpoint').setDescription('View MedPoint medical inventory'),
  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy a MedPoint item')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Item name')
        .setRequired(true))
].map(cmd => cmd.toJSON());

// ===== Register Commands =====
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Commands registered.');
  } catch (err) {
    console.error(err);
  }
})();

client.once('ready', () => {
  console.log(`Online as ${client.user.tag}`);
});

// ===== Interaction Handler =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName, user, options } = interaction;

    if (!data.balances[user.id]) data.balances[user.id] = 500;
    if (!data.inventories[user.id]) data.inventories[user.id] = [];

    // BALANCE
    if (commandName === 'balance') {
      return interaction.reply(
        `Central Banking confirms a balance of **${data.balances[user.id]} credits**.`
      );
    }

    // INVENTORY
    if (commandName === 'inventory') {
      if (!data.inventories[user.id].length) {
        return interaction.reply('No registered assets.');
      }

      return interaction.reply(
        `Registered Assets:\n• ${data.inventories[user.id].join('\n• ')}`
      );
    }

    // MEDPOINT DISPLAY
    if (commandName === 'medpoint') {
      return interaction.reply(
`**MedPoint Inventory**
• Med Stim — 150 credits
• Recovery Potion — 250 credits
• Detox Injector — 200 credits`
      );
    }

    // BUY
    if (commandName === 'buy') {
      const item = options.getString('item').toLowerCase();

      // MED STIM
      if (item === 'medstim' || item === 'med stim') {
        const price = 150;
        if (data.balances[user.id] < price) return interaction.reply('Insufficient credits.');
        data.balances[user.id] -= price;
        data.inventories[user.id].push('Med Stim');
        saveData();
        return interaction.reply('Purchase approved. Med Stim added to registered assets.');
      }

      // RECOVERY POTION
      if (item === 'recovery' || item === 'recovery potion') {
        const price = 250;
        if (data.balances[user.id] < price) return interaction.reply('Insufficient credits.');
        data.balances[user.id] -= price;
        data.inventories[user.id].push('Recovery Potion');
        saveData();
        return interaction.reply('Purchase approved. Recovery Potion added to registered assets.');
      }

      // DETOX INJECTOR
      if (item === 'detox' || item === 'detox injector') {
        const price = 200;
        if (data.balances[user.id] < price) return interaction.reply('Insufficient credits.');
        data.balances[user.id] -= price;
        data.inventories[user.id].push('Detox Injector');
        saveData();
        return interaction.reply('Purchase approved. Detox Injector added to registered assets.');
      }

      return interaction.reply('MedPoint does not recognize that item.');
    }

  } catch (error) {
    console.error('Interaction error:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp('An error occurred.');
    } else {
      await interaction.reply('An error occurred.');
    }
  }
});

client.login(token);
setInterval(() => {}, 1000 * 60 * 60);
