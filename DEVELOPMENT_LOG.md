# AI表情分析アプリ 開発ログ

## プロジェクト概要

### 目的
体験授業で使用する、スポーツとAIをテーマにした画像認識アプリケーション。カメラの前で表情を作ると、AIが「笑っている」「怒っている」「泣いている」「普通の状態」を判定する。

### 対象ユーザー
- 体験授業の生徒（50人規模）
- 授業は1回きり

### 要件
- カメラで表情を撮影
- AIが4種類の感情を判定（笑・怒・泣・普通）
- 結果を色とテキストで表示
- HTML/CSS/JavaScriptで実装
- GitHub→Vercelでデプロイ
- 50人が同時使用可能であること

---

## 技術スタック

### フロントエンド
- HTML5
- Tailwind CSS (CDN)
- Vanilla JavaScript
- MediaDevices API (カメラアクセス)
- Canvas API (画像キャプチャ)

### バックエンド
- Vercel Serverless Functions
- Node.js (ES Modules)

### AI API
- **当初**: Google Gemini API（無料版）
- **最終**: Claude API (Haiku 3.5)
  - 変更理由: Gemini無料版は10 RPM、Claude APIは50 RPMで50人同時使用に対応可能

### インフラ
- GitHub (リポジトリ)
- Vercel (ホスティング・デプロイ)

---

## 開発経緯

### フェーズ1: 初期実装（Gemini API版）

#### 状況
- ユーザーがGeminiでプロンプトを使ってアプリを生成
- 生成されたコードは、フロントエンドから直接Gemini APIを呼び出す実装
- APIキーがクライアントサイドに露出する設計

#### 問題点
1. **セキュリティリスク**: APIキーがブラウザに露出
2. **スケーラビリティ**: 50人同時使用に対応できない（10 RPM制限）
3. **コスト**: 無料枠が不十分

#### 初期コード構造
```
sport-ai-emotion/
└── index.html (Gemini API直接呼び出し、APIキー露出)
```

---

### フェーズ2: セキュアなバックエンドAPI実装

#### 実装内容
Vercel Serverless Functionsを使った3層アーキテクチャに変更

```
ブラウザ → Vercel API (/api/analyze) → Gemini API
```

#### 追加ファイル
1. **api/analyze.js**: Serverless Function
   - 画像データを受信
   - 環境変数からAPIキーを取得
   - Gemini APIに転送
   - 結果を返す

2. **.env.example**: 環境変数のテンプレート
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. **README.md**: デプロイ手順

#### コード変更
- `index.html`: APIキー削除、`/api/analyze`へのfetchに変更

#### コミット
```bash
git commit -m "Add secure backend API for emotion analysis"
```

---

### フェーズ3: APIの切り替え（Gemini → Claude）

#### 課題の発見
Gemini API無料版の制限を調査した結果：
- **レート制限**: 10 requests/minute
- **日次制限**: 250 requests/day（一部20に削減）
- **結論**: 50人の同時使用は不可能

#### 解決策の検討

| API | 無料枠 | RPM | コスト（50人×3回） | 採用判断 |
|-----|--------|-----|-------------------|----------|
| Gemini (Free) | 無制限 | 10 | 無料 | ❌ RPM不足 |
| Claude API | $5クレジット | 50 | $0.18 (27円) | ✅ 採用 |
| Azure Face API | 30,000/月 | 不明 | 無料 | 保留 |

#### Claude API実装

**変更ファイル**: `api/analyze.js`

**主な変更点**:
```javascript
// Before: Gemini API
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
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

// After: Claude API
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
```

**環境変数の変更**:
- `GEMINI_API_KEY` → `CLAUDE_API_KEY`

#### コミット
```bash
git commit -m "Switch from Gemini API to Claude API for better scalability"
```

---

### フェーズ4: デプロイとトラブルシューティング

#### 問題1: 404 Error - `/api/analyze` が見つからない

**エラーメッセージ**:
```
Failed to load resource: the server responded with a status of 404
```

**原因**: Vercelの設定ファイル不足
- ES Modules (`export default`) を使うには `package.json` が必要
- Serverless Functionsの設定に `vercel.json` が必要

**解決策**:

1. **package.json** 作成
```json
{
  "type": "module",
  "dependencies": {}
}
```

2. **vercel.json** 作成
```json
{
  "functions": {
    "api/**/*.js": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

#### 問題2: 500 Error - APIキーが設定されていない

**エラーログ**:
```
CLAUDE_API_KEY is not set
```

**原因**:
1. Vercelの環境変数が未設定
2. **環境変数名のタイポ**: `CLAUDE_APY_KEY` (誤) → `CLAUDE_API_KEY` (正)

**解決手順**:
1. Vercel Dashboard → Settings → Environment Variables
2. 正しい名前で環境変数を追加
   - Key: `CLAUDE_API_KEY`
   - Value: `sk-ant-...`
   - Environment: Production, Preview, Development
3. 再デプロイ（必須）

#### 問題3: APIキーの順序ミス

**状況**: ユーザーがClaude APIキーを**支払い情報登録前**に作成していた

**原因**: Anthropicは支払い情報登録前のAPIキーを無効化する仕様

**解決策**:
1. 支払い情報を登録（$5クレジット付与）
2. 新しいAPIキーを作成
3. Vercelの環境変数を更新
4. 再デプロイ

---

### フェーズ5: UX改善

#### 改善1: 表情判定精度の向上

**変更内容**:
1. **プロンプトの詳細化**
```javascript
// Before
const prompt = `この人物の表情を「笑っている」「怒っている」「泣いている」「普通の状態」の4つのうち、最も近いもの1つだけで答えてください。`;

// After
const prompt = `この画像の人物の表情を詳しく観察して、以下の4つの感情のうち、最も当てはまるものを1つだけ選んでください：

1. 「笑っている」- 口角が上がっている、目が細くなっている、笑顔
2. 「怒っている」- 眉間にシワ、眉が下がっている、口が一文字、険しい表情
3. 「泣いている」- 目が潤んでいる、眉が下がっている、悲しい表情、口角が下がっている
4. 「普通の状態」- 無表情、リラックスしている、特に感情が表れていない

顔が見えない、または判断できない場合のみ「不明」と答えてください。

回答は必ず上記の単語のみで答え、説明文は一切不要です。`;
```

2. **max_tokens増加**: 50 → 100

#### 改善2: 処理ステップの可視化

**目的**: 生徒がAIの処理過程を理解できるようにする

**実装内容**:

HTML追加:
```html
<span id="loadingStep" class="text-white text-base font-bold mb-1">処理中...</span>
<span id="loadingDetail" class="text-white text-xs opacity-90">しばらくお待ちください</span>
```

JavaScript実装:
```javascript
// ステップ1: 画像をキャプチャ
updateLoadingMessage('📸 画像をキャプチャしています...', 'カメラから表情の写真を取得中');
await new Promise(resolve => setTimeout(resolve, 300));

// ステップ2: AIサーバーに送信
updateLoadingMessage('🚀 AIサーバーに送信中...', '画像データをクラウドに転送しています');
await new Promise(resolve => setTimeout(resolve, 300));

// ステップ3: AI分析
updateLoadingMessage('🤖 AIが表情を分析中...', 'Claude AIが顔の特徴を読み取っています');

// ステップ4: 結果を受信
updateLoadingMessage('✨ 結果を受信しました！', '判定結果を表示します');
await new Promise(resolve => setTimeout(resolve, 300));
```

**教育的効果**:
- 画像がクラウドに送信されることが分かる
- AIが分析していることが分かる
- 処理に複数のステップがあることが分かる

---

## 最終的なアーキテクチャ

### システム構成図

```
┌─────────────────┐
│   ブラウザ       │
│  (index.html)   │
│                 │
│  1. カメラ起動   │
│  2. 画像キャプチャ│
│  3. Base64変換  │
└────────┬────────┘
         │ POST /api/analyze
         │ { imageData: "..." }
         ▼
┌─────────────────┐
│ Vercel Function │
│ (api/analyze.js)│
│                 │
│ - 環境変数取得   │
│ - Claude API呼出│
└────────┬────────┘
         │
         │ POST https://api.anthropic.com/v1/messages
         │ headers: { x-api-key: "sk-ant-..." }
         │ body: { model, messages: [image, text] }
         ▼
┌─────────────────┐
│  Claude API     │
│   (Anthropic)   │
│                 │
│ - 画像を分析     │
│ - 表情を判定     │
└────────┬────────┘
         │
         │ { emotion: "笑っている" }
         ▼
┌─────────────────┐
│  ブラウザ        │
│  結果表示       │
│  (色+テキスト)  │
└─────────────────┘
```

### ファイル構成

```
sport-ai-emotion/
├── index.html              # フロントエンド（UI、カメラ、結果表示）
├── api/
│   └── analyze.js         # Serverless Function（Claude API呼出）
├── package.json           # ES Modules設定
├── vercel.json           # Vercel設定
├── .env.example          # 環境変数テンプレート
├── README.md             # デプロイ手順
└── DEVELOPMENT_LOG.md    # このファイル
```

### データフロー

1. **画像キャプチャ** (ブラウザ)
   - `getUserMedia()` でカメラアクセス
   - Canvas APIで画像を取得
   - Base64エンコード

2. **API呼び出し** (ブラウザ → Vercel)
   - `POST /api/analyze`
   - Body: `{ imageData: "base64string" }`

3. **Claude API転送** (Vercel → Anthropic)
   - 環境変数 `CLAUDE_API_KEY` を取得
   - Claude API (Haiku 3.5) に画像+プロンプトを送信

4. **AI分析** (Anthropic)
   - 画像を解析
   - 表情を判定（笑・怒・泣・普通・不明）

5. **結果返却** (Anthropic → Vercel → ブラウザ)
   - JSON: `{ emotion: "笑っている" }`
   - UI更新（背景色変更、テキスト表示）

---

## セキュリティ設計

### APIキー管理
- ❌ クライアントサイドに露出しない
- ✅ Vercelの環境変数で管理
- ✅ `.env.example` のみGitにコミット（実際のキーは除外）

### CORS設定
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
```

### データ保護
- 画像データは一時的な分析のみ
- サーバー側で保存しない
- Claude APIも保存しない（利用規約による）

---

## パフォーマンス最適化

### 画像圧縮
```javascript
canvas.toDataURL('image/jpeg', 0.8) // JPEG品質80%
```

### API選択
- Claude Haiku 3.5: 最速・最安のモデル
- max_tokens: 100（必要最小限）

### レート制限対応
- Claude API Tier 1: 50 RPM
- 50人同時使用可能

---

## コスト分析

### Claude API料金

| 項目 | 料金 |
|------|------|
| 入力トークン | $0.80 / 1M tokens |
| 出力トークン | $4.00 / 1M tokens |
| 画像1枚 | 約1,500トークン |

### 使用量試算

**授業1回（50人×3回）**:
- 総リクエスト数: 150回
- 総トークン数: 約225,000トークン
- **コスト: 約$0.18（27円）**

**無料クレジット**:
- 新規登録: $5
- 使用可能回数: 約4,000リクエスト
- **授業には十分**

---

## デプロイ手順

### 1. Claude APIキー取得

1. https://console.anthropic.com/ にアクセス
2. アカウント作成・メール認証
3. 支払い情報登録（$5クレジット付与）
4. API Keysページで「Create Key」
5. APIキーをコピー（`sk-ant-...`）

### 2. GitHubへプッシュ

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/jimitas/sport-ai-emotion.git
git push -u origin main
```

### 3. Vercelデプロイ

1. https://vercel.com にアクセス
2. GitHubリポジトリをインポート
3. Environment Variables設定:
   - Name: `CLAUDE_API_KEY`
   - Value: （取得したAPIキー）
   - Environment: Production, Preview, Development すべてチェック
4. Deploy

### 4. 動作確認

デプロイ完了後、URLにアクセスして動作確認

---

## トラブルシューティング履歴

### 問題と解決策一覧

| # | 問題 | 原因 | 解決策 | コミット |
|---|------|------|--------|---------|
| 1 | APIキー露出 | フロントエンドから直接API呼出 | Vercel Functionsで中継 | fb2f4e5 |
| 2 | 50人同時使用不可 | Gemini 10 RPM制限 | Claude API (50 RPM) に変更 | 37f6046 |
| 3 | 404 Error | Vercel設定ファイル不足 | package.json, vercel.json 追加 | cf94806 |
| 4 | 500 Error (APIキー未設定) | 環境変数未設定 | Vercelで環境変数追加 | - |
| 5 | 500 Error (APIキー無効) | 支払い登録前にキー作成 | 新しいキー再発行 | - |
| 6 | 環境変数名タイポ | `CLAUDE_APY_KEY` → `CLAUDE_API_KEY` | 正しい名前で再設定 | - |

---

## 学んだこと・知見

### 技術的学び

1. **Vercel Serverless Functionsの仕様**
   - ES Modules使用時は `package.json` に `"type": "module"` が必須
   - 環境変数変更後は必ず再デプロイが必要
   - `vercel.json` でFunction設定を明示すべき

2. **Claude APIの特性**
   - 汎用LLMで表情認識専用ではない
   - プロンプトの質で精度が変わる
   - Visionモデル選択が重要（Haiku 3.5が最適）

3. **APIキー管理**
   - クライアント露出は絶対NG
   - 環境変数管理が標準
   - 支払い情報登録のタイミングに注意

### UX設計の学び

1. **処理の可視化**
   - ローディング中のステップ表示が有効
   - 教育的効果も高い
   - 0.3秒の待機時間でメッセージが認識可能

2. **エラーハンドリング**
   - ユーザーフレンドリーなエラーメッセージ
   - デバッグログとユーザー向けメッセージの分離

### プロジェクト管理の学び

1. **段階的実装の重要性**
   - セキュリティ → スケーラビリティ → UX の順
   - 各段階でコミット・デプロイ・検証

2. **ドキュメンテーション**
   - README.mdでデプロイ手順を明記
   - トラブルシューティング項目を記載

---

## 今後の改善案

### 機能拡張

1. **他の判定への応用**
   - 姿勢判定（良い姿勢・猫背）
   - 集中度判定（集中・リラックス・眠そう）
   - 運動判定（ジャンプ・走る・静止）

2. **履歴機能**
   - 過去の判定結果を記録
   - グラフで可視化

3. **複数人対応**
   - 1画面で複数の顔を検出・判定

### 精度向上

1. **モデル変更**
   - Haiku → Sonnet (より高精度、コスト10倍)

2. **画質向上**
   - JPEG品質 0.8 → 0.9 or 1.0

3. **専用API検討**
   - Azure Face API (月30,000件無料)
   - 数値スコアでより詳細な分析

### コスト最適化

1. **キャッシング**
   - 同じ画像の再送信を防ぐ

2. **画像サイズ最適化**
   - リサイズしてトークン数削減

---

## 参考資料

### API ドキュメント
- [Claude API Documentation](https://docs.anthropic.com/en/api)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [MDN MediaDevices API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices)

### 料金情報
- [Claude API Pricing](https://www.anthropic.com/pricing#anthropic-api)
- [Azure Face API Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/face-api/)

---

## プロジェクト完了日

2025年12月18日

## Git履歴

```bash
d415af1 first commit
fb2f4e5 Add secure backend API for emotion analysis
37f6046 Switch from Gemini API to Claude API for better scalability
cf94806 Add Vercel configuration files to fix 404 error
d053c18 Add detailed debug logging to diagnose 500 error
7ebcc9d Improve emotion detection accuracy
c8273c2 Add step-by-step progress messages for better UX
```

## 最終デプロイURL

https://sport-ai-emotion.vercel.app

---

**このドキュメントは開発の全過程を記録したものです。他のAIによる分析や、今後の類似プロジェクトの参考資料として活用してください。**
