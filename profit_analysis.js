const fs = require('fs');

// Helper to parse result files
function parseResult(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  const json = JSON.parse(raw);
  return JSON.parse(json.content[0].text);
}

// 1. Rebar Price (S5707798) from bznkltfvu.txt
const rebarRaw = parseResult('C:/Users/ethan/.claude/projects/C--Users-ethan-Desktop-----/8110f615-9114-43c8-8109-b3280dc01fd8/tool-results/bznkltfvu.txt');
const rebarPrice = rebarRaw.data.indicatorInfo.find(i => i.code === 'S5707798');

// 2. Iron Ore Price (W4971028) - from inline "国内铁矿石市场价" query
const ironOrePrice = {
  data: [null, 131.1, 126.0, 113.1, 105.8, 107.4, 105.7, 102.6, 95.5, 92.4, 95.0, 97.7, null, 99.4, 98.5, 98.1, 96.2, 92.9, 91.4, 92.7, 97.0, 100.6, 101.5, 101.16, 101.1, 101.3, 99.6, 100.1, null],
  name: '中国:收盘价:铁矿石:月:平均值:美元'
};

// Actually use W4971028 which is 中国:收盘价:铁矿石:月:平均值:美元 with complete data
const ironOreFull = {
  data: [135.6356, 127.8882, 114.6999, 115.8411, 122.2529, 113.0189, 112.1598, 104.3907, 100.2171, 108.8041, 107.1679, 108.3024, 107.5285, 112.1477, 106.9288, 98.6021, 99.2607, 98.1983, 107.1271, 109.7548, 111.7399, 110.3411, 110.3907, 111.0544, 115.3902, 114.9323, 115.1119, 113.8439, 118.4531],
  name: '中国:收盘价:铁矿石:月:平均值:美元'
};

// 3. Coke Price (U5157465) - from inline "唐山冶金焦价格" query
const cokeFull = {
  data: [2252.8571, 2147.5, 1910.0, 1741.8182, 1971.9048, 1883.6842, 1905.6522, 1728.1818, 1555.0, 1775.7895, 1700.4762, 1614.5455, 1504.7368, 1391.5789, 1281.4286, 1289.5455, 1275.7895, 1139.0, 1144.5455, 1380.4762, 1374.7826, 1403.8889, 1510.0, 1442.1739, 1342.3810, 1390.0, 1349.0909, 1410.0, 1490.0],
  name: '中国:唐山:到厂价(含税):冶金焦(二级):月:平均值'
};

// 4. Production (S5706262) - from inline query
const prodFull = {
  data: [1658.4, 1551.5, 1778.7, 1634.3, 1798.6, 1824.0, 1564.5, 1255.3, 1531.4, 1771.6, 1674.5, 1614.0, 1548.63, 1398.77, 1861.1, 1730.0, 1688.4, 1658.3, 1518.2, 1541.2, 1475.0, 1434.0, 1375.1, 1355.9, 1413.92, 1277.08, 1541.5, 1511.2],
  name: '中国:产量:螺纹钢'
};

// 5. Exchange Rate - from inline query
const fxRate = {
  data: [7.1060, 7.1051, 7.0978, 7.1007, 7.1057, 7.1162, 7.1316, 7.1342, 7.0791, 7.1058, 7.1729, 7.1887, 7.1833, 7.1711, 7.1737, 7.2034, 7.1950, 7.1757, 7.1491, 7.1309, 7.1068, 7.0948, 7.0848, 7.0593, 7.0016, 6.9462, 6.9037, 6.8683, 6.8385]
};

// Dates
const dates = [
  '2024-01','2024-02','2024-03','2024-04','2024-05','2024-06',
  '2024-07','2024-08','2024-09','2024-10','2024-11','2024-12',
  '2025-01','2025-02','2025-03','2025-04','2025-05','2025-06',
  '2025-07','2025-08','2025-09','2025-10','2025-11','2025-12',
  '2026-01','2026-02','2026-03','2026-04','2026-05'
];

const PROCESSING_COST = 500; // 加工费 元/吨
const IRON_ORE_RATIO = 1.6;  // 1.6吨铁矿石生产1吨螺纹钢
const COKE_RATIO = 0.5;      // 0.5吨焦炭生产1吨螺纹钢

// Convert iron ore to CNY
const ironOreCNY = ironOreFull.data.map((v, i) => {
  if (v == null || fxRate.data[i] == null) return null;
  return v * fxRate.data[i];
});

// Calculate costs and profits
const rawMatCost = [];
const totalCost = [];
const profit = [];
const marginPct = [];

for (let i = 0; i < dates.length; i++) {
  const io = ironOreCNY[i];
  const ck = cokeFull.data[i];
  const rp = rebarPrice.data[i];

  if (io == null || ck == null || rp == null) {
    rawMatCost.push(null);
    totalCost.push(null);
    profit.push(null);
    marginPct.push(null);
    continue;
  }

  const rmc = IRON_ORE_RATIO * io + COKE_RATIO * ck;
  const tc = rmc + PROCESSING_COST;
  const pf = rp - tc;

  rawMatCost.push(rmc);
  totalCost.push(tc);
  profit.push(pf);
  marginPct.push(pf / rp * 100);
}

// Print monthly table
console.log('月份\t\t螺纹钢价\t铁矿石CNY\t焦炭价\t原料成本\t总成本\t利润\t利润率%\t产量(万吨)');
for (let i = 0; i < dates.length; i++) {
  const prodVal = i < prodFull.data.length ? prodFull.data[i] : '-';
  if (profit[i] != null) {
    console.log(
      dates[i] + '\t' +
      rebarPrice.data[i].toFixed(0) + '\t' +
      ironOreCNY[i].toFixed(0) + '\t' +
      cokeFull.data[i].toFixed(0) + '\t' +
      rawMatCost[i].toFixed(0) + '\t' +
      totalCost[i].toFixed(0) + '\t' +
      profit[i].toFixed(0) + '\t' +
      marginPct[i].toFixed(1) + '\t' +
      prodVal
    );
  }
}

// Stats
const validP = profit.filter(p => p != null);
const avgProfit = validP.reduce((a,b) => a+b, 0) / validP.length;
const maxProfit = Math.max(...validP);
const minProfit = Math.min(...validP);
const avgPrice = rebarPrice.data.filter(p => p != null).reduce((a,b) => a+b, 0) / rebarPrice.data.filter(p => p != null).length;

console.log('\n=== 统计摘要 ===');
console.log('数据范围:', dates[0], '-', dates[dates.length-1]);
console.log('平均螺纹钢价格:', avgPrice.toFixed(0), '元/吨');
console.log('平均利润:', avgProfit.toFixed(0), '元/吨');
console.log('最高利润:', maxProfit.toFixed(0), '元/吨 (利润率', (maxProfit/avgPrice*100).toFixed(1), '%)');
console.log('最低利润:', minProfit.toFixed(0), '元/吨 (利润率', (minProfit/avgPrice*100).toFixed(1), '%)');
console.log('平均利润率:', (avgProfit/avgPrice*100).toFixed(1), '%');

// Latest
const lastValid = validP[validP.length-1];
const lastIdx = profit.lastIndexOf(lastValid);
console.log('最新(' + dates[lastIdx] + ')利润:', lastValid.toFixed(0), '元/吨, 利润率:', marginPct[lastIdx].toFixed(1), '%');

// Build valid pairs for correlation
const pairs = [];
for (let i = 0; i < Math.min(dates.length, prodFull.data.length); i++) {
  if (profit[i] != null && prodFull.data[i] != null) {
    pairs.push({
      month: dates[i],
      price: rebarPrice.data[i],
      cost: totalCost[i],
      profit: profit[i],
      margin: marginPct[i],
      production: prodFull.data[i]
    });
  }
}

// Pearson correlation
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

// Lead-lag analysis
for (let lag = 1; lag <= 4; lag++) {
  const pLag = pArr.slice(0, -lag);
  const qLag = qArr.slice(lag);
  if (pLag.length > 5) {
    const r = pearson(pLag, qLag);
    console.log('利润领先产量' + lag + '个月: r=' + r.toFixed(3));
  }
}

// Also check: production(t) leading profit(t+lag) - reverse causality
for (let lag = 1; lag <= 2; lag++) {
  const qLag = qArr.slice(0, -lag);
  const pLag = pArr.slice(lag);
  if (qLag.length > 5) {
    const r = pearson(qLag, pLag);
    console.log('产量领先利润' + lag + '个月: r=' + r.toFixed(3));
  }
}

// Profit thresholds
console.log('\n=== 利润阈值分析 ===');
const sortedByProfit = [...pairs].sort((a, b) => a.profit - b.profit);

const lossMonths = pairs.filter(v => v.profit < 0);
const thinMonths = pairs.filter(v => v.profit >= 0 && v.profit < 150);
const moderateMonths = pairs.filter(v => v.profit >= 150 && v.profit < 350);
const highMonths = pairs.filter(v => v.profit >= 350);

function avgProd(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s,v) => s + v.production, 0) / arr.length;
}
function avgProfitCalc(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s,v) => s + v.profit, 0) / arr.length;
}

console.log('亏损(<0元/吨):', lossMonths.length, '个月, 平均利润:', avgProfitCalc(lossMonths).toFixed(0), ', 平均产量:', avgProd(lossMonths).toFixed(0), '万吨');
console.log('微利(0-150):', thinMonths.length, '个月, 平均利润:', avgProfitCalc(thinMonths).toFixed(0), ', 平均产量:', avgProd(thinMonths).toFixed(0), '万吨');
console.log('中等利润(150-350):', moderateMonths.length, '个月, 平均利润:', avgProfitCalc(moderateMonths).toFixed(0), ', 平均产量:', avgProd(moderateMonths).toFixed(0), '万吨');
console.log('高利润(>350):', highMonths.length, '个月, 平均利润:', avgProfitCalc(highMonths).toFixed(0), ', 平均产量:', avgProd(highMonths).toFixed(0), '万吨');

// Elasticity: % change production / % change profit
console.log('\n=== 利润-产量弹性 ===');
if (lossMonths.length > 0 && moderateMonths.length > 0) {
  const prodElasticity = ((avgProd(moderateMonths) - avgProd(lossMonths)) / avgProd(lossMonths) * 100);
  console.log('从亏损到中等利润, 产量弹性:', prodElasticity.toFixed(1), '%');
}

// Find profit threshold where production significantly responds
console.log('\n=== 利润区间->产量敏感性 ===');
const thresholds = [
  { min: -500, max: 0 },
  { min: 0, max: 100 },
  { min: 100, max: 200 },
  { min: 200, max: 300 },
  { min: 300, max: 500 },
];
thresholds.forEach(t => {
  const group = pairs.filter(v => v.profit >= t.min && v.profit < t.max);
  console.log('利润[' + t.min + ',' + t.max + '):', group.length, '个月, 平均产量:', avgProd(group).toFixed(0), '万吨');
});

// Month-over-month changes
console.log('\n=== 利润变化对产量的领先效应 ===');
// For months where profit increased significantly (>50 vs prev), check production after 1-2 months
for (let i = 1; i < pairs.length - 2; i++) {
  const profitChange = pairs[i].profit - pairs[i-1].profit;
  if (profitChange > 80) {
    const prodChange1 = pairs[i+1] ? ((pairs[i+1].production / pairs[i].production - 1) * 100) : null;
    const prodChange2 = pairs[i+2] ? ((pairs[i+2].production / pairs[i].production - 1) * 100) : null;
    console.log(pairs[i].month + ' 利润回升+' + profitChange.toFixed(0) + '-> 1月后产量:' + (prodChange1 != null ? prodChange1.toFixed(1) + '%' : 'N/A') + ', 2月后:' + (prodChange2 != null ? prodChange2.toFixed(1) + '%' : 'N/A'));
  }
  if (profitChange < -80) {
    const prodChange1 = pairs[i+1] ? ((pairs[i+1].production / pairs[i].production - 1) * 100) : null;
    const prodChange2 = pairs[i+2] ? ((pairs[i+2].production / pairs[i].production - 1) * 100) : null;
    console.log(pairs[i].month + ' 利润下降' + profitChange.toFixed(0) + '-> 1月后产量:' + (prodChange1 != null ? prodChange1.toFixed(1) + '%' : 'N/A') + ', 2月后:' + (prodChange2 != null ? prodChange2.toFixed(1) + '%' : 'N/A'));
  }
}
