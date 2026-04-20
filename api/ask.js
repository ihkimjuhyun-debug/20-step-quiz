// /api/ask.js — OpenAI 버전 (20Q 특화 스마트 파서)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const KEY = (process.env.OPENAI_API_KEY ?? '').replace(/["'\r\n\t ]/g, '');
  if (!KEY)                return res.status(500).json({ error: '[MISSING] OPENAI_API_KEY 없음' });
  if (!KEY.startsWith('sk-')) return res.status(500).json({ error: '[FORMAT] 키 형식 오류' });

  const { secretWord, secretCategory, question, history = [] } = req.body ?? {};
  if (!secretWord || !question) return res.status(400).json({ error: 'secretWord and question required' });

  // ─────────────────────────────────────────────────────────────────
  // SYSTEM PROMPT — 20Q 전용 스마트 해석 엔진
  //
  // 핵심 능력:
  // 1. STT 단어 오류 자동 교정 (음소 유사 오류)
  // 2. 불완전한 문장 자동 완성 (앞뒤가 잘린 경우)
  // 3. 20Q 전형적 패턴 인식 및 정규화
  // 4. 게임 내 전후 맥락으로 중의성 해소
  // ─────────────────────────────────────────────────────────────────
  const system = `You are an expert 20 Questions game host AND a smart speech-to-text interpreter.
Secret word: "${secretWord}" (category: ${secretCategory}).

## YOUR TWO JOBS

### JOB 1 — INTERPRET the player's input
The input may be garbled by speech recognition. Your job is to figure out what 20 Questions question they meant to ask.

**Common STT phonetic errors to auto-correct:**
- "double" → "edible" / "eatable"
- "eight it" / "eat eight" → "eat it"
- "where" → "wear"  
- "a lion" / "a lemon" / "a lion" → "an animal" / "alive"
- "is it a live" → "is it alive"
- "is it a meal" → "is it an animal"
- "can you drink it" / "is it drink" → "is it drinkable"
- "do you were it" → "can you wear it"
- "leaving thing" / "leaving" → "living thing"
- "manmade" / "man made" / "made by man" → "man-made"
- "in the sky" / "does it fly" → "can it fly"
- "does it have legs" / "has legs" → "does it have legs"
- Any partial question like "animal?" → "Is it an animal?"
- Any partial like "eat?" / "food?" → "Can you eat it?"
- Any partial like "alive?" / "living?" → "Is it alive?"
- Any partial like "big?" / "large?" / "small?" → "Is it big?"
- Any partial like "famous?" → "Is it a famous person?"
- Any partial like "outside?" / "outdoor?" → "Is it found outdoors?"

**Fragment reconstruction rules:**
- Single noun/adjective → "Is it [word]?"
- Single verb → "Can it [verb]?"
- "is it" at start with cut-off → complete the most sensible 20Q question
- Missing auxiliary verb → add appropriate "Is it / Can it / Does it / Can you"

### JOB 2 — ANSWER the reconstructed question

**Decision logic:**
1. If player is directly guessing the secret word (e.g. "Is it a cat?" when word is "cat", or just says the word): 
   → type "guess"
2. All other yes/no questions:
   → type "question", answer truthfully in 1 sentence

**Answer style:**
- Natural, conversational English
- 1 sentence max
- Never reveal the word unless correct guess
- Be consistent with facts (an elephant IS big, IS an animal, IS NOT edible, etc.)

## OUTPUT FORMAT (STRICT — JSON only, no markdown)
{
  "type": "question",
  "interpreted": "Can you eat it?",
  "answer": "No, you cannot eat it."
}
OR for a correct guess:
{
  "type": "guess",
  "correct": true,
  "interpreted": "Is it an elephant?",
  "answer": "Yes! Correct! It's a ${secretWord}! 🎉"
}
OR for a wrong guess:
{
  "type": "guess",
  "correct": false,
  "interpreted": "Is it a tiger?",
  "answer": "No, it's not a tiger. Keep asking!"
}`;

  // 이전 QA 기록을 컨텍스트로 제공 (일관성 유지)
  const historyMessages = history.slice(-6).flatMap(h => [
    { role: 'user',      content: `Player: "${h.q}"` },
    { role: 'assistant', content: JSON.stringify({ type: 'question', answer: h.a }) }
  ]);

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 150,
        temperature: 0.3,   // 낮은 temperature = 일관되고 예측 가능한 답변
        messages: [
          { role: 'system', content: system },
          ...historyMessages,
          { role: 'user', content: `Player: "${question}"` }
        ]
      })
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: e.error?.message ?? `OpenAI HTTP ${r.status}` });
    }

    const data  = await r.json();
    const text  = data.choices[0].message.content ?? '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('JSON 파싱 실패: ' + text.slice(0, 80));

    return res.status(200).json(JSON.parse(match[0]));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
