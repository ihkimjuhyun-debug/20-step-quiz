// /api/ask.js  — OpenAI 버전
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const KEY = (process.env.OPENAI_API_KEY ?? '').replace(/["'\r\n\t ]/g, '');

  if (!KEY) return res.status(500).json({ error: '[MISSING] OPENAI_API_KEY 없음' });
  if (!KEY.startsWith('sk-')) return res.status(500).json({ error: '[FORMAT] 키 형식 오류' });

  const { secretWord, secretCategory, question } = req.body ?? {};
  if (!secretWord || !question) return res.status(400).json({ error: 'secretWord and question required' });

  const system = `You are a 20 Questions host. Secret word: "${secretWord}" (${secretCategory}).
- Auto-fix STT errors (e.g. "is it double" → "edible", "can you eight it" → "eat it").
- Correct guess: {"type":"guess","correct":true,"answer":"Correct! It's ${secretWord}!"}
- Wrong guess: {"type":"guess","correct":false,"answer":"Nope! Keep asking."}
- Yes/No question: {"type":"question","answer":"Yes, it is an animal."}
Return ONLY the JSON object. No markdown.`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 120,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Player: "${question}"` }
        ]
      })
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); return res.status(r.status).json({ error: e.error?.message ?? `OpenAI HTTP ${r.status}` }); }
    const data = await r.json();
    const text = data.choices[0].message.content ?? '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('JSON 파싱 실패: ' + text.slice(0,60));
    return res.status(200).json(JSON.parse(match[0]));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
