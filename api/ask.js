// /api/ask.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const raw = process.env.ANTHROPIC_API_KEY ?? '';
  const KEY = raw.replace(/["'\r\n\t ]/g, '');

  if (!KEY)                     return res.status(500).json({ error: '[MISSING] ANTHROPIC_API_KEY 없음' });
  if (!KEY.startsWith('sk-ant-')) return res.status(500).json({ error: '[FORMAT] 키 형식 오류' });

  const { secretWord, secretCategory, question } = req.body ?? {};
  if (!secretWord || !question) return res.status(400).json({ error: 'secretWord and question required' });

  const system = `You are a 20 Questions host. Secret word: "${secretWord}" (${secretCategory}).
- Fix STT errors before answering (e.g. "is it double" → "edible").
- If player guesses the exact word: {"type":"guess","correct":true,"answer":"Correct! It's ${secretWord}!"}
- Wrong guess: {"type":"guess","correct":false,"answer":"Nope! Keep asking."}
- Yes/No question: {"type":"question","answer":"Yes, it is an animal."}
Return ONLY the JSON. No markdown.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 120,
        system,
        messages: [{ role: 'user', content: `Player: "${question}"` }]
      })
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: e.error?.message ?? `Anthropic HTTP ${r.status}` });
    }

    const data  = await r.json();
    const text  = data.content[0].text ?? '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('JSON 파싱 실패: ' + text.slice(0, 60));

    return res.status(200).json(JSON.parse(match[0]));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
