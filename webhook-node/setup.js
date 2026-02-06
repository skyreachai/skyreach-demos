/**
 * Kommo Chats API Setup Utility
 *
 * Run this script to get your channel_secret and scope_id.
 * It walks through 3 steps:
 *   1. Get your account's amojo_id
 *   2. Register a chat channel (get channel_id + channel_secret)
 *   3. Connect the channel to your account (get scope_id)
 *
 * Usage:
 *   node setup.js step1              → Get amojo_id
 *   node setup.js step2              → Register channel
 *   node setup.js step3              → Connect channel & get scope_id
 *   node setup.js check-existing     → Check if you already have channel info
 */

const crypto = require('crypto');
const readline = require('readline');

// ─── Your Kommo config (fill these in) ────────────────────
const CONFIG = {
  subdomain: 'servicioalclientecormetexcom',
  bearer_token: process.env.KOMMO_BEARER_TOKEN || '',
  // These get filled in as you go through the steps:
  amojo_id: process.env.KOMMO_AMOJO_ID || '',
  channel_id: process.env.KOMMO_CHANNEL_ID || '',
  channel_secret: process.env.KOMMO_CHANNEL_SECRET || '',
};

const KOMMO_API = `https://${CONFIG.subdomain}.kommo.com`;
const AMOJO_API = 'https://amojo.kommo.com';

// ─── Helpers ──────────────────────────────────────────────

function buildChatHeaders(bodyString, secret) {
  const md5 = crypto.createHash('md5').update(bodyString).digest('hex');
  const signature = crypto.createHmac('sha1', secret).update(bodyString).digest('hex');
  return {
    'Content-Type': 'application/json',
    'Content-MD5': md5,
    'X-Signature': signature,
    'Date': new Date().toUTCString(),
  };
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Step 1: Get amojo_id ─────────────────────────────────

async function step1() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  STEP 1: Get your account amojo_id');
  console.log('══════════════════════════════════════════════\n');

  let token = CONFIG.bearer_token;
  if (!token) {
    token = await ask('Enter your Kommo Bearer token: ');
  }

  console.log(`\nCalling: GET ${KOMMO_API}/api/v4/account?with=amojo_id\n`);

  const res = await fetch(`${KOMMO_API}/api/v4/account?with=amojo_id`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Error:', res.status, data);
    return;
  }

  console.log('Account info:');
  console.log(`  Name:      ${data.name}`);
  console.log(`  ID:        ${data.id}`);
  console.log(`  amojo_id:  ${data.amojo_id}`);
  console.log(`  Subdomain: ${data.current_user?.subdomain || CONFIG.subdomain}`);

  console.log('\n────────────────────────────────────────────');
  console.log('  SAVE THIS VALUE:');
  console.log(`  KOMMO_AMOJO_ID=${data.amojo_id}`);
  console.log('────────────────────────────────────────────');
  console.log('\nNow run: node setup.js step2');

  return data.amojo_id;
}

// ─── Step 2: Register a chat channel ──────────────────────

async function step2() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  STEP 2: Register a chat channel');
  console.log('══════════════════════════════════════════════\n');

  console.log('To register a chat channel, you need to contact Kommo Support');
  console.log('OR use the API if you have an existing integration.\n');

  console.log('Option A: Via Kommo Developer Portal');
  console.log('  1. Go to https://developers.kommo.com');
  console.log('  2. Go to your integration settings');
  console.log('  3. In the "Chats" section, register a new channel');
  console.log('  4. You\'ll receive channel_id and secret_key\n');

  console.log('Option B: Via API (if your integration supports it)');
  console.log('  POST https://amojo.kommo.com/v2/origin/custom/register\n');

  console.log('Option C: Check your existing WhatsApp channel');
  console.log('  If your WhatsApp is already connected via a custom integration,');
  console.log('  you may already have the channel credentials.\n');

  console.log('────────────────────────────────────────────');
  console.log('  DO YOU ALREADY HAVE CHANNEL CREDENTIALS?');
  console.log('────────────────────────────────────────────\n');

  const hasChannel = await ask('Do you already have a channel_id and channel_secret? (yes/no): ');

  if (hasChannel.toLowerCase() === 'yes' || hasChannel.toLowerCase() === 'y') {
    const channelId = await ask('Enter your channel_id: ');
    const channelSecret = await ask('Enter your channel_secret: ');

    console.log('\n────────────────────────────────────────────');
    console.log('  SAVE THESE VALUES:');
    console.log(`  KOMMO_CHANNEL_ID=${channelId}`);
    console.log(`  KOMMO_CHANNEL_SECRET=${channelSecret}`);
    console.log('────────────────────────────────────────────');
    console.log('\nNow run: node setup.js step3');
  } else {
    console.log('\nYou need to register a channel first.');
    console.log('Contact Kommo support or use your developer portal.');
    console.log('They will respond within 1-3 business days with:');
    console.log('  - channel_id (UUID)');
    console.log('  - secret_key (SHA1 hash)');
    console.log('\nOnce you have these, run: node setup.js step2 again');
  }
}

// ─── Step 3: Connect channel to account ───────────────────

async function step3() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  STEP 3: Connect channel & get scope_id');
  console.log('══════════════════════════════════════════════\n');

  let amojoId = CONFIG.amojo_id;
  let channelId = CONFIG.channel_id;
  let channelSecret = CONFIG.channel_secret;

  if (!amojoId) amojoId = await ask('Enter your amojo_id (from step 1): ');
  if (!channelId) channelId = await ask('Enter your channel_id (from step 2): ');
  if (!channelSecret) channelSecret = await ask('Enter your channel_secret (from step 2): ');

  const body = JSON.stringify({ account_id: amojoId });
  const headers = buildChatHeaders(body, channelSecret);
  const url = `${AMOJO_API}/v2/origin/custom/${channelId}/connect`;

  console.log(`\nCalling: POST ${url}`);
  console.log(`Body: ${body}\n`);

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  const responseText = await res.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }

  if (!res.ok) {
    console.error('Error:', res.status);
    console.error(data);

    if (res.status === 200 || res.status === 202) {
      console.log('\nNote: Channel might already be connected.');
    }
    return;
  }

  console.log('Response:', JSON.stringify(data, null, 2));

  const scopeId = data.scope_id || `${channelId}_${amojoId}`;

  console.log('\n════════════════════════════════════════════════════');
  console.log('  SUCCESS! Here are your credentials for .env:');
  console.log('════════════════════════════════════════════════════');
  console.log(`  KOMMO_CHANNEL_SECRET=${channelSecret}`);
  console.log(`  KOMMO_SCOPE_ID=${scopeId}`);
  console.log(`  KOMMO_ACCOUNT_ID=${CONFIG.subdomain}`);
  console.log('════════════════════════════════════════════════════');
  console.log('\nCopy these to webhook-node/.env and start the server:');
  console.log('  cd webhook-node');
  console.log('  cp .env.example .env');
  console.log('  # paste the values above');
  console.log('  npm start');
}

// ─── Check existing: try to discover channel info ─────────

async function checkExisting() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Checking your existing Kommo setup...');
  console.log('══════════════════════════════════════════════\n');

  let token = CONFIG.bearer_token;
  if (!token) {
    token = await ask('Enter your Kommo Bearer token: ');
  }

  // Get account info with amojo_id
  console.log('1. Getting account info...');
  const accountRes = await fetch(`${KOMMO_API}/api/v4/account?with=amojo_id,amojo_rights`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });
  const account = await accountRes.json();

  if (!accountRes.ok) {
    console.error('  Error fetching account:', accountRes.status, account);
    return;
  }

  console.log(`  Account: ${account.name} (ID: ${account.id})`);
  console.log(`  amojo_id: ${account.amojo_id || 'NOT FOUND'}`);
  console.log(`  amojo_rights: ${JSON.stringify(account.amojo_rights || 'N/A')}`);

  // Get users with amojo_id
  console.log('\n2. Getting users with amojo_id...');
  const usersRes = await fetch(`${KOMMO_API}/api/v4/users?with=amojo_id`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });
  const users = await usersRes.json();

  if (usersRes.ok && users._embedded?.users) {
    for (const user of users._embedded.users) {
      console.log(`  User: ${user.name} (ID: ${user.id}, amojo_id: ${user.amojo_id || 'N/A'})`);
    }
  }

  // Check existing integrations / sources
  console.log('\n3. Getting sources/pipelines for chat channel info...');
  const sourcesRes = await fetch(`${KOMMO_API}/api/v4/sources`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (sourcesRes.ok) {
    const sources = await sourcesRes.json();
    if (sources._embedded?.sources) {
      for (const source of sources._embedded.sources) {
        console.log(`  Source: ${source.name} (ID: ${source.id}, type: ${source.type || 'unknown'})`);
        if (source.services) {
          console.log(`    Services: ${JSON.stringify(source.services)}`);
        }
      }
    }
  } else {
    console.log('  Could not fetch sources:', sourcesRes.status);
  }

  console.log('\n────────────────────────────────────────────');
  console.log('  SUMMARY');
  console.log('────────────────────────────────────────────');
  if (account.amojo_id) {
    console.log(`  ✓ amojo_id found: ${account.amojo_id}`);
    console.log(`    Set: KOMMO_AMOJO_ID=${account.amojo_id}`);
  } else {
    console.log('  ✗ amojo_id not found - chat API may not be enabled');
  }
  console.log('\n  Next: Run "node setup.js step2" to set up your channel');
}

// ─── Main ─────────────────────────────────────────────────

const step = process.argv[2];

switch (step) {
  case 'step1':
    step1().catch(console.error);
    break;
  case 'step2':
    step2().catch(console.error);
    break;
  case 'step3':
    step3().catch(console.error);
    break;
  case 'check-existing':
  case 'check':
    checkExisting().catch(console.error);
    break;
  default:
    console.log(`
Kommo Chats API Setup
=====================

Usage:
  node setup.js check-existing   → Check your current Kommo setup
  node setup.js step1            → Get your account's amojo_id
  node setup.js step2            → Register/configure chat channel
  node setup.js step3            → Connect channel & get scope_id

Run them in order. Each step tells you what to do next.

You'll need your Kommo Bearer token. Set it as:
  export KOMMO_BEARER_TOKEN="your_token_here"

Or the script will ask for it interactively.
    `);
}
