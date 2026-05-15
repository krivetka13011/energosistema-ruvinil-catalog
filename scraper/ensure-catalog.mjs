import fs from "fs/promises";
import path from "path";

const target = path.resolve("src/data/catalog.json");

async function main() {
  try {
    await fs.access(target);
  } catch {
    const sample = path.resolve("src/data/catalog.sample.json");
    await fs.copyFile(sample, target);
    console.warn(`[ensure-catalog] Created ${target} from catalog.sample.json — run npm run scrape for full data.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
