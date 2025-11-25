// Node.js script to split emojiKitchenMetadata.json by first letter of the codepoint key
// Place this in your project root and run with: node scripts/split-emoji-metadata.js

const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.join(__dirname, '../lettuce-clicker/assets/emojiKitchenMetadata.json');
const OUTPUT_DIR = path.join(__dirname, '../lettuce-clicker/assets/emojiKitchenChunks');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

const metadata = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
const { data } = metadata;

const buckets = {};
for (const key of Object.keys(data)) {
  const firstLetter = key[0].toLowerCase();
  if (!buckets[firstLetter]) buckets[firstLetter] = {};
  buckets[firstLetter][key] = data[key];
}

for (const letter of Object.keys(buckets)) {
  const outPath = path.join(OUTPUT_DIR, `emojiKitchen_${letter}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ data: buckets[letter] }));
  console.log(`Wrote ${outPath}`);
}

console.log('Done splitting emojiKitchenMetadata.json!');
