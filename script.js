// pokemon-candy-2025-11-19-a

// CSVデータ格納用
let pokeData = [];         // {name, growth}
let growthExpTable = {};   // growthType => {level: totalExp}
let candyList = [];        // [{name, xp}, ...]

const pokemonInput = document.getElementById('pokemonName');
const currentValueInput = document.getElementById('currentLevel');  // レベル or 経験値
const targetLevelInput = document.getElementById('targetLevel');
const calcBtn = document.getElementById('calcBtn');
const errorDiv = document.getElementById('error');

const resultCard = document.getElementById('resultCard');
const resultName = document.getElementById('resultName');
const resultGrowth = document.getElementById('resultGrowth');
const resultCurrentExp = document.getElementById('resultCurrentExp'); // 追加
const resultTargetExp = document.getElementById('resultTargetExp');   // 追加
const resultNeedExp = document.getElementById('resultNeedExp');
const resultCandies = document.getElementById('resultCandies');

const modeRadios = document.querySelectorAll('input[name="inputMode"]');

// --- CSVパーサ（超シンプル版：カンマ区切り前提）---
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((h, i) => {
      obj[h.trim()] = (cols[i] || '').trim();
    });
    return obj;
  });
  return { header, rows };
}

// --- データ読み込み ---
async function loadData() {
  try {
    const [pokeText, tableText, candyText] = await Promise.all([
      fetch('poke.csv').then(r => r.text()),
      fetch('table.csv').then(r => r.text()),
      fetch('candy.csv').then(r => r.text())
    ]);

    // けいけんアメ
    const candyCsv = parseCsv(candyText);
    candyList = candyCsv.rows.map(r => ({
      name: r['けいけんアメ'],
      xp: Number(r['経験値'])
    })).filter(c => !Number.isNaN(c.xp));
    // 大きい経験値順にソート
    candyList.sort((a, b) => b.xp - a.xp);

    // ポケモン & 経験値タイプ
    const pokeCsv = parseCsv(pokeText);
    pokeData = pokeCsv.rows.map(r => ({
      name: r['ポケモン'],
      growth: r['経験値タイプ']
    }));

    // datalist にポケモン名をセット
    const datalist = document.getElementById('pokemonList');
    pokeData.forEach(p => {
      const option = document.createElement('option');
      option.value = p.name;
      datalist.appendChild(option);
    });

    // 経験値テーブル
    const tableCsv = parseCsv(tableText);
    const headers = tableCsv.header;  // ['レベル', '60万タイプ', '80万タイプ', ...]
    tableCsv.rows.forEach(row => {
      const level = Number(row['レベル']);
      if (Number.isNaN(level)) return;
      headers.forEach(h => {
        if (h === 'レベル') return;
        const gx = (row[h] || '').trim();
        // もしまだカンマ付きの数値が紛れていても一応ケア
        const numStr = gx.replace(/,/g, '');
        const exp = numStr === '' ? NaN : Number(numStr);
        if (!growthExpTable[h]) {
          growthExpTable[h] = {};
        }
        if (!Number.isNaN(exp)) {
          growthExpTable[h][level] = exp;
        }
      });
    });

    // ボタンを有効化
    calcBtn.disabled = false;

  } catch (e) {
    console.error(e);
    errorDiv.textContent = 'CSVファイルの読み込みに失敗しました。ファイル名や配置場所を確認してください。';
  }
}

// --- ユーティリティ ---
function findPokemonByName(name) {
  return pokeData.find(p => p.name === name);
}

function getTotalExp(growthType, level) {
  const table = growthExpTable[growthType];
  if (!table) return null;
  return table[level] ?? null;
}

// 経験値から現在レベルを逆算
function getLevelFromExp(growthType, currentExp) {
  const table = growthExpTable[growthType];
  if (!table) return null;

  let level = 1;
  for (let lv = 1; lv <= 100; lv++) {
    const exp = table[lv];
    if (exp == null) break;
    if (exp <= currentExp) {
      level = lv;
    } else {
      break;
    }
  }
  return level;
}

// 必要経験値を満たすけいけんアメの簡易計算
function calcCandies(needExp) {
  if (needExp <= 0) return { total: 0, detail: [] };

  let remaining = needExp;
  const result = [];

  // 大きいアメから順番に使う（不足にならないよう、最後にXSで調整）
  candyList.forEach(c => {
    const count = Math.floor(remaining / c.xp);
    if (count > 0) {
      result.push({ name: c.name, xp: c.xp, count });
      remaining -= c.xp * count;
    }
  });

  // もしまだ残っているなら、最小のアメ（おそらくXS）を1個追加して不足を防ぐ
  if (remaining > 0 && candyList.length > 0) {
    const smallest = candyList[candyList.length - 1];
    result.push({ name: smallest.name, xp: smallest.xp, count: 1 });
    remaining = 0;
  }

  const totalExp = result.reduce((sum, c) => sum + c.xp * c.count, 0);
  return { total: totalExp, detail: result };
}

// --- メイン計算 ---
function handleCalc() {
  errorDiv.textContent = '';
  resultCard.style.display = 'none';

  const name = pokemonInput.value.trim();
  const tgtLv = Number(targetLevelInput.value);
  const checked = document.querySelector('input[name="inputMode"]:checked');
  const mode = checked ? checked.value : 'level';  // 'level' or 'exp'

  if (!name) {
    errorDiv.textContent = 'ポケモン名を入力してください。';
    return;
  }
  if (!Number.isInteger(tgtLv) || tgtLv < 1 || tgtLv > 100) {
    errorDiv.textContent = '上げたいレベルは1〜100の整数で入力してください。';
    return;
  }

  const p = findPokemonByName(name);
  if (!p) {
    errorDiv.textContent = 'そのポケモンはデータベースに見つかりません。名前の表記を確認してください。';
    return;
  }

  const growthType = p.growth;
  const tgtExp = getTotalExp(growthType, tgtLv);
  if (tgtExp == null) {
    errorDiv.textContent = '経験値テーブルに不足があります。このポケモンのレベルデータを確認してください。';
    return;
  }

  let curExp;
  let curLv;

  if (mode === 'level') {
    const curLvNum = Number(currentValueInput.value);
    if (!Number.isInteger(curLvNum) || curLvNum < 1 || curLvNum > 100) {
      errorDiv.textContent = '現在のレベルは1〜100の整数で入力してください。';
      return;
    }
    if (tgtLv <= curLvNum) {
      errorDiv.textContent = '上げたいレベルは現在のレベルより高くしてください。';
      return;
    }

    const e = getTotalExp(growthType, curLvNum);
    if (e == null) {
      errorDiv.textContent = '経験値テーブルに不足があります。このポケモンのレベルデータを確認してください。';
      return;
    }
    curLv = curLvNum;
    curExp = e;

  } else { // mode === 'exp'
    const curExpNum = Number(currentValueInput.value);
    if (!Number.isFinite(curExpNum) || curExpNum < 0) {
      errorDiv.textContent = '現在の経験値は0以上の数値で入力してください。';
      return;
    }

    curExp = curExpNum;
    const lv = getLevelFromExp(growthType, curExpNum);
    if (lv == null) {
      errorDiv.textContent = '経験値テーブルに不足があります。このポケモンのレベルデータを確認してください。';
      return;
    }
    curLv = lv;

    if (tgtExp <= curExp) {
      errorDiv.textContent = 'すでに目標レベル以上の経験値があります。';
      return;
    }
  }

  const needExp = tgtExp - curExp;
  if (needExp <= 0) {
    errorDiv.textContent = '必要経験値が0以下になっています。入力を見直してください。';
    return;
  }

  const candies = calcCandies(needExp);

  // 結果表示
  resultName.textContent = name;
  resultGrowth.textContent = growthType;

  // ここを追加：現在・目標・必要の3つを出す
  resultCurrentExp.textContent = `${curExp.toLocaleString()} EXP`;
  resultTargetExp.textContent = `${tgtExp.toLocaleString()} EXP`;
  resultNeedExp.textContent = `${needExp.toLocaleString()} EXP`;

  if (candies.detail.length === 0) {
    resultCandies.textContent = 'けいけんアメは不要です。';
  } else {
    const lines = candies.detail.map(c => {
      return `アメ${c.name} × ${c.count}（合計 ${(c.xp * c.count).toLocaleString()} EXP）`;
    });
    const totalStr = `合計 ${candies.total.toLocaleString()} EXP`;
    resultCandies.innerHTML = lines.join('<br>') + '<br><strong>' + totalStr + '</strong>';
  }

  resultCard.style.display = 'block';
}

// イベント設定
calcBtn.addEventListener('click', handleCalc);

// 初期化
loadData();