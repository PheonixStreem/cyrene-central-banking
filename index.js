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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});


// ================= DATA =================

const balances = new Map();
const inventories = new Map();
const razeState = new Map();

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
    razeState.set(id, { addicted:false, warnings:0, nextTick:0, interval:null });
  }
  return razeState.get(id);
}

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }


// ================= SHOPS =================

const shop = {
  medshop: {
    "nanobot healing vials": 50,
    "portable blood toxin filters": 40,
    "oxygen rebreather masks": 60,
    "detox injectors": 45,
    "neural stabilizer shots": 55
  },
  fahrens: {
    "raze": 120
  }
};


// ================= RAZE =================

const RAZE_INTERVAL = 2 * 60 * 1000;
const RAZE_WARNINGS = 3;

const razeNormal = [
  "The Raze hits your system and your senses sharpen.",
  "As the Raze kicks in, you bounce in place to burn off the excess energy.",
  "The Raze floods your system and you feel warm and charged.",
  "A surge of synthetic adrenaline courses through your veins."
];

const razeAddicted = [
  "As you use Raze, you feel unstoppable.",
  "The edge returns. Your body remembers this power.",
  "Your pulse steadies — the world slows to your pace.",
  "Relief washes over you as the craving quiets."
];

const razeCravings = [
  "Your body aches for another dose of Raze.",
  "The edge is fading. You need more Raze soon.",
  "Your muscles tremble as the crash creeps closer.",
  "You feel the power slipping away."
];


// ================= COMMANDS =================

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check credits'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item')
    .addStringOption(o=>o.setName('shop').setDescription('Shop').setRequired(true))
    .addStringOption(o=>o.setName('item').setDescription('Item').setRequired(true))
    .addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder().setName('inventory').setDescription('View inventory'),

  new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use item')
    .addStringOption(o=>o.setName('item').setDescription('Item').setRequired(true)),

  new SlashCommandBuilder().setName('status').setDescription('Check effects'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits')
    .addUserOption(o=>o.setName('user').setRequired(true))
    .addIntegerOption(o=>o.setName('amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('giveitem')
    .setDescription('Admin: give item')
    .addUserOption(o=>o.setName('user').setRequired(true))
    .addStringOption(o=>o.setName('item').setRequired(true))
    .addIntegerOption(o=>o.setName('amount').setRequired(true))
].map(c=>c.toJSON());


// ================= REGISTER =================

const rest = new REST({version:'10'}).setToken(TOKEN);
(async()=>{
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:commands});
  console.log("Commands registered");
})();

client.once('ready',()=>console.log(`Online as ${client.user.tag}`));
client.on('guildMemberAdd',m=>balances.set(m.id,300));


// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction=>{
  if(!interaction.isChatInputCommand()) return;
  const id = interaction.user.id;

  // BALANCE
  if(interaction.commandName==='balance')
    return interaction.reply({content:`Balance: ${getBalance(id)} credits`,ephemeral:true});

  // INVENTORY
  if(interaction.commandName==='inventory'){
    const inv=getInventory(id);
    if(!Object.keys(inv).length)
      return interaction.reply({content:"Inventory empty.",ephemeral:true});
    const txt=Object.entries(inv).map(([k,v])=>`${k}: ${v}`).join('\n');
    return interaction.reply({content:txt,ephemeral:true});
  }

  // BUY
  if(interaction.commandName==='buy'){
    const shopName=interaction.options.getString('shop').toLowerCase();
    const item=interaction.options.getString('item').toLowerCase();
    const amount=interaction.options.getInteger('amount');

    if(!shop[shopName]||!shop[shopName][item])
      return interaction.reply({content:"Item not found.",ephemeral:true});

    const cost=shop[shopName][item]*amount;
    if(getBalance(id)<cost)
      return interaction.reply({content:"Not enough credits.",ephemeral:true});

    balances.set(id,getBalance(id)-cost);
    const inv=getInventory(id);
    inv[item]=(inv[item]||0)+amount;

    return interaction.reply({content:`Bought ${amount} ${item}.`,ephemeral:true});
  }

  // USE
  if(interaction.commandName==='use'){
    const item=interaction.options.getString('item').toLowerCase();
    const inv=getInventory(id);
    if(!inv[item]) return interaction.reply({content:"You don't have that.",ephemeral:true});
    inv[item]--;

    if(item==='raze'){
      const state=getRaze(id);
      if(!state.addicted && Math.random()<0.35) state.addicted=true;

      await interaction.reply({content: state.addicted?pick(razeAddicted):pick(razeNormal),ephemeral:true});

      if(state.addicted && !state.interval){
        state.nextTick=Date.now()+RAZE_INTERVAL;
        state.interval=setInterval(async()=>{
          const s=getRaze(id);
          s.warnings++;
          if(s.warnings>=RAZE_WARNINGS){
            clearInterval(s.interval);
            s.addicted=false;
            s.warnings=0;
            return;
          }
          s.nextTick=Date.now()+RAZE_INTERVAL;
          try{
            const u=await client.users.fetch(id);
            await u.send(pick(razeCravings));
          }catch{}
        },RAZE_INTERVAL);
      }
      return;
    }

    return interaction.reply({content:`Used ${item}.`,ephemeral:true});
  }

  // STATUS
  if(interaction.commandName==='status'){
    const s=getRaze(id);
    if(!s.addicted) return interaction.reply({content:"No active effects.",ephemeral:true});
    const remain=Math.max(0,Math.floor((s.nextTick-Date.now())/1000));
    return interaction.reply({content:`Raze dependency active.\nNext craving in ${remain}s`,ephemeral:true});
  }

  // GIVE CREDITS
  if(interaction.commandName==='give'){
    if(!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({content:"No permission.",ephemeral:true});

    const user=interaction.options.getUser('user');
    const amount=interaction.options.getInteger('amount');
    balances.set(user.id,getBalance(user.id)+amount);

    return interaction.reply({content:`Gave ${amount} credits to ${user.tag}.`,ephemeral:true});
  }

  // GIVE ITEM
  if(interaction.commandName==='giveitem'){
    if(!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({content:"No permission.",ephemeral:true});

    const user=interaction.options.getUser('user');
    const item=interaction.options.getString('item').toLowerCase();
    const amount=interaction.options.getInteger('amount');

    const inv=getInventory(user.id);
    inv[item]=(inv[item]||0)+amount;

    return interaction.reply({content:`Gave ${amount} ${item} to ${user.tag}.`,ephemeral:true});
  }

});

client.login(TOKEN);
