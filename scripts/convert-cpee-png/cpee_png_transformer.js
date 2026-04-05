import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GRAPHS_DIR = path.join(__dirname, 'graphs');

const DEFAULT_URL = 'https://cpee.org/flow/graph.html?monitor=https://cpee.org/flow/engine/8746/';

async function captureCpeeGraph(url = DEFAULT_URL) {
  const engineId = url.match(/engine\/(\d+)/)?.[1] ?? 'unknown';
  const outputPath = path.join(GRAPHS_DIR, `cpee_graph_${engineId}.png`);

  console.log(`Capturing CPEE graph for engine ${engineId}...`);
  console.log(`URL: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for the SVG graph to render
    await page.waitForSelector('svg', { timeout: 15000 });
    // Extra buffer for dynamic rendering to settle
    await new Promise(r => setTimeout(r, 3000));

    const svgElement = await page.$('svg');
    if (!svgElement) {
      throw new Error('No SVG element found on the page');
    }

    const boundingBox = await svgElement.boundingBox();
    if (!boundingBox) {
      throw new Error('Could not get bounding box of SVG element');
    }

    // Clip to the SVG area with some padding
    const padding = 10;
    await page.screenshot({
      path: outputPath,
      clip: {
        x: Math.max(0, boundingBox.x - padding),
        y: Math.max(0, boundingBox.y - padding),
        width: boundingBox.width + padding * 2,
        height: boundingBox.height + padding * 2,
      },
      omitBackground: true,
    });

    console.log(`PNG saved to: ${outputPath}`);
    console.log(`Dimensions: ${Math.round(boundingBox.width)}x${Math.round(boundingBox.height)}`);
  } finally {
    await browser.close();
  }
}

const url = process.argv[2] || DEFAULT_URL;
captureCpeeGraph(url).catch(err => {
  console.error('Failed to capture graph:', err.message);
  process.exit(1);
});
