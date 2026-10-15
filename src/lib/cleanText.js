/**
 * Utility functions for text cleaning and markdown post-processing in StudyGuru.
 */

/**
 * Removes unnecessary hyphens and em-dashes ('—', '–', '--') in AI responses and chat.
 * Preserves markdown horizontal rules ('---'), code blocks, and valid punctuation.
 *
 * @param {string} text - Raw input string
 * @returns {string} Sanitized string without robotic or awkward em-dashes
 */
export function cleanEmDashes(text) {
  if (!text || typeof text !== 'string') return text;

  // 1. Protect code blocks (```...``` and `...`)
  const protectedBlocks = [];
  let sanitized = text.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
    protectedBlocks.push(match);
    return `__PROTECTED_BLOCK_${protectedBlocks.length - 1}__`;
  });

  // 2. Protect markdown horizontal rules (e.g. \n---\n or lines of 3+ dashes/asterisks/underscores)
  sanitized = sanitized.replace(/(^|\n)\s*([*_-])\s*\2\s*\2(?:\s*\2)*\s*(?=\n|$)/g, (match) => {
    protectedBlocks.push(match);
    return `__PROTECTED_BLOCK_${protectedBlocks.length - 1}__`;
  });

  // 3. Remove em-dash right after punctuation: e.g. ", —", "! —", ". —", "? —", ": —"
  sanitized = sanitized.replace(/([.,!?:;])\s*[—–]+\s*/g, '$1 ');

  // 4. Remove em-dash right before punctuation: e.g. "—," "—."
  sanitized = sanitized.replace(/\s*[—–]+\s*([.,!?:;])/g, '$1');

  // 5. Em-dash at beginning of a line or paragraph: turn into a clean bullet if intended as item
  sanitized = sanitized.replace(/(^|\n)\s*[—–]+\s*/g, '$1• ');

  // 6. Em-dash surrounded by spaces: "word — word" or "word – word" -> "word, word"
  sanitized = sanitized.replace(/\s+[—–]+\s+/g, ', ');

  // 7. Em-dash stuck directly between words without spaces: "learn—just" -> "learn, just"
  sanitized = sanitized.replace(/([\p{L}\p{N}])[—–]+([\p{L}\p{N}])/gu, '$1, $2');

  // 8. Clean double ASCII dashes used as em-dash: "word -- word" or "word--word"
  sanitized = sanitized.replace(/([\p{L}\p{N}])\s*--\s*([\p{L}\p{N}])/gu, '$1, $2');

  // 9. Remove any remaining stray '—' or '–'
  sanitized = sanitized.replace(/[—–]/g, '');

  // 10. Clean up any accidental double commas (e.g. ", ,") or comma preceding punctuation
  sanitized = sanitized.replace(/,\s*,+/g, ',');
  sanitized = sanitized.replace(/,\s*([.?!:;])/g, '$1');

  // 11. Restore protected code blocks and horizontal rules
  sanitized = sanitized.replace(/__PROTECTED_BLOCK_(\d+)__/g, (_, idx) => protectedBlocks[Number(idx)] || '');

  return sanitized;
}

/**
 * Sanitizes raw AI model responses by stripping internal thinking traces,
 * reasoning scratchpads (like DeepSeek/Nemotron thoughts), and leading em-dashes/hyphens.
 *
 * @param {string} text - Raw AI output text
 * @returns {string} Clean response starting directly with user answer
 */
export function cleanAiResponse(text) {
  if (!text || typeof text !== 'string') return text;

  let cleaned = text;

  // 1. Strip <think>...</think> blocks from reasoning models
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // 2. Strip internal reasoning/planning prefixes at the beginning of output
  cleaned = cleaned.replace(/^(?:[—–\-*]\s*(?:I need to|Let me think|Thinking Process|Plan:|As an AI|I will provide).*?\n+)+/gi, '');
  cleaned = cleaned.replace(/^(?:Okay|Alright|Sure),?\s*(?:I need to|let me|I will|here is concise).*?(?:\n\n|\n)/gi, '');

  // 3. Remove leading em-dash, en-dash, or hyphens at the very start of the response
  cleaned = cleaned.replace(/^[—–\-]+\s*/, '');

  // 4. Run through cleanEmDashes
  return cleanEmDashes(cleaned).trim();
}

