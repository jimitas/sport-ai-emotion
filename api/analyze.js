export default async function handler(req, res) {
  // CORSヘッダーを設定（必要に応じて）
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // プリフライトリクエストへの対応
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POSTメソッドのみ許可
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: '画像データが必要です' });
    }

    // 環境変数からAPIキーを取得
    const apiKey = process.env.CLAUDE_API_KEY;

    if (!apiKey) {
      console.error('CLAUDE_API_KEY is not set');
      return res.status(500).json({ error: 'APIキーが設定されていません' });
    }

    const prompt = `この画像の人物の表情を詳しく観察して、以下の4つの感情のうち、最も当てはまるものを1つだけ選んでください：

1. 「笑っている」- 口角が上がっている、目が細くなっている、笑顔
2. 「怒っている」- 眉間にシワ、眉が下がっている、口が一文字、険しい表情
3. 「泣いている」- 目が潤んでいる、眉が下がっている、悲しい表情、口角が下がっている
4. 「普通の状態」- 無表情、リラックスしている、特に感情が表れていない

顔が見えない、または判断できない場合のみ「不明」と答えてください。

回答は必ず上記の単語のみで答え、説明文は一切不要です。`;

    // Claude APIへリクエスト
    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageData
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return res.status(response.status).json({
        error: 'Claude APIエラー',
        details: errorText
      });
    }

    const data = await response.json();
    const result = data.content?.[0]?.text?.trim() || "不明";

    return res.status(200).json({ emotion: result });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      message: error.message
    });
  }
}
