export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const API_KEY = (process.env.ANTHROPIC_API_KEY || '').replace(/["'\r\n\t\s]/g, '');

  if (!API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 없습니다. Vercel → Settings → Environment Variables 확인' });
  }

  const { lang = 'en' } = req.body;

  const content = lang === 'ko'
    ? '스무고개용 랜덤 단어 하나 골라줘. 동물/음식/사물/장소/유명인 중 하나. 반드시 JSON만: {"word":"고양이","category":"동물"}'
    : 'Pick one random word for 20 Questions. Animal, food, object, place, or famous person. JSON only: {"word":"elephant","category":"animal"}';

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
        max_tokens: 100,
        system: 'Return ONLY raw JSON. No markdown, no explanation, no extra text.',
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
