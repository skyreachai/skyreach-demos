/**
 * Splits a long AI response into natural WhatsApp-style message chunks.
 *
 * Rules:
 * 1. Split on double newlines first (paragraph breaks)
 * 2. If a chunk is still too long, split on single newlines
 * 3. If still too long, split on sentence boundaries (. ! ?)
 * 4. Preserves emojis, markdown, and formatting perfectly
 * 5. Never splits mid-word or mid-emoji
 */

const MAX_CHUNK_LENGTH = 800; // WhatsApp messages feel natural under ~800 chars

/**
 * Split message into natural WhatsApp-sized chunks.
 * @param {string} message - Full AI response text
 * @returns {string[]} Array of message chunks to send sequentially
 */
function splitMessage(message) {
  if (!message || message.trim().length === 0) {
    return [];
  }

  // If short enough, send as one message
  if (message.length <= MAX_CHUNK_LENGTH) {
    return [message.trim()];
  }

  // Step 1: Split on double newlines (paragraphs)
  const paragraphs = message.split(/\n\n+/);
  const chunks = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // If adding this paragraph would exceed limit, flush current chunk
    if (currentChunk && (currentChunk.length + trimmed.length + 2) > MAX_CHUNK_LENGTH) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }

    // If the paragraph itself is too long, break it down further
    if (trimmed.length > MAX_CHUNK_LENGTH) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      const subChunks = splitLongParagraph(trimmed);
      chunks.push(...subChunks);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * Break a long paragraph into smaller pieces at sentence boundaries.
 */
function splitLongParagraph(text) {
  // Try splitting on newlines first
  const lines = text.split(/\n/);
  if (lines.length > 1) {
    return mergeSmallChunks(lines.map(l => l.trim()).filter(Boolean), '\n');
  }

  // Split on sentence boundaries (. ! ? followed by space or end)
  const sentences = text.match(/[^.!?]+[.!?]+[\s]?|[^.!?]+$/g);
  if (sentences && sentences.length > 1) {
    return mergeSmallChunks(sentences.map(s => s.trim()).filter(Boolean), ' ');
  }

  // Last resort: hard split at max length on word boundary
  return hardSplit(text);
}

/**
 * Merge small pieces back together until they approach the limit.
 */
function mergeSmallChunks(pieces, joiner) {
  const chunks = [];
  let current = '';

  for (const piece of pieces) {
    if (current && (current.length + piece.length + joiner.length) > MAX_CHUNK_LENGTH) {
      chunks.push(current.trim());
      current = '';
    }
    current += (current ? joiner : '') + piece;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Hard split on word boundaries when nothing else works.
 */
function hardSplit(text) {
  const words = text.split(/\s+/);
  const chunks = [];
  let current = '';

  for (const word of words) {
    if (current && (current.length + word.length + 1) > MAX_CHUNK_LENGTH) {
      chunks.push(current.trim());
      current = '';
    }
    current += (current ? ' ' : '') + word;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

module.exports = { splitMessage, MAX_CHUNK_LENGTH };
