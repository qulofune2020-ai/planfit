# 内容証明自動作成アプリ（Cloudflare Workers）

## 現状

4シナリオ（消滅時効の援用・不倫慰謝料請求・残業代パワハラ・クーリングオフ）の
ルールエンジン・テンプレート・AI文体調整・入力フォーム・Stripe決済まで実装済み。
本番稼働中: `https://planfit.qulofune2020.workers.dev/`

| ファイル | 役割 |
|---|---|
| src/rule_engine.js | 法的な当否判定（AI不使用、機械判定のみ） |
| src/templates.js | テンプレート差し込み＋AIガードレール用の保護対象事実の抽出 |
| src/ai_polish.js | AI文体調整＋ガードレール（事実ドリフト検証、フェイルセーフで原文採用） |
| src/pricing.js | シナリオ別料金（現在は全シナリオ¥1,980） |
| src/stripe.js | Stripe REST APIの薄いラッパー（Checkout Sessionの作成・取得） |
| src/index.js | Workersのエントリポイント。ルーティングと決済フローの接続 |
| public/index.html | 4シナリオ分の入力フォーム＋決済導線 |
| test/pipeline_test.js | 4シナリオ×判定分岐の結合テスト |
| test/checkout_test.js | 決済導線の単体・結合テスト（Stripeへの実通信はしない） |

## セットアップ
cd naiyo-syoumei-app
npm install
npm run dev # ローカル開発（.dev.vars に ANTHROPIC_API_KEY / STRIPE_SECRET_KEY を書く）
npm test # テスト
npm run deploy # デプロイ

本番シークレットは `wrangler secret put ANTHROPIC_API_KEY` / `wrangler secret put STRIPE_SECRET_KEY`
で登録する（絶対にコードやリポジトリにキーを書かないこと）。Cloudflareダッシュボードの
Settings → Variables and secrets からも登録できる。

## API

### `GET /api/health`
稼働確認。対応シナリオ一覧を返す。

### `GET /api/pricing`
シナリオ別の料金（円）と表示ラベルを返す。フォーム側の料金表示に使う。

### `POST /api/generate`（テスト・モック用）
`{ scenarioId, facts, senderName, recipientName, documentDate, useMock }` を受け取り、
決済なしで直接生成する。`useMock: true` ならAI APIを呼ばず原文をそのまま返す。
本番の一般利用者向けフローではなく、動作確認・デバッグ用のエンドポイント。
### `POST /api/checkout`
決済導線の入口。`{ scenarioId, facts, senderName, recipientName, documentDate, successUrl, cancelUrl }`
を受け取り、以下の順で処理する。

1. `successUrl` / `cancelUrl` が `ALLOWED_ORIGINS` に含まれるオリジンか検証する
   （オープンリダイレクト対策）。
2. `rule_engine.evaluateScenario()` で生成可否を**課金前に**判定する。ブロックされる案件
   （時効未成立・クーリングオフ期間超過等）には422を返し、Stripeには一切アクセスしない。
3. 問題なければ Stripe Checkout Session を作成する。入力内容（scenarioId・facts・共通項目）は
   Sessionの `metadata` に保存し、`{ checkoutUrl }` を返す。フロントエンドはこのURLへ遷移する。

### `GET /api/checkout/result?session_id=...`
Stripe Checkoutからの復帰後に呼ぶ。Stripe側でセッションを取得し `payment_status === "paid"` を
サーバー間で検証してから、保存しておいた `metadata` を使って実際に文書を生成する
（AI文体調整も実際に行う。`useMock` は使わない）。

支払い確認後に再判定した結果ブロックされた場合（法定期間の境界をまたいだ等の稀なケース）は
`needsRefund: true` を含めて返す。この場合の返金対応は現状手動（自動返金は未実装）。

## 料金

| シナリオ | 料金（税込） |
|---|---|
| 消滅時効の援用（貸金業者） | ¥1,980 |
| 不倫慰謝料請求 | ¥1,980 |
| 残業代・パワハラ・退職トラブル | ¥1,980 |
| 契約解除・クーリングオフ通知 | ¥1,980 |

`src/pricing.js` で変更できる。

## 設計原則（プロジェクト全体で厳守）

- 法的な当否判定はAIではなくルールベースで完結させる。
- AIの役割は文体調整のみ。事実・日付・金額・条文番号は変更させない。
- AI出力は必ずガードレール検証を通し、不一致なら原文採用（フェイルセーフ）。
- 証拠不十分なケースは断定表現を避け、協議申入れ文にトーンダウンする。
- 「交渉代行」「代理」を想起させる一人称表現は使わず、常に「書面作成支援」のフレームを維持する。
- 生成できない案件（時効未成立・期間超過等）には課金しない（ルール判定を決済より先に行う）。

## 未着手・今後の検討

- カスタムドメイン設定（`qulofune-office.jp`のCloudflare移管が必要なため保留中）
- 支払い済みだが後から生成不可と判明した場合の自動返金
- 奨学金・保証人・個人間借金シナリオ（需要未検証のため保留）
- DV・ストーカー関連シナリオ（安全性の観点から意図的にスコープ外）
- 弁護士法72条についての弁護士への正式相談
