# 内容証明自動作成アプリ（Cloudflare Workers）

## 現状

このディレクトリは、引き継ぎ指示書に基づくプロジェクト整理と Cloudflare Workers の
デプロイ環境セットアップ分のみを進めた状態。**前チャットで動作確認済みの本体ロジック
（ルールエンジン・テンプレート）はまだ移植されていない**（このセッションからは
参照できないため）。

| ファイル | 状態 |
|---|---|
| `src/rule_engine.js` | プレースホルダー。`NOT_IMPLEMENTED` を投げる。要貼り付け |
| `src/templates.js` | プレースホルダー。`NOT_IMPLEMENTED` を投げる。要貼り付け |
| `src/ai_polish.js` | **実装済み**。AI文体調整＋ガードレール（事実ドリフト検証）。fetch経由でAnthropic Messages APIを直接呼ぶ |
| `test/pipeline_test.js` | `naiyo_syoumei_integration_test.js` は統合済み（廃止）。現状は `ai_polish.js` のテストのみ |
| `src/index.js` | Workers のエントリポイント。`POST /api/generate` で3層（ルール→テンプレ→AI調整）を接続 |

## 次にやること

1. `src/rule_engine.js` と `src/templates.js` に、前チャットで検証済みの本体コードを
   貼り付ける（`evaluateScenario()` / `buildDocument()` のシグネチャは index.js 側と
   合わせてあるが、貼り付け後に実際のエクスポート名を要確認）。
2. `test/pipeline_test.js` に4シナリオ分の結合テストを追加する。
3. `wrangler secret put ANTHROPIC_API_KEY` で本番シークレットを登録する
   （**絶対にコードやリポジトリにAPIキーを書かないこと**）。
4. `npm run dev` でローカル確認（ローカルは `.dev.vars` に
   `ANTHROPIC_API_KEY=sk-...` を書く。`.gitignore` 済みなのでコミットされない）。
5. `useMock: true` ではなく実APIで `POST /api/generate` を1回叩き、
   正常系・ガードレール発動系の両方を確認する。

## セットアップ

```bash
cd naiyo-syoumei-app
npm install

# ローカル開発（.dev.vars に ANTHROPIC_API_KEY を書いてから）
npm run dev

# テスト
npm test

# 本番シークレット登録（初回のみ）
npx wrangler secret put ANTHROPIC_API_KEY

# デプロイ
npm run deploy
