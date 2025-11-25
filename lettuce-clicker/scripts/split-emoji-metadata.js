const fs = require('fs');
const path = require('path');

const metadataPath = path.join(__dirname, '../emoji-kitchen-main/src/Components/metadata.json');
const outputDir = path.join(__dirname, '../assets/emojiKitchenChunks');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Reading metadata from:', metadataPath);
try {
  const rawData = fs.readFileSync(metadataPath, 'utf8');
  const metadata = JSON.parse(rawData);
  const data = metadata.data;

  const chunks = {};

  console.log('Processing keys...');
  Object.keys(data).forEach(key => {
    // key is like "1f600" or "1f600-fe0f"
    // Split by first 3 characters to keep chunk sizes smaller (e.g. "1f3", "1f4", "260")
    const prefix = key.substring(0, 3).toLowerCase();
    if (!chunks[prefix]) {
      chunks[prefix] = {};
    }
    chunks[prefix][key] = data[key];
  });

  console.log('Writing chunks...');
  Object.keys(chunks).forEach(char => {
    // We wrap it in the same structure as the original metadata for consistency
    const chunkData = {
      data: chunks[char]
    };
    // Use .bin extension so Metro treats it as an asset, not a module to bundle
    const outputPath = path.join(outputDir, `emojiKitchen_${char}.bin`);
    fs.writeFileSync(outputPath, JSON.stringify(chunkData));
    console.log(`Wrote chunk for '${char}' to ${outputPath}`);
  });

  console.log('Done splitting metadata.');
} catch (error) {
  console.error('Error processing metadata:', error);
  process.exit(1);
}
