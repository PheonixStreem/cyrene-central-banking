const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionsBitField } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const balances = new Map();
const inventories = new Map();
const razeState = new Map();

const RAZE_INTERVAL = 2 * 60 * 1000;
const RAZE_WARNINGS = 3;

// ---------------- MESSAGE SETS ----------------

const razeClean = [
  "The Raze hits your system — edges sharpen, sounds separate, the world snaps into focus.",
  "The surge hits hard. Your muscles twitch with excess energy, begging for movement.",
  "Warmth spreads beneath your skin as the compound floods your system, nerves humming with static.",
  "Your pulse steadies into a powerful rhythm. Pain recedes, replaced by a quiet, dangerous clarity."
];

const razeAddicted = [
  "The surge makes you feel unstoppable — like nothing in this city could slow you down.",
  "The absence of pain feels… right. Your body resists the idea of going back.",
  "Your nerves light up with borrowed strength. Somewhere deep inside, something decides it wants this again.",
  "The world bends to your momentum. When the rush fades, you know you’ll miss it."
];

const razeCravings = [
  "The edge is slipping. Pain presses in at the corners of your nerves.",
  "Your body feels heavier than it should. You catch yourself wanting the silence Raze brings.",
  "A dull ache spreads through your muscles. You remember how easy everything felt before.",
  "Your hands tremble, just slightly. The absence of Raze is louder than its presence."
];

const razeWithdrawal = [
  "The Crash hits. Pain returns all at once, raw and unfiltered.",
  "Your muscles betray you, trembling under their own weight as the numbness vanishes.",
  "Every movement hurts. Your body remembers injuries you forgot you had.",
  "Your nerves scream back to life. The silence is gone — replaced by a storm."
];

const razeOverdose = [
  "Your heart stutters under the strain. You pushed too far, too fast.",
  "The rush spikes violently. Your vision tunnels as your body struggles to keep up.",
  "Your muscles seize with too much power. Something inside you feels close to breaking.",
  "The surge turns jagged. Your system is running beyond safe limits."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------- HELPERS ----------------

function getBalance(id) {
  if (!balances.has(id)) balances.set(id, 300);
  return balances.get(id);
}

function getInventory(id) {
  if (!inventories.has(id)) inventories.set(id, {});
  return inventories.get(id);
}

function getRaze(id) {
  if (!razeState.has(id)) {
    razeState.set(id, {
      addicted: false,
      warnings: 0,
      nextTick: null,
      interval: null,
      lastUse: 0
    });
  }
  return razeState.get(id);
}

// ---------------- SHOPS ----------------

const shops = {
  medshop: {
    "nanobot healing vials": 50,
    "portable blood toxin filters": 75,
    "oxygen rebreather masks": 100,
    "detox injectors": 125,
    "neural stabilizer shots": 150
  },
  chopshop: {
    "raze": 200
  }
};

// ---------------- COMMANDS ----------------

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check credits'),
  new SlashCommandBuilder().setName('inventory').setDescription('View inventory'),
  new SlashCommandBuilder().setName('status').setDescription('View medical status'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy item')
    .addStringOption(o => o.setName('store').setRequired(true)
      .addChoices(
        { name: 'Med Shop', value: 'medshop' },
        { name: 'Fahren’s Chop Shop', value: 'chopshop' }
      ))
    .addStringOption(o => o.setName('item').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item')
    .addStringOption(o => o.setName('item').setRequired(true))
].map(c => c.toJSON());

// ---------------- REGISTER ----------------

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
})();

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

// ---------------- COMMAND HANDLER ----------------

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  // BALANCE
  if (interaction.commandName === 'balance') {
    return interaction.reply({ content: `Balance: ${getBalance(userId)} credits`, ephemeral: true });
  }

  // INVENTORY
  if (interaction.commandName === 'inventory') {
    const inv = getInventory(userId);
    const items = Object.entries(inv).map(([k,v]) => `${k} x${v}`).join('\n') || 'Empty';
    return interaction.reply({ content: `Inventory:\n${items}`, ephemeral: true });
  }

  // STATUS
  if (interaction.commandName === 'status') {
    const state = getRaze(userId);

    if (!state.addicted) {
      return interaction.reply({ content: "No active medical conditions.", ephemeral: true });
    }

    const mins = Math.max(0, Math.floor((state.nextTick - Date.now()) / 60000));

    return interaction.reply({
      content:
        `Medical Status:\n` +
        `• RZ-7 Dependency: ACTIVE\n` +
        `• Withdrawal Warnings: ${state.warnings}/${RAZE_WARNINGS}\n` +
        `• Next deterioration in: ${mins} minutes`,
      ephemeral: true
    });
  }

  // BUY
  if (interaction.commandName === 'buy') {
    const store = interaction.options.getString('store');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    if (!shops[store][item]) {
      return interaction.reply({ content: "Item not found.", ephemeral: true });
    }

    const cost = shops[store][item] * amount;

    if (getBalance(userId) < cost) {
      return interaction.reply({ content: "Insufficient credits.", ephemeral: true });
    }

    balances.set(userId, getBalance(userId) - cost);

    const inv = getInventory(userId);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply({ content: `Purchased ${amount} ${item}.`, ephemeral: true });
  }

  // USE ITEM
  if (interaction.commandName === 'use') {
    const item = interaction.options.getString('item').toLowerCase();
    const inv = getInventory(userId);

    if (!inv[item]) {
      return interaction.reply({ content: "You don't have that item.", ephemeral: true });
    }

    inv[item]--;

    // RAZE
    if (item === 'raze') {
      const state = getRaze(userId);
      const now = Date.now();

      // Overdose check
      if (now - state.lastUse < 60 * 1000 && Math.random() < 0.2) {
        return interaction.reply({ content: pick(razeOverdose), ephemeral: true });
      }

      state.lastUse = now;

      // Addiction roll
      if (!state.addicted && Math.random() < 0.4) {
        state.addicted = true;
        state.warnings = 0;
        await interaction.reply({ content: pick(razeAddicted), ephemeral: true });
      } else {
        await interaction.reply({ content: pick(razeClean), ephemeral: true });
      }

      if (state.addicted) {
        if (state.interval) clearInterval(state.interval);

        state.nextTick = Date.now() + RAZE_INTERVAL;

        state.interval = setInterval(async () => {
          const s = getRaze(userId);
          s.warnings++;

          if (s.warnings >= RAZE_WARNINGS) {
            clearInterval(s.interval);
            s.addicted = false;
            s.warnings = 0;
            return;
          }

          s.nextTick = Date.now() + RAZE_INTERVAL;

          try {
            await interaction.followUp({ content: pick(razeCravings), ephemeral: true });
          } catch {}
        }, RAZE_INTERVAL);
      }

      return;
    }

    return interaction.reply({ content: `${item} used.`, ephemeral: true });
  }
});

client.login(TOKEN);
