const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== Storage =====
const balances = {};
const inventories = {};

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
    console.error('Command registration error:', err);
  }
})();

client.once('ready', () => {
  console.log(`Online as ${client.user.tag}`);
});

// ===== Safe Interaction Handler =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName, user, options } = interaction;

    if (!balances[user.id]) balances[user.id] = 500;
    if (!inventories[user.id]) inventories[user.id] = [];

    // BALANCE
    if (commandName === 'balance') {
      return interaction.reply(`Central Banking confirms a balance of **${balances[user.id]} credits**.`);
    }

    // INVENTORY
    if (commandName === 'inventory') {
      if (!inventories[user.id].length) {
        return interaction.reply('No registered assets.');
      }
      return interaction.reply(`Registered Assets:\n• ${inventories[user.id].join('\n• ')}`);
    }

    // MEDPOINT
    if (commandName === 'medpoint') {
      return interaction.reply(
`**MedPoint Inventory**
• Med Stim — 150 credits
• Recovery Potion — 250 credits
• Nanobot Healing Vials — 350 credits
• Portable Blood-Toxin Filters — 180 credits
• Oxygen Rebreather Mask — 220 credits
• Detox Injector — 200 credits
• Neural Stabilizer Shot — 300 credits`
      );
    }

    // BUY
    if (commandName === 'buy') {
      const item = options.getString('item').toLowerCase();

      // MED STIM
      if (item === 'medstim' || item === 'med stim') {
        const price = 150;
        if (balances[user.id] < price) return interaction.reply('Insufficient credits.');
        balances[user.id] -= price;
        inventories[user.id].push('Med Stim');
        return interaction.reply('Purchase approved. Med Stim added to registered assets.');
      }

      // RECOVERY POTION
      if (item === 'recovery' || item === 'recovery potion') {
        const price = 250;
        if (balances[user.id] < price) return interaction.reply('Insufficient credits.');
        balances[user.id] -= price;
        inventories[user.id].push('Recovery Potion');
        return interaction.reply('Purchase approved. Recovery Potion added to registered assets.');
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
