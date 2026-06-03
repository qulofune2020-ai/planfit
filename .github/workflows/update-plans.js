// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PlanFit 自動更新スクリプト
// Googleシート → plans_data.json → index.html を自動更新
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { readFileSync, writeFileSync } from 'fs';
import https from 'https';

const SHEET_ID  = process.env.SHEET_ID;
const API_KEY   = process.env.SHEET_API_KEY;
const RANGE     = 'プランデータ!A2:P100'; // シート名とデータ範囲

// ── Googleシートからデータ取得 ─────────────────────────
function fetchSheet() {
  return new Promise((resolve, reject) => {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ── シートの行をプランオブジェクトに変換 ────────────────
// 列順: A=id, B=carrier, C=name, D=price, E=data, F=callFree,
//       G=callPer30, H=esim, I=line, J=url, K=strengths, L=cautions,
//       M=tags, N=priceNote, O=callNote, P=active
function rowToPlan(row) {
  if (!row[0] || row[15] === 'FALSE') return null; // 空行・非表示はスキップ
  return {
    id:        row[0]  || '',
    carrier:   row[1]  || '',
    name:      row[2]  || '',
    price:     Number(row[3])  || 0,
    data:      Number(row[4])  || 0,
    callFree:  row[5]  === 'TRUE',
    callPer30: Number(row[6])  || 0,
    esim:      row[7]  === 'TRUE',
    line:      row[8]  || 'docomo',
    url:       row[9]  || '',
    strengths: row[10] ? row[10].split('|') : [],
    cautions:  row[11] ? row[11].split('|') : [],
    tags:      row[12] ? row[12].split('|') : [],
    priceNote: row[13] || '',
    callNote:  row[14] || '',
  };
}

// ── index.html の PLANSデータを書き換え ─────────────────
function updateHTML(plans, updatedDate) {
  let html = readFileSync('index.html', 'utf-8');

  // PLANS配列を新しいデータで置換
  const plansJSON = JSON.stringify(plans, null, 2)
    .replace(/"([^"]+)":/g, "$1:") // JSONキーをJS形式に
    .replace(/"/g, "'");            // ダブルクォートをシングルに

  html = html.replace(
    /const PLANS = \[[\s\S]*?\];/,
    `const PLANS = ${plansJSON};`
  );

  // 更新日を書き換え
  html = html.replace(
    /プラン情報最終更新：[\d年月日]+/,
    `プラン情報最終更新：${updatedDate}`
  );

  writeFileSync('index.html', html, 'utf-8');
  console.log(`✅ index.html 更新完了（${plans.length}プラン）`);
}

// ── plans_data.json を更新 ───────────────────────────────
function updateJSON(plans, updatedDate) {
  const data = { updated: updatedDate, plans };
  writeFileSync('plans_data.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log('✅ plans_data.json 更新完了');
}

// ── メイン処理 ────────────────────────────────────────────
async function main() {
  console.log('🔄 Googleシートからプランデータを取得中...');

  let plans;
  const today = new Date();
  const updatedDate = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;

  if (SHEET_ID && API_KEY) {
    // Googleシートから取得
    const sheet = await fetchSheet();
    const rows  = sheet.values || [];
    plans = rows.map(rowToPlan).filter(Boolean);
    console.log(`📊 ${plans.length}件のプランデータを取得`);
  } else {
    // ローカルテスト用：既存のJSONを使用
    console.log('⚠️  シートID未設定 → plans_data.jsonを使用');
    const existing = JSON.parse(readFileSync('plans_data.json', 'utf-8'));
    plans = existing.plans;
  }

  updateHTML(plans, updatedDate);
  updateJSON(plans, updatedDate);
  console.log(`🎉 完了 — ${updatedDate} 版に更新しました`);
}

main().catch(err => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
