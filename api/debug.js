// /api/debug.js — 브라우저에서 /api/debug 로 접속하면 키 상태 확인
// 확인 후 이 파일은 삭제하세요
export default async function handler(req, res) {
  const raw   = process.env.OPENAI_API_KEY ?? '';
  const clean = raw.replace(/["'\r\n\t ]/g, '');
  const info  = {
    '1_env_exists':   raw.length > 0,
    '2_clean_length': clean.length,
    '3_first_10':     clean.slice(0,10) + '...',
    '4_valid_prefix': clean.startsWith('sk-'),
    '5_had_quotes':   raw.includes('"') || raw.includes("'"),
    '6_had_spaces':   /[ \t]/.test(raw),
  };
  let test = 'skipped';
  if (clean.startsWith('sk-')) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clean}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 5, messages: [{ role:'user', content:'hi' }] })
      });
      const body = await r.json().catch(()=>({}));
      test = r.ok ? '✅ SUCCESS — OpenAI key works!' : `❌ FAILED (${r.status}): ${body.error?.message ?? 'unknown'}`;
    } catch(e) { test = `❌ NETWORK ERROR: ${e.message}`; }
  }
  res.setHeader('Content-Type','application/json');
  return res.status(200).json({ ...info, '7_api_test': test });
}
