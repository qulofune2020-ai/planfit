# 内容証明自動作成アプリ（Cloudflare Workers）

## 現状

このディレクトリは、引き継ぎ指示書に基づくプロジェクト整理と Cloudflare Workers の
デプロイ環境セットアップ分のみを進めた状態。前チャットで動作確認済みの本体ロジック
（ルールエンジン・テンプレート）はまだ移植されていない（このセッションからは
参照できないため）。

| ファイル | 状態 |
|---|---|
| src/rule_engine.js | プレースホルダー。NOT_IMPLEMENTED を投げる。要貼り付け |
| src/templates.js | プレースホルダー。NOT_IMPLEMENTED を投げる。要貼り付け |
| src/ai_polish.js | 実装済み。AI文体調整＋ガードレール（事実ドリフト検証）。fetch経由でAnthropic Messages APIを直接呼ぶ |
| test/pipeline_test.js | naiyo_syoumei_integration_test.js は統合済み（廃止）。現状は ai_polish.js のテストのみ |
| src/index.js | Workers のエントリポイント。POST /api/generate で3層（ルール→テンプレ→AI調整）を接続 |

## 次にやること

1. src/rule_engine.js と src/templates.js に、前チャットで検証済みの本体コードを貼り付ける。
2. test/pipeline_test.js に4シナリオ分の結合テストを追加する。
3. wrangler secret put ANTHROPIC_API_KEY で本番シークレットを登録する（絶対にコードやリポジトリにAPIキーを書かないこと）。
4. npm run dev でローカル確認する（.dev.vars に ANTHROPIC_API_KEY を書く。gitignore済み）。
5. useMock ではなく実APIで POST /api/generate を1回叩き、正常系・ガードレール発動系の両方を確認する。

## セットアップ

- cd naiyo-syoumei-app
- npm install
- npm run dev （ローカル開発）
- npm test （テスト）
- npx wrangler secret put ANTHROPIC_API_KEY （本番シークレット登録、初回のみ）
- npm run deploy （デプロイ）

## API

GET /api/health は稼働確認用で、対応シナリオ一覧を返す。

POST /api/generate は scenarioId、facts、useMock を受け取り、以下の順で処理する。

1. rule_engine.evaluateScenario() — 法的な当否判定（AI不使用、機械判定のみ）
2. templates.buildDocument() — 確定事実をテンプレートに差し込み
3. ai_polish.polishText() — AIによる文体調整からガードレール検証（事実の数字が一致しなければAI出力を破棄し原文を採用するフェイルセーフ）

eligible が false（例: クーリングオフ期間超過）の場合は422を返し、生成をブロックする。

## 設計原則（プロジェクト全体で厳守）

- 法的な当否判定はAIではなくルールベースで完結させる。
- AIの役割は文体調整のみ。事実・日付・金額・条文番号は変更させない。
- AI出力は必ずガードレール検証を通し、不一致なら原文採用（フェイルセーフ）。
- 証拠不十分なケースは断定表現を避け、協議申入れ文にトーンダウンする。
- 「交渉代行」「代理」を想起させる一人称表現は使わず、常に「書面作成支援」のフレームを維持する。
- 

