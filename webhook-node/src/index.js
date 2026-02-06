const express = require('express');
const { sendMessage } = require('./kommo-chat');
const { splitMessage } = require('./message-splitter');

const app = express();
app.use(express.json());

// ─── Config ──────────────────────────────────────────────
const PORT = process.env.PORT || 3100;
const CHANNEL_SECRET = process.env.KOMMO_CHANNEL_SECRET;
const SCOPE_ID = process.env.KOMMO_SCOPE_ID;

// Delay between messages (ms) - feels natural on WhatsApp
const MESSAGE_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Health check ────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kommo-chat-sender' });
});

// ─── Main endpoint: n8n calls this to send AI response ──
//
// Expected body from n8n:
// {
//   "message": "Hola! 😊 Soy Sofía...",
//   "conversation_id": "0d162c09-c4f3-4170-ba9b-68aba1a53960",
//   "receiver": {                        ← optional, for context
//     "id": "client-uuid",
//     "name": "Samuel Rios"
//   }
// }
//
app.post('/send-message', async (req, res) => {
  try {
    const { message, conversation_id, receiver } = req.body;

    // Validate required fields
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (!conversation_id) {
      return res.status(400).json({ error: 'conversation_id is required' });
    }
    if (!CHANNEL_SECRET || !SCOPE_ID) {
      return res.status(500).json({ error: 'Missing KOMMO_CHANNEL_SECRET or KOMMO_SCOPE_ID env vars' });
    }

    // Split the AI response into WhatsApp-natural chunks
    const chunks = splitMessage(message);

    console.log(`[send-message] Sending ${chunks.length} chunk(s) to conversation ${conversation_id}`);

    const results = [];

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const chunk = chunks[i];

      console.log(`  → Chunk ${i + 1}/${chunks.length} (${chunk.length} chars, silent=${!isLast})`);

      const result = await sendMessage({
        scopeId: SCOPE_ID,
        channelSecret: CHANNEL_SECRET,
        conversationId: conversation_id,
        text: chunk,
        receiver: receiver || null,
        silent: !isLast, // Only notify on last message
      });

      results.push(result);

      // Wait between messages for natural pacing (skip after last)
      if (!isLast) {
        await sleep(MESSAGE_DELAY_MS);
      }
    }

    res.json({
      success: true,
      chunks_sent: chunks.length,
      results,
    });
  } catch (err) {
    console.error('[send-message] Error:', err.message);
    console.error(err.response || err.stack);

    res.status(err.status || 500).json({
      error: err.message,
      details: err.response || null,
    });
  }
});

// ─── Start ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`kommo-chat-sender running on port ${PORT}`);
  console.log(`  POST /send-message  → Send AI response via Chats API`);
  console.log(`  GET  /health        → Health check`);

  if (!CHANNEL_SECRET || !SCOPE_ID) {
    console.warn('\n  ⚠ WARNING: KOMMO_CHANNEL_SECRET or KOMMO_SCOPE_ID not set!');
    console.warn('  Set them in .env or environment variables.\n');
  }
});
