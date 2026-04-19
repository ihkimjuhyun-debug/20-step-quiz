// /api/debug.js
// 브라우저에서 직접 https://your-app.vercel.app/api/debug 로 접속하면 진단 결과가 보입니다.
// 확인 후 이 파일은 삭제하세요.
export default async function handler(req, res) {
  const raw   = process.env.ANTHROPIC_API_KEY ?? '';
  const clean = raw.replace(/["'\r\n\t ]/g, '');

  const info = {
    '1_env_exists':    raw.length > 0,
    '2_clean_length':  clean.length,
    '3_first_14_chars': clean.slice(0, 14) + '...',
    '4_valid_prefix':  clean.startsWith('sk-ant-'),
    '5_had_quotes':    raw.includes('"') || raw.includes("'"),
    '6_had_spaces':    /[ \t]/.test(raw),
    '7_had_newline':   /[\r\n]/.test(raw),
  };

  // 실제 Anthropic 호출 테스트
  let test = 'skipped (key missing or invalid format)';
  if (clean.startsWith('sk-ant-')) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': clean,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'hi' }]
        })
      });
      const body = await r.json().catch(() => ({}));
      test = r.ok
        ? '✅ SUCCESS — API key works!'
        : `❌ FAILED (HTTP ${r.status}): ${body.error?.message ?? 'unknown'}`;
    } catch (e) {
      test = `❌ NETWORK ERROR: ${e.message}`;
    }
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ ...info, '8_api_test': test });
}
