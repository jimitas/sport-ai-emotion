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
    console.log('Request received');
    const { imageData } = req.body;

    if (!imageData) {
      console.error('No imageData in request');
      return res.status(400).json({ error: '画像データが必要です' });
    }

    console.log('Image data length:', imageData.length);

    // 環境変数からAPIキーを取得
    const apiKey = process.env.CLAUDE_API_KEY;

    if (!apiKey) {
      console.error('CLAUDE_API_KEY is not set');
      return res.status(500).json({ error: 'APIキーが設定されていません', debug: 'API key missing' });
    }

    console.log('API key exists:', apiKey.substring(0, 10) + '...');

    const prompt = `この人物の表情を「笑っている」「怒っている」「泣いている」「普通の状態」の4つのうち、最も近いもの1つだけで答えてください。もし判断できない場合は「不明」と答えてください。余計な解説は不要です。回答は必ず指定した単語のみにしてください。`;

    // Claude APIへリクエスト
    console.log('Sending request to Claude API...');
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
          max_tokens: 50,
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

    console.log('Claude API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return res.status(response.status).json({
        error: 'Claude APIエラー',
        details: errorText,
        status: response.status
      });
    }

    const data = await response.json();
    console.log('Claude API response:', JSON.stringify(data).substring(0, 200));
    const result = data.content?.[0]?.text?.trim() || "不明";

    console.log('Detected emotion:', result);
    return res.status(200).json({ emotion: result });

  } catch (error) {
    console.error('Caught error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      message: error.message,
      type: error.constructor.name
    });
  }
}
