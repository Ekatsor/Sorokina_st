// Сопоставляет 12 роликов говорящих голов с текстами историй по расшифровке.
//   node scripts/match-heads.mjs <transcriptsDir> <batchTag>
// Пишет head-map.json: [{reel, day, n, url, score}] и печатает читаемый отчёт.
import fs from 'fs';
const tdir = process.argv[2] || 'transcripts';
const tag  = process.argv[3] || 'batch-2';

const w = JSON.parse(fs.readFileSync('approved_week.json', 'utf8'));
const heads = [];
w.days.forEach(d => d.stories.forEach(s => {
  if (String(s.format).indexOf('говорящая') >= 0) heads.push({ day: d.key, n: s.n, text: s.text });
}));

const files = fs.readdirSync(tdir).filter(f => /reel-\d+\.txt$/.test(f)).sort();
const reels = files.map(f => ({ reel: f.replace(/\.txt$/, ''), text: fs.readFileSync(tdir + '/' + f, 'utf8') }));

function words(t) {
  return String(t || '').toLowerCase().replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/gi, ' ').split(/\s+/).filter(x => x.length > 2);
}
function bigrams(a) { const b = []; for (let i = 0; i < a.length - 1; i++) b.push(a[i] + '_' + a[i + 1]); return b; }
function jac(A, B) { let inter = 0; A.forEach(x => { if (B.has(x)) inter++; }); const uni = new Set([...A, ...B]).size || 1; return inter / uni; }
function sim(a, b) {
  const wa = words(a), wb = words(b);
  const j1 = jac(new Set(wa), new Set(wb));
  const j2 = jac(new Set(bigrams(wa)), new Set(bigrams(wb)));
  return j1 + 2 * j2; // биграммы важнее — фразы совпадают дословно
}

const pairs = [];
reels.forEach((r, ri) => heads.forEach((h, hi) => pairs.push({ ri, hi, s: sim(r.text, h.text) })));
pairs.sort((a, b) => b.s - a.s);

const usedR = new Set(), usedH = new Set(), map = [];
for (const p of pairs) {
  if (usedR.has(p.ri) || usedH.has(p.hi)) continue;
  usedR.add(p.ri); usedH.add(p.hi);
  map.push({ reel: reels[p.ri].reel, day: heads[p.hi].day, n: heads[p.hi].n, score: +p.s.toFixed(3) });
}
map.sort((a, b) => a.day.localeCompare(b.day) || a.n - b.n);
const base = 'https://github.com/Ekatsor/Sorokina_st/releases/download/' + tag + '/';
map.forEach(m => { m.url = base + m.reel + '.mp4'; });

fs.writeFileSync('head-map.json', JSON.stringify(map, null, 2));

console.log('=== КАРТА ПРИВЯЗКИ (ролик → история) ===');
const order = { wed: 1, thu: 2, fri: 3, sat: 4 };
map.sort((a, b) => (order[a.day] || 9) - (order[b.day] || 9) || a.n - b.n);
map.forEach(m => {
  const h = heads.find(x => x.day === m.day && x.n === m.n);
  const flag = m.score < 0.15 ? '  ⚠ низкая уверенность — проверить' : '';
  console.log(`${m.reel} → ${m.day.toUpperCase()} S${m.n}  (совпадение ${m.score})${flag}`);
  console.log(`   история: ${h.text.slice(0, 70).replace(/\n/g, ' ')}`);
});
