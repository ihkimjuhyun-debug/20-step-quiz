// /api/get-word.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const raw   = process.env.ANTHROPIC_API_KEY ?? '';
  const KEY   = raw.replace(/["'\r\n\t ]/g, '');

  if (!KEY)                     return res.status(500).json({ error: '[MISSING] ANTHROPIC_API_KEY 환경변수가 비어 있습니다.' });
  if (!KEY.startsWith('sk-ant-')) return res.status(500).json({ error: `[FORMAT]  키가 sk-ant-로 시작하지 않습니다: "${KEY.slice(0,10)}..."` });

  const { lang = 'en' } = req.body;

  const prompt = lang === 'ko'
    ? '스무고개용 단어 하나. 동물/음식/사물/장소/유명인 중 랜덤. JSON만: {"word":"고양이","category":"동물"}'
    : 'One word for 20 Questions. Random from: animal,food,object,place,famous person. JSON only: {"word":"elephant","category":"animal"}';

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
        max_tokens: 80,
        system: 'Return ONLY a valid JSON object. No markdown. No extra text.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: e.error?.message ?? `Anthropic HTTP ${r.status}` });
    }

    const data  = await r.json();
    const text  = data.content[0].text ?? '';
    const match = text.match(/\{[^}]+\}/);
    if (!match) throw new Error('AI가 JSON을 반환하지 않음: ' + text.slice(0, 60));

    return res.status(200).json(JSON.parse(match[0]));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
