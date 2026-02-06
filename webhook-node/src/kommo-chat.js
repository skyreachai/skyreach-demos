const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const AMOJO_BASE = 'https://amojo.kommo.com';

/**
 * Build the required headers for Kommo Chats API.
 * - Content-Type: application/json
 * - Content-MD5: MD5 hash of the JSON body
 * - X-Signature: HMAC-SHA1 of the JSON body, signed with channel secret
 * - Date: RFC 7231 format
 */
function buildHeaders(bodyString, channelSecret) {
  const md5 = crypto.createHash('md5').update(bodyString).digest('hex');
  const signature = crypto.createHmac('sha1', channelSecret).update(bodyString).digest('hex');

  return {
    'Content-Type': 'application/json',
    'Content-MD5': md5,
    'X-Signature': signature,
    'Date': new Date().toUTCString(),
  };
}

/**
 * Send a single outgoing text message via Kommo Chats API.
 *
 * @param {Object} opts
 * @param {string} opts.scopeId       - Channel scope ID
 * @param {string} opts.channelSecret - Channel secret for signing
 * @param {string} opts.conversationId - Existing chat/conversation ID (from webhook)
 * @param {string} opts.text          - Message text (supports newlines, emojis, markdown)
 * @param {Object} opts.receiver      - Receiver info { id, name, profile }
 * @param {boolean} [opts.silent]     - If true, won't trigger notification (use for all but last message)
 */
async function sendMessage({ scopeId, channelSecret, conversationId, text, receiver, silent = false }) {
  const msgid = `msg-${uuidv4()}`;
  const now = Math.floor(Date.now() / 1000);

  const body = {
    event_type: 'new_message',
    payload: {
      timestamp: now,
      msec_timestamp: Date.now(),
      msgid,
      conversation_id: conversationId,
      sender: {
        id: 'sofia-ai-bot',
        name: 'Sofía',
      },
      message: {
        type: 'text',
        text,
      },
      silent,
    },
  };

  // Only include receiver if provided (needed for first message / chat creation)
  if (receiver) {
    body.payload.receiver = receiver;
  }

  const bodyString = JSON.stringify(body);
  const headers = buildHeaders(bodyString, channelSecret);

  const url = `${AMOJO_BASE}/v2/origin/custom/${scopeId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyString,
  });

  const responseText = await response.text();

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }

  if (!response.ok) {
    const error = new Error(`Kommo Chats API error: ${response.status}`);
    error.status = response.status;
    error.response = data;
    throw error;
  }

  return { msgid, status: response.status, data };
}

module.exports = { sendMessage, buildHeaders };
