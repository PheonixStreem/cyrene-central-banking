const { Client, GatewayIntentBits, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });

/* ===== Credits ===== */

const balances = new Map();
const getBalance = id => balances.has(id) ? balances.get(id) : (balances.set(id, 300), 300);

/* ===== Inventory ===== */

const inventories = new Map();
const getInventory = id => inventories.has(id) ? inventories.get(id) : (inventories.set(id, {}), inventories.get(id));

/* ===== Addiction Tracking ===== */

const razeAddiction = new Map();

/* ===== Shops ===== */

const medShop = {
  "nanobot healing vials": 120,
  "portable blood toxin filters": 150,
  "oxygen rebreather masks": 90,
  "detox injectors": 110,
  "neural stabilizer shots": 130
};

const chopShop = {
  "raze": 200
};

/* ===== Slash Commands ===== */

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check credits'),
  new SlashCommandBuilder().setName('inventory').setDescription('View inventory'),

  new SlashCommandBuilder()
    .setName('medshop')
    .setDescription('View medical supplies'),

  new SlashCommandBuilder()
    .setName('chopshop')
    .setDescription("View Fahrren's Chop Shop"),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item')
    .addStringOption(o => o.setName('item').setRequired(true).setDescription('Item name'))
    .addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('Quantity')),

  new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item')
    .addStringOption(o => o.setName('item').setRequired(true).setDescription('Item name'))
    .addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('Quantity')),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits')
    .addUserOption(o => o.setName('user').setRequired(true).setDescription('User'))
    .addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('Amount')),

  new SlashCommandBuilder()
    .setName('giveitem')
    .setDescription('Admin: give item')
    .addUserOption(o => o.setName('user').setRequired(true).setDescription('User'))
    .addStringOption(o => o.setName('item').setRequired(true).setDescription('Item'))
    .addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('Amount'))
].map(cmd => cmd.toJSON());

/* ===== Register Commands ===== */

client.once('clientReady', async () => {
  console.log(`Online as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered.');
  } catch (err) {
    console.error('Registration error:', err);
  }
});

/* ===== Command Handler ===== */

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  // BALANCE
  if (interaction.commandName === 'balance')
    return interaction.reply({ content: `Balance: ${getBalance(userId)} credits`, ephemeral: true });

  // INVENTORY
  if (interaction.commandName === 'inventory')
    return interaction.reply({
      content: Object.keys(getInventory(userId)).length
        ? 'Your inventory:\n' + Object.entries(getInventory(userId)).map(([i,q]) => `${i}: ${q}`).join('\n')
        : 'Your inventory is empty.',
      ephemeral: true
    });

  // MED SHOP
  if (interaction.commandName === 'medshop') {
    const items = Object.entries(medShop)
      .map(([name, price]) => `${name} — ${price} credits`)
      .join('\n');
    return interaction.reply({ content: `Medical Supplies:\n${items}`, ephemeral: true });
  }

  // CHOP SHOP
  if (interaction.commandName === 'chopshop') {
    const items = Object.entries(chopShop)
      .map(([name, price]) => `${name} — ${price} credits`)
      .join('\n');
    return interaction.reply({ content: `Fahrren's Chop Shop:\n${items}`, ephemeral: true });
  }

  // BUY
  if (interaction.commandName === 'buy') {
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    const price = medShop[item] ?? chopShop[item];
    if (!price) return interaction.reply({ content: 'Item not found.', ephemeral: true });

    const cost = price * amount;
    const balance = getBalance(userId);

    if (balance < cost) {
      return interaction.reply({ content: `You need ${cost} credits but only have ${balance}.`, ephemeral: true });
    }

    balances.set(userId, balance - cost);
    const inv = getInventory(userId);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply({ content: `Purchased ${amount} ${item}(s) for ${cost} credits.`, ephemeral: true });
  }

  // USE ITEM
  if (interaction.commandName === 'use') {
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    const inv = getInventory(userId);

    if (!inv[item] || inv[item] < amount) {
      return interaction.reply({ content: `You don't have enough ${item}.`, ephemeral: true });
    }

    inv[item] -= amount;
    if (inv[item] <= 0) delete inv[item];

    // RAZE ADDICTION
    if (item === "raze") {
      let hooked = razeAddiction.get(userId);

      if (!hooked) {
        if (Math.random() < 0.4) {
          razeAddiction.set(userId, {
            warnings: 0,
            timer: startRazeTimer(userId, interaction.user)
          });

          return interaction.reply({
            content: "The Raze hits hard. Perfect clarity. Perfect power. Somewhere deep down… something wants more.",
            ephemeral: true
          });
        } else {
          return interaction.reply({
            content: "The Raze burns through your system. You walk away clean — for now.",
            ephemeral: true
          });
        }
      }

      // Already hooked → reset timer
      clearInterval(hooked.timer);
      razeAddiction.set(userId, {
        warnings: 0,
        timer: startRazeTimer(userId, interaction.user)
      });

      return interaction.reply({
        content: "Relief floods your system. The hunger quiets… temporarily.",
        ephemeral: true
      });
    }

    return interaction.reply({ content: `Used ${amount} ${item}(s).`, ephemeral: true });
  }

  // GIVE CREDITS (ADMIN)
  if (interaction.commandName === 'give' && interaction.member.permissions.has('Administrator')) {
    const u = interaction.options.getUser('user');
    const a = interaction.options.getInteger('amount');
    balances.set(u.id, getBalance(u.id) + a);
    return interaction.reply({ content: `Gave ${a} credits to ${u.tag}.`, ephemeral: true });
  }

  // GIVE ITEM (ADMIN)
  if (interaction.commandName === 'giveitem' && interaction.member.permissions.has('Administrator')) {
    const u = interaction.options.getUser('user');
    const item = interaction.options.getString('item').toLowerCase();
    const amt = interaction.options.getInteger('amount');
    const inv = getInventory(u.id);
    inv[item] = (inv[item] || 0) + amt;
    return interaction.reply({ content: `Gave ${amt} ${item}(s) to ${u.tag}.`, ephemeral: true });
  }
});

/* ===== Raze Timer ===== */

function startRazeTimer(userId, user) {
  let warnings = 0;

  return setInterval(async () => {
    warnings++;

    try {
      if (warnings <= 2) {
        await user.send("Your body aches for another dose of Raze. The edge is fading.");
      }

      if (warnings === 3) {
        await user.send("Withdrawal sets in. Your nerves scream. You need Raze.");
      }
    } catch {}
  }, 10 * 60 * 1000);
}

client.login(TOKEN);
