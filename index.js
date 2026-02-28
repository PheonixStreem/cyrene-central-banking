const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const Database = require('better-sqlite3');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

// ===== DATABASE SETUP =====
const db = new Database('economy.db');

// Create tables if they don't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS balances (
    userId TEXT PRIMARY KEY,
    credits INTEGER
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    item TEXT
  )
`).run();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== COMMANDS =====
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

// ===== REGISTER COMMANDS =====
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

// ===== HELPER FUNCTIONS =====
function ensureUser(userId) {
  const user = db.prepare('SELECT credits FROM balances WHERE userId = ?').get(userId);
  if (!user) {
    db.prepare('INSERT INTO balances (userId, credits) VALUES (?, ?)').run(userId, 500);
  }
}

function getBalance(userId) {
  return db.prepare('SELECT credits FROM balances WHERE userId = ?').get(userId).credits;
}

function deductCredits(userId, amount) {
  db.prepare('UPDATE balances SET credits = credits - ? WHERE userId = ?')
    .run(amount, userId);
}

function addItem(userId, item) {
  db.prepare('INSERT INTO inventory (userId, item) VALUES (?, ?)').run(userId, item);
}

function getInventory(userId) {
  return db.prepare('SELECT item FROM inventory WHERE userId = ?').all(userId);
}

// ===== COMMAND HANDLER =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName, user, options } = interaction;
    const userId = user.id;

    ensureUser(userId);

    // BALANCE
    if (commandName === 'balance') {
      const balance = getBalance(userId);
      return interaction.reply(
        `Central Banking confirms a balance of **${balance} credits**.`
      );
    }

    // INVENTORY
    if (commandName === 'inventory') {
      const items = getInventory(userId);

      if (!items.length) {
        return interaction.reply('No registered assets.');
      }

      const list = items.map(i => i.item).join('\n• ');
      return interaction.reply(`Registered Assets:\n• ${list}`);
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

    // BUY ITEMS
    if (commandName === 'buy') {
      const item = options.getString('item').toLowerCase();

      // MED STIM
      if (item === 'medstim' || item === 'med stim') {
        const price = 150;
        if (getBalance(userId) < price) return interaction.reply('Insufficient credits.');
        deductCredits(userId, price);
        addItem(userId, 'Med Stim');
        return interaction.reply('Purchase approved. Med Stim added to registered assets.');
      }

      // RECOVERY POTION
      if (item === 'recovery potion' || item === 'recovery potion') {
        const price = 250;
        if (getBalance(userId) < price) return interaction.reply('Insufficient credits.');
        deductCredits(userId, price);
        addItem(userId, 'Recovery Potion');
        return interaction.reply('Purchase approved. Recovery Potion added to registered assets.');
      }

      // DETOX INJECTOR
      if (item === 'detox injector' || item === 'detox injector') {
        const price = 200;
        if (getBalance(userId) < price) return interaction.reply('Insufficient credits.');
        deductCredits(userId, price);
        addItem(userId, 'Detox Injector');
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
