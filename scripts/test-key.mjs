import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error('No GEMINI_API_KEY in .env'); process.exit(1); }

console.log('Key prefix:', apiKey.slice(0,12) + '...' + apiKey.slice(-6));
console.log('Key length:', apiKey.length);
console.log('Starts with AIza:', apiKey.startsWith('AIza'));

const genai = new GoogleGenerativeAI(apiKey);

try {
  process.stdout.write('Testing gemini-1.5-flash... ');
  const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent('Say "ok"');
  console.log('✓ WORKS:', result.response.text().trim());
} catch(e) {
  console.log('✗ FULL ERROR:');
  console.error(e.message);
  console.error('Status:', e.status);
}
