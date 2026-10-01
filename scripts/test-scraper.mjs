import { scrapePublicPage } from '../src/scraper.js';
console.log('Testing scraper on LinkedIn...');
try {
  const r = await scrapePublicPage('https://www.linkedin.com/in/andrewyng/');
  console.log('Success! Text length:', r.text.length);
  console.log('Preview:', r.text.slice(0, 800));
} catch(e) {
  console.error('Error:', e.message);
}
