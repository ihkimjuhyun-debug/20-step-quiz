// /api/get-word.js  — OpenAI 버전
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const KEY = (process.env.OPENAI_API_KEY ?? '').replace(/["'\r\n\t ]/g, '');

  if (!KEY) return res.status(500).json({ error: '[MISSING] OPENAI_API_KEY 환경변수가 없습니다.' });
  if (!KEY.startsWith('sk-')) return res.status(500).json({ error: `[FORMAT] 키 형식 오류: "${KEY.slice(0,10)}..."` });

  const { lang = 'en' } = req.body;
  const prompt = lang === 'ko'
    ? '스무고개용 단어 하나. 동물/음식/사물/장소/유명인 중 랜덤. JSON만: {"word":"고양이","category":"동물"}'
    : 'One word for 20 Questions. Random: animal,food,object,place,famous person. JSON only: {"word":"elephant","category":"animal"}';

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        messages: [
          { role: 'system', content: 'Return ONLY a valid JSON object. No markdown, no extra text.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); return res.status(r.status).json({ error: e.error?.message ?? `OpenAI HTTP ${r.status}` }); }
    const data = await r.json();
    const text = data.choices[0].message.content ?? '';
    const match = text.match(/\{[^}]+\}/);
    if (!match) throw new Error('JSON 파싱 실패: ' + text.slice(0,60));
    return res.status(200).json(JSON.parse(match[0]));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
