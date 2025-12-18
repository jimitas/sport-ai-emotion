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
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return res.status(500).json({ error: 'APIキーが設定されていません' });
    }

    const prompt = `この人物の表情を「笑っている」「怒っている」「泣いている」「普通の状態」の4つのうち、最も近いもの1つだけで答えてください。もし判断できない場合は「不明」と答えてください。余計な解説は不要です。回答は必ず指定した単語のみにしてください。`;

    // Gemini APIへリクエスト
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: imageData } }
            ]
          }]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return res.status(response.status).json({
        error: 'Gemini APIエラー',
        details: errorText
      });
    }

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "不明";

    return res.status(200).json({ emotion: result });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      message: error.message
    });
  }
}
