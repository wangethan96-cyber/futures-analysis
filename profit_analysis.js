const fs = require('fs');

function parseResult(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  const json = JSON.parse(raw);
  return JSON.parse(json.content[0].text);
}

// 1. Rebar Price & Production from bznkltfvu.txt
const rebarData = parseResult('C:/Users/ethan/.claude/projects/C--Users-ethan-Desktop-----/8110f615-9114-43c8-8109-b3280dc01fd8/tool-results/bznkltfvu.txt');
const rebarPrice = rebarData.data.indicatorInfo.find(i => i.code === 'S5707798');
// Production was returned inline from a separate query
const prodRaw = JSON.parse('{"data":{"date":["20240131","20240229","20240331","20240430","20240531","20240630","20240731","20240831","20240930","20241031","20241130","20241231","20250131","20250228","20250331","20250430","20250531","20250630","20250731","20250831","20250930","20251031","20251130","20251231","20260131","20260228","20260331","20260430"],"indicatorInfo":[{"code":"S5706262","data":[1658.4,1551.5,1778.7,1634.3,1798.6,1824.0,1564.5,1255.3,1531.4,1771.6,1674.5,1614.0,1548.63,1398.77,1861.1,1730.0,1688.4,1658.3,1518.2,1541.2,1475.0,1434.0,1375.1,1355.9,1413.92,1277.08,1541.5,1511.2],"name":"中国:产量:螺纹钢","unit":"万吨"}]}}');
const rebarProd = prodRaw.data.indicatorInfo[0];

// 2. Iron Ore Price from b7d7z8hv7.txt
const ironOreData = parseResult('C:/Users/ethan/.claude/projects/C--Users-ethan-Desktop-----/8110f615-9114-43c8-8109-b3280dc01fd8/tool-results/b7d7z8hv7.txt');
const ironOrePrice = ironOreData.data.indicatorInfo.find(i => i.code === 'W4971028');

// 3. Coke Price from buje1qt6a.txt
const cokeData = parseResult('C:/Users/ethan/.claude/projects/C--Users-ethan-Desktop-----/8110f615-9114-43c8-8109-b3280dc01fd8/tool-results/buje1qt6a.txt');
const cokePrice = cokeData.data.indicatorInfo.find(i => i.code === 'U5157465');

// Exchange rate
const fxRate = {
  values: [7.1060,7.1051,7.0978,7.1007,7.1057,7.1162,7.1316,7.1342,7.0791,7.1058,7.1729,7.1887,7.1833,7.1711,7.1737,7.2034,7.1950,7.1757,7.1491,7.1309,7.1068,7.0948,7.0848,7.0593,7.0016,6.9462,6.9037,6.8683,6.8385]
};

const processingCost = 500;

console.log('=== 数据验证 ===');
console.log('螺纹钢价格:', rebarPrice ? rebarPrice.name : 'MISSING');
console.log('铁矿石价格:', ironOrePrice ? ironOrePrice.name : 'MISSING');
console.log('焦炭价格:', cokePrice ? cokePrice.name : 'MISSING');
console.log('螺纹钢产量:', rebarProd ? rebarProd.name : 'MISSING');

if (!rebarPrice || !ironOrePrice || !cokePrice || !rebarProd) {
  console.log('FATAL: 缺少关键数据');
  process.exit(1);
}

// Build date labels
const dates = rebarData.data.date.map(d => d.substring(0,4) + '-' + d.substring(4,6));

// Convert iron ore to CNY
const ironOreCNY = ironOrePrice.data.map((v, i) => v * fxRate.values[i]);

// Raw material cost: 1.6 ton iron ore + 0.5 ton coke
const rawMatCost = ironOreCNY.map((v, i) => 1.6 * v + 0.5 * cokePrice.data[i]);
const totalCost = rawMatCost.map(v => v + processingCost);
const profit = rebarPrice.data.map((p, i) => p - totalCost[i]);
const marginPct = rebarPrice.data.map((p, i) => profit[i] / p * 100);

// Print monthly data
console.log('\n月份\t\t螺纹钢\t铁矿CNY\t焦炭\t原料成本\t总成本\t利润\t利润率%\t产量(万吨)');
for (let i = 0; i < dates.length; i++) {
  const prodVal = i < rebarProd.data.length ? rebarProd.data[i] : 'N/A';
  console.log(
    dates[i] + '\t' +
    rebarPrice.data[i].toFixed(0) + '\t' +
    ironOreCNY[i].toFixed(0) + '\t' +
    cokePrice.data[i].toFixed(0) + '\t' +
    rawMatCost[i].toFixed(0) + '\t' +
    totalCost[i].toFixed(0) + '\t' +
    profit[i].toFixed(0) + '\t' +
    marginPct[i].toFixed(1) + '\t' +
    prodVal
  );
}

// Statistics
const validProfits = profit.filter(p => p != null && !isNaN(p));
const avgProfit = validProfits.reduce((a,b) => a+b, 0) / validProfits.length;
const maxProfit = Math.max(...validProfits);
const minProfit = Math.min(...validProfits);
const avgPrice = rebarPrice.data.reduce((a,b)=>a+b,0) / rebarPrice.data.length;
const avgMarginAll = avgProfit / avgPrice * 100;

console.log('\n=== 统计摘要 ===');
console.log('平均螺纹钢价格:', avgPrice.toFixed(0), '元/吨');
console.log('平均总成本:', (avgPrice - avgProfit).toFixed(0), '元/吨');
console.log('平均利润:', avgProfit.toFixed(0), '元/吨');
console.log('最高利润:', maxProfit.toFixed(0), '元/吨');
console.log('最低利润:', minProfit.toFixed(0), '元/吨');
console.log('平均利润率:', avgMarginAll.toFixed(1), '%');

// Current (latest non-null)
let latestIdx = profit.length - 1;
while (latestIdx >= 0 && (profit[latestIdx] == null || isNaN(profit[latestIdx]))) latestIdx--;
if (latestIdx >= 0) {
  console.log('最新数据(' + dates[latestIdx] + '): 利润=' + profit[latestIdx].toFixed(0) + '元/吨, 利润率=' + marginPct[latestIdx].toFixed(1) + '%');
}

// Build valid pairs
const pairs = [];
for (let i = 0; i < Math.min(dates.length, rebarProd.data.length); i++) {
  if (profit[i] != null && !isNaN(profit[i]) && rebarProd.data[i] != null) {
    pairs.push({ month: dates[i], profit: profit[i], margin: marginPct[i], production: rebarProd.data[i] });
  }
}

// Correlation
function pearson(x, y) {
  const n = x.length;
  const mx = x.reduce((a,b) => a+b, 0) / n;
  const my = y.reduce((a,b) => a+b, 0) / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (x[i] - mx) * (y[i] - my);
    vx += (x[i] - mx) ** 2;
    vy += (y[i] - my) ** 2;
  }
  return cov / Math.sqrt(vx * vy);
}

const pArr = pairs.map(v => v.profit);
const qArr = pairs.map(v => v.production);

console.log('\n=== 利润-产量相关性分析 ===');
console.log('有效数据点:', pairs.length);
console.log('同期相关系数:', pearson(pArr, qArr).toFixed(3));

for (let lag = 1; lag <= 4; lag++) {
  const pLag = pArr.slice(0, -lag);
  const qLag = qArr.slice(lag);
  if (pLag.length > 5) {
    console.log('利润领先产量' + lag + '个月: r=' + pearson(pLag, qLag).toFixed(3));
  }
}

// Profit thresholds
const sortedByProfit = [...pairs].sort((a, b) => a.profit - b.profit);
console.log('\n=== 利润阈值分析 ===');
console.log('利润底部区间:');
sortedByProfit.slice(0, 5).forEach(v => console.log('  ' + v.month + ': 利润=' + v.profit.toFixed(0) + '元/吨, 产量=' + v.production + '万吨'));

const lossMonths = pairs.filter(v => v.profit < 0);
const thinMonths = pairs.filter(v => v.profit >= 0 && v.profit < 200);
const normalMonths = pairs.filter(v => v.profit >= 200 && v.profit < 400);
const highMonths = pairs.filter(v => v.profit >= 400);

console.log('\n亏损月份(<0):', lossMonths.length, '个月');
console.log('微利月份(0-200):', thinMonths.length, '个月');
console.log('正常利润(200-400):', normalMonths.length, '个月');
console.log('高利润(>400):', highMonths.length, '个月');

function avgProd(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s,v) => s + v.production, 0) / arr.length;
}

console.log('亏损期平均产量:', avgProd(lossMonths).toFixed(0), '万吨');
console.log('微利期平均产量:', avgProd(thinMonths).toFixed(0), '万吨');
console.log('正常利润期平均产量:', avgProd(normalMonths).toFixed(0), '万吨');
console.log('高利润期平均产量:', avgProd(highMonths).toFixed(0), '万吨');

// Lead-lag specific analysis
console.log('\n=== 利润领先产量分析 ===');
// Check if high profit months are followed by production increase
for (let i = 0; i < pairs.length - 2; i++) {
  if (pairs[i].profit > 300 && pairs[i+1] && pairs[i+2]) {
    const prodChange1 = (pairs[i+1].production / pairs[i].production - 1) * 100;
    const prodChange2 = (pairs[i+2].production / pairs[i].production - 1) * 100;
    console.log(pairs[i].month + ' 高利润(' + pairs[i].profit.toFixed(0) + ') -> 1月后产量变化:' + prodChange1.toFixed(1) + '%, 2月后:' + prodChange2.toFixed(1) + '%');
  }
}

console.log('\n=== 对产量反应最敏感的利润区间 ===');
// Group by profit ranges
const ranges = [
  { min: -Infinity, max: 0, label: '亏损' },
  { min: 0, max: 100, label: '0-100元/吨' },
  { min: 100, max: 200, label: '100-200元/吨' },
  { min: 200, max: 300, label: '200-300元/吨' },
  { min: 300, max: 400, label: '300-400元/吨' },
  { min: 400, max: Infinity, label: '400+元/吨' }
];
ranges.forEach(r => {
  const inRange = pairs.filter(v => v.profit >= r.min && v.profit < r.max);
  if (inRange.length > 0) {
    console.log(r.label + ': ' + inRange.length + '个月, 平均产量=' + avgProd(inRange).toFixed(0) + '万吨');
  }
});
