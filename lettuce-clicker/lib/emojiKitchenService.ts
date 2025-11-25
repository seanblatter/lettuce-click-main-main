import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

const normalizeEmoji = (value: string) => value.trim();

// Caches for per-letter chunks
const chunkCache: Record<string, any> = {};

// Fallback: load a chunk by first 3 chars of codepoint (if chunk files exist)
// Note: Metro bundler does not support dynamic require variables. We must use a static map.
// We use .bin extension to ensure Metro treats these as assets (file paths) rather than bundling the JSON content.
const CHUNK_MAP: Record<string, any> = {
  '1f0': require('../assets/emojiKitchenChunks/emojiKitchen_1f0.bin'),
  '1f1': require('../assets/emojiKitchenChunks/emojiKitchen_1f1.bin'),
  '1f3': require('../assets/emojiKitchenChunks/emojiKitchen_1f3.bin'),
  '1f4': require('../assets/emojiKitchenChunks/emojiKitchen_1f4.bin'),
  '1f5': require('../assets/emojiKitchenChunks/emojiKitchen_1f5.bin'),
  '1f6': require('../assets/emojiKitchenChunks/emojiKitchen_1f6.bin'),
  '1f9': require('../assets/emojiKitchenChunks/emojiKitchen_1f9.bin'),
  '1fa': require('../assets/emojiKitchenChunks/emojiKitchen_1fa.bin'),
  '204': require('../assets/emojiKitchenChunks/emojiKitchen_204.bin'),
  '231': require('../assets/emojiKitchenChunks/emojiKitchen_231.bin'),
  '23f': require('../assets/emojiKitchenChunks/emojiKitchen_23f.bin'),
  '260': require('../assets/emojiKitchenChunks/emojiKitchen_260.bin'),
  '261': require('../assets/emojiKitchenChunks/emojiKitchen_261.bin'),
  '262': require('../assets/emojiKitchenChunks/emojiKitchen_262.bin'),
  '263': require('../assets/emojiKitchenChunks/emojiKitchen_263.bin'),
  '264': require('../assets/emojiKitchenChunks/emojiKitchen_264.bin'),
  '265': require('../assets/emojiKitchenChunks/emojiKitchen_265.bin'),
  '266': require('../assets/emojiKitchenChunks/emojiKitchen_266.bin'),
  '267': require('../assets/emojiKitchenChunks/emojiKitchen_267.bin'),
  '269': require('../assets/emojiKitchenChunks/emojiKitchen_269.bin'),
  '26a': require('../assets/emojiKitchenChunks/emojiKitchen_26a.bin'),
  '26b': require('../assets/emojiKitchenChunks/emojiKitchen_26b.bin'),
  '26c': require('../assets/emojiKitchenChunks/emojiKitchen_26c.bin'),
  '26d': require('../assets/emojiKitchenChunks/emojiKitchen_26d.bin'),
  '26f': require('../assets/emojiKitchenChunks/emojiKitchen_26f.bin'),
  '270': require('../assets/emojiKitchenChunks/emojiKitchen_270.bin'),
  '271': require('../assets/emojiKitchenChunks/emojiKitchen_271.bin'),
  '275': require('../assets/emojiKitchenChunks/emojiKitchen_275.bin'),
  '276': require('../assets/emojiKitchenChunks/emojiKitchen_276.bin'),
  '2b5': require('../assets/emojiKitchenChunks/emojiKitchen_2b5.bin'),
  'a9-': require('../assets/emojiKitchenChunks/emojiKitchen_a9-.bin'),
  'ae-': require('../assets/emojiKitchenChunks/emojiKitchen_ae-.bin'),
};

async function loadEmojiKitchenChunk(firstCodepoint: string): Promise<any> {
  const prefix = firstCodepoint.substring(0, 3).toLowerCase();
  if (chunkCache[prefix]) return chunkCache[prefix];

  try {
    const moduleRef = CHUNK_MAP[prefix];
    if (!moduleRef) {
      // If no chunk exists for this prefix, return empty
      return { data: {} };
    }

    const asset = Asset.fromModule(moduleRef);
    await asset.downloadAsync();
    const metadataString = await FileSystem.readAsStringAsync(asset.localUri || asset.uri);
    const parsed = JSON.parse(metadataString);
    chunkCache[prefix] = parsed;
    return parsed;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[EmojiKitchen] Failed to load chunk for prefix ${prefix}.`, e);
    return { data: {} };
  }
}

function toCodepoint(emoji: string) {
  return Array.from(emoji)
    .map((c) => c.codePointAt(0)?.toString(16))
    .filter(Boolean)
    .join('-');
}

function stripVS16(codepoint: string) {
  return codepoint.replace(/-fe0f/g, '').replace(/^fe0f-?/, '');
}

// Helper to format custom emoji names
export function formatCustomEmojiName(name: string): string {
  return name
    .replace(/[_-]/g, ' ') // underscores/dashes to spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to space
    .replace(/(\d+)/g, ' $1') // add space before numbers
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export type EmojiKitchenMash = {
  imageUrl: string;
  description: string;
};

export async function fetchEmojiKitchenMash(baseEmoji: string, blendEmoji: string): Promise<EmojiKitchenMash> {
  const first = normalizeEmoji(baseEmoji);
  const second = normalizeEmoji(blendEmoji);

  if (!first || !second) {
    throw new Error('Choose two emoji to blend.');
  }

  const leftCodepoint = toCodepoint(first);
  const rightCodepoint = toCodepoint(second);

  console.log(`[EmojiKitchen] Blending ${first} (${leftCodepoint}) + ${second} (${rightCodepoint})`);

  let combo: any | undefined = undefined;

  // Helper to try finding a combo in a chunk
  const findCombo = (chunkData: any, l: string, r: string) => {
    if (chunkData?.[l]?.combinations?.[r]?.length) {
      return chunkData[l].combinations[r][0];
    }
    return null;
  };

  // Load chunks based on left and right codepoints
  // We try both original and stripped versions to handle variation selectors
  const leftChunk = await loadEmojiKitchenChunk(leftCodepoint);
  const rightChunk = await loadEmojiKitchenChunk(rightCodepoint);

  const l = leftCodepoint;
  const r = rightCodepoint;
  const lStrip = stripVS16(l);
  const rStrip = stripVS16(r);

  // Try 1: Exact match
  if (leftChunk.data) combo = findCombo(leftChunk.data, l, r);
  if (!combo && rightChunk.data) combo = findCombo(rightChunk.data, r, l);

  // Try 2: Stripped match (if different)
  if (!combo && (l !== lStrip || r !== rStrip)) {
    // We might need to load chunks for stripped versions if prefixes differ
    const leftChunkStrip = l.substring(0, 3) === lStrip.substring(0, 3) ? leftChunk : await loadEmojiKitchenChunk(lStrip);
    const rightChunkStrip = r.substring(0, 3) === rStrip.substring(0, 3) ? rightChunk : await loadEmojiKitchenChunk(rStrip);

    if (leftChunkStrip.data) combo = findCombo(leftChunkStrip.data, lStrip, rStrip);
    if (!combo && rightChunkStrip.data) combo = findCombo(rightChunkStrip.data, rStrip, lStrip);
    
    // Try 3: Mixed (one stripped, one not - rare but possible)
    if (!combo && leftChunkStrip.data) combo = findCombo(leftChunkStrip.data, lStrip, r);
    if (!combo && leftChunk.data) combo = findCombo(leftChunk.data, l, rStrip);
  }

  if (!combo) {
    throw new Error('No Emoji Kitchen mashup for those picks.');
  }

  return {
    imageUrl: combo.gStaticUrl,
    description: combo.alt || `${first} + ${second}`,
  };
}

export async function isEmojiKitchenSupported(emoji: string): Promise<boolean> {
  const cp = toCodepoint(normalizeEmoji(emoji));
  const chunk = await loadEmojiKitchenChunk(cp);
  return Boolean(chunk.data?.[cp]);
}

function fromCodepoint(codepoint: string): string {
  try {
    return String.fromCodePoint(...codepoint.split('-').map(hex => parseInt(hex, 16)));
  } catch {
    return '';
  }
}

export async function getRandomCompatibleEmoji(baseEmoji: string): Promise<string | null> {
  const normalized = normalizeEmoji(baseEmoji);
  if (!normalized) return null;

  const cp = toCodepoint(normalized);
  const cpStrip = stripVS16(cp);

  // Load chunk for base emoji
  let chunk = await loadEmojiKitchenChunk(cp);
  let data = chunk.data?.[cp];

  // If not found, try stripped version
  if (!data && cp !== cpStrip) {
    chunk = await loadEmojiKitchenChunk(cpStrip);
    data = chunk.data?.[cpStrip];
  }

  if (!data || !data.combinations) return null;

  const keys = Object.keys(data.combinations);
  if (keys.length === 0) return null;

  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return fromCodepoint(randomKey);
}
