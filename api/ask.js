export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const API_KEY = (process.env.ANTHROPIC_API_KEY || '').replace(/["'\r\n\t\s]/g, '');

  if (!API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 없습니다.' });
  }

  const { secretWord, secretCategory, question } = req.body;
  if (!secretWord || !question) {
    return res.status(400).json({ error: 'secretWord and question required' });
  }

  const system = `You are a 20 Questions game host. The secret word is "${secretWord}" (category: ${secretCategory}).
Rules:
- Auto-correct STT errors (e.g. "is it double" → "edible", "can you eight it" → "eat it").
- If the player directly guesses the secret word correctly, set type to "guess" and correct to true.
- If it is a wrong guess, set type to "guess" and correct to false.
- For yes/no questions, answer naturally in 1-2 English sentences.
- Never reveal the word unless the guess is correct.
Return ONLY valid JSON. No markdown.`;

  const content = `Player question: "${question}"
JSON format:
For yes/no: {"type":"question","answer":"Yes, it is an animal."}
For correct guess: {"type":"guess","correct":true,"answer":"Correct! It is a ${secretWord}!"}
For wrong guess: {"type":"guess","correct":false,"answer":"No, that's not right. Keep trying!"}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        system,
        messages: [{ role: 'user', content }]
      })
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: e.error?.message || `Anthropic HTTP ${r.status}` });
    }

    const data = await r.json();
    const text = data.content[0].text;
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('JSON 없음: ' + text.slice(0, 80));

    return res.status(200).json(JSON.parse(match[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
