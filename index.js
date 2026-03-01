const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

//////////////////////////////
// MEMORY STORAGE
//////////////////////////////

const balances = new Map();
const inventories = new Map();
const addictions = new Map();   // userId -> { drug, endTime, warned[] }
const lastRazeUse = new Map();  // overdose tracking
const effects = new Map();      // userId -> [{ name, expires }]

//////////////////////////////
// HELPERS
//////////////////////////////

function getBalance(userId) {
  if (!balances.has(userId)) balances.set(userId, 300);
  return balances.get(userId);
}

function getInventory(userId) {
  if (!inventories.has(userId)) inventories.set(userId, {});
  return inventories.get(userId);
}

function addEffect(userId, name, durationMs) {
  if (!effects.has(userId)) effects.set(userId, []);
  effects.get(userId).push({ name, expires: Date.now() + durationMs });
}

function getEffects(userId) {
  if (!effects.has(userId)) return [];
  return effects.get(userId).filter(e => e.expires > Date.now());
}

//////////////////////////////
// SHOPS
//////////////////////////////

const shops = {
  medshop: {
    'nanobot healing vials': 50,
    'portable blood toxin filters': 75,
    'oxygen rebreather masks': 100,
    'detox injectors': 120,
    'neural stabilizer shots': 150
  },
  chopshop: {
    raze: 200
  }
};

//////////////////////////////
// MEDICAL EFFECT DEFINITIONS
//////////////////////////////

const medicalEffects = {
  "nanobot healing vials": {
    name: "Regeneration",
    duration: 5 * 60 * 1000,
    message: "Nanobots disperse through your bloodstream, knitting tissue and sealing micro-tears."
  },
  "detox injectors": {
    name: "Purified",
    duration: 10 * 60 * 1000,
    message: "A cooling wave spreads through your veins as toxins are neutralized."
  },
  "neural stabilizer shots": {
    name: "Stabilized",
    duration: 10 * 60 * 1000,
    message: "Your thoughts sharpen as erratic neural spikes are dampened."
  },
  "oxygen rebreather masks": {
    name: "Oxygenated",
    duration: 5 * 60 * 1000,
    message: "Your lungs burn with clean air. Every movement feels lighter."
  }
};

//////////////////////////////
// COMMANDS
//////////////////////////////

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check credits'),
  new SlashCommandBuilder().setName('inventory').setDescription('Check inventory'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item')
    .addStringOption(o =>
      o.setName('shop').setRequired(true).setDescription('Shop')
        .addChoices(
          { name: 'Medshop', value: 'medshop' },
          { name: "Fahrren's Chop Shop", value: 'chopshop' }
        ))
    .addStringOption(o => o.setName('item').setRequired(true).setDescription('Item'))
    .addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('Amount')),

  new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item')
    .addStringOption(o => o.setName('item').setRequired(true).setDescription('Item')),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check your condition'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits')
    .addUserOption(o => o.setName('user').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('cure')
    .setDescription('Admin: remove addiction from a user')
    .addUserOption(o => o.setName('user').setRequired(true))
].map(c => c.toJSON());

//////////////////////////////
// REGISTER COMMANDS
//////////////////////////////

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Commands registered');
})();

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

//////////////////////////////
// ADDICTION TIMER
//////////////////////////////

setInterval(async () => {
  const now = Date.now();

  for (const [userId, data] of addictions.entries()) {
    const remaining = data.endTime - now;

    if (remaining <= 0) {
      addictions.delete(userId);
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) user.send("The Crash begins. Pain floods back into your body.");
      continue;
    }

    const minutesLeft = Math.ceil(remaining / 60000);

    if ([10, 5].includes(minutesLeft) && !data.warned.includes(minutesLeft)) {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) user.send("The analgesic haze is thinning. Pain waits beneath the surface. Your system wants Raze.");
      data.warned.push(minutesLeft);
    }
  }
}, 60000);

//////////////////////////////
// INTERACTIONS
//////////////////////////////

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;

  ////////////////// BALANCE
  if (interaction.commandName === 'balance')
    return interaction.reply({ content: `Balance: ${getBalance(userId)} credits`, ephemeral: true });

  ////////////////// INVENTORY
  if (interaction.commandName === 'inventory') {
    const inv = getInventory(userId);
    const list = Object.entries(inv).map(([k,v]) => `${k} x${v}`).join('\n') || 'Empty';
    return interaction.reply({ content: list, ephemeral: true });
  }

  ////////////////// BUY
  if (interaction.commandName === 'buy') {
    const shopName = interaction.options.getString('shop');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    const shop = shops[shopName];
    if (!shop || !shop[item])
      return interaction.reply({ content: 'Item not found.', ephemeral: true });

    const cost = shop[item] * amount;
    if (getBalance(userId) < cost)
      return interaction.reply({ content: 'Not enough credits.', ephemeral: true });

    balances.set(userId, getBalance(userId) - cost);
    const inv = getInventory(userId);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply({ content: `Purchased ${amount} ${item}(s).`, ephemeral: true });
  }

  ////////////////// USE
  if (interaction.commandName === 'use') {
    const item = interaction.options.getString('item').toLowerCase();
    const inv = getInventory(userId);

    if (!inv[item])
      return interaction.reply({ content: 'You do not have that item.', ephemeral: true });

    inv[item]--;

    // MEDICAL EFFECTS
    if (medicalEffects[item]) {
      const effect = medicalEffects[item];
      addEffect(userId, effect.name, effect.duration);
      return interaction.reply({ content: effect.message, ephemeral: true });
    }

    // RAZE
    if (item === 'raze') {
      const now = Date.now();

      if (lastRazeUse.has(userId) && now - lastRazeUse.get(userId) < 3 * 60 * 1000) {
        if (Math.random() < 0.2) {
          return interaction.reply({
            content: "Your heart stutters under the strain. You pushed too far. The world tilts.",
            ephemeral: true
          });
        }
      }

      lastRazeUse.set(userId, now);

      if (Math.random() < 0.4) {
        addictions.set(userId, { drug: 'Raze', endTime: now + 15 * 60 * 1000, warned: [] });
        return interaction.reply({
          content: "Raze floods your system — heat behind the eyes, static in your nerves. Your body memorizes the feeling.",
          ephemeral: true
        });
      }

      return interaction.reply({
        content: "Your pulse steadies. The surge fades without leaving its hooks in you.",
        ephemeral: true
      });
    }

    return interaction.reply({ content: `Used ${item}.`, ephemeral: true });
  }

  ////////////////// STATUS
  if (interaction.commandName === 'status') {
    const addiction = addictions.get(userId);
    const activeEffects = getEffects(userId);

    let effectText = "None";
    if (activeEffects.length > 0) {
      effectText = activeEffects.map(e => {
        const mins = Math.ceil((e.expires - Date.now()) / 60000);
        return `${e.name} (${mins} min)`;
      }).join('\n');
    }

    return interaction.reply({
      content:
        `Condition Report:\n` +
        `Dependency: ${addiction ? addiction.drug : 'None'}\n` +
        `Active Effects:\n${effectText}`,
      ephemeral: true
    });
  }

  ////////////////// GIVE
  if (interaction.commandName === 'give') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: 'No permission.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    balances.set(target.id, getBalance(target.id) + amount);

    return interaction.reply(`Gave ${amount} credits to ${target.tag}.`);
  }

  ////////////////// CURE
  if (interaction.commandName === 'cure') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: 'No permission.', ephemeral: true });

    const target = interaction.options.getUser('user');
    addictions.delete(target.id);
    return interaction.reply({ content: `${target.username} cured.`, ephemeral: true });
  }
});

client.login(TOKEN);
