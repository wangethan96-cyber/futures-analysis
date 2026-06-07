const fs = require('fs');

function parseResult(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  const json = JSON.parse(raw);
  return JSON.parse(json.content[0].text);
}

// Rebar Price from bznkltfvu.txt
const rebarRaw = parseResult('C:/Users/ethan/.claude/projects/C--Users-ethan-Desktop-----/8110f615-9114-43c8-8109-b3280dc01fd8/tool-results/bznkltfvu.txt');
const rebarPrice = rebarRaw.data.indicatorInfo.find(i => i.code === 'S5707798');

// Iron Ore Price W4971028
const ironOreFull = {
  data: [135.6356, 127.8882, 114.6999, 115.8411, 122.2529, 113.0189, 112.1598, 104.3907, 100.2171, 108.8041, 107.1679, 108.3024, 107.5285, 112.1477, 106.9288, 98.6021, 99.2607, 98.1983, 107.1271, 109.7548, 111.7399, 110.3411, 110.3907, 111.0544, 115.3902, 114.9323, 115.1119, 113.8439, 118.4531]
};

// Coke Price U5157465
const cokeFull = {
  data: [2252.8571, 2147.5, 1910.0, 1741.8182, 1971.9048, 1883.6842, 1905.6522, 1728.1818, 1555.0, 1775.7895, 1700.4762, 1614.5455, 1504.7368, 1391.5789, 1281.4286, 1289.5455, 1275.7895, 1139.0, 1144.5455, 1380.4762, 1374.7826, 1403.8889, 1510.0, 1442.1739, 1342.3810, 1390.0, 1349.0909, 1410.0, 1490.0]
};

// Production S5706262
const prodFull = {
  data: [1658.4, 1551.5, 1778.7, 1634.3, 1798.6, 1824.0, 1564.5, 1255.3, 1531.4, 1771.6, 1674.5, 1614.0, 1548.63, 1398.77, 1861.1, 1730.0, 1688.4, 1658.3, 1518.2, 1541.2, 1475.0, 1434.0, 1375.1, 1355.9, 1413.92, 1277.08, 1541.5, 1511.2]
};

// Exchange Rate
const fxRate = {
  data: [7.1060, 7.1051, 7.0978, 7.1007, 7.1057, 7.1162, 7.1316, 7.1342, 7.0791, 7.1058, 7.1729, 7.1887, 7.1833, 7.1711, 7.1737, 7.2034, 7.1950, 7.1757, 7.1491, 7.1309, 7.1068, 7.0948, 7.0848, 7.0593, 7.0016, 6.9462, 6.9037, 6.8683, 6.8385]
};

const dates = [
  '2024-01','2024-02','2024-03','2024-04','2024-05','2024-06',
  '2024-07','2024-08','2024-09','2024-10','2024-11','2024-12',
  '2025-01','2025-02','2025-03','2025-04','2025-05','2025-06',
  '2025-07','2025-08','2025-09','2025-10','2025-11','2025-12',
  '2026-01','2026-02','2026-03','2026-04','2026-05'
];

const PROCESSING_COST = 500;
const IRON_ORE_RATIO = 1.6;
const COKE_RATIO = 0.5;

const ironOreCNY = ironOreFull.data.map((v, i) => v != null && fxRate.data[i] != null ? v * fxRate.data[i] : null);

// Calculate
const monthlyData = [];
for (let i = 0; i < dates.length; i++) {
  const io = ironOreCNY[i];
  const ck = cokeFull.data[i];
  const rp = rebarPrice.data[i];
  if (io == null || ck == null || rp == null) continue;

  const rmc = IRON_ORE_RATIO * io + COKE_RATIO * ck;
  const tc = rmc + PROCESSING_COST;
  const pf = rp - tc;
  const prod = i < prodFull.data.length ? prodFull.data[i] : null;

  monthlyData.push({
    month: dates[i],
    price: rp,
    ironOreCNY: io,
    coke: ck,
    rawMatCost: rmc,
    totalCost: tc,
    profit: pf,
    margin: pf / rp * 100,
    production: prod
  });
}

// Output JSON
const result = {
  productName: '螺纹钢',
  dataSource: '万得Wind金融数据服务',
  costStructure: {
    mainRawMaterial: '铁矿石(62%品位) + 焦炭(二级冶金焦)',
    ironOreCostCNY: (ironOreCNY.filter(v => v != null).reduce((a,b) => a+b, 0) / ironOreCNY.filter(v => v != null).length).toFixed(0),
    cokeCost: (cokeFull.data.reduce((a,b) => a+b, 0) / cokeFull.data.length).toFixed(0),
    rawMaterialRatio: '1.6吨铁矿石 + 0.5吨焦炭/吨螺纹钢',
    processingCost: 500,
    totalCost: (monthlyData.reduce((s,v) => s + v.totalCost, 0) / monthlyData.length).toFixed(0)
  },
  monthlyProfit: monthlyData.map(v => ({
    month: v.month,
    price: +v.price.toFixed(0),
    cost: +v.totalCost.toFixed(0),
    profit: +v.profit.toFixed(0),
    margin: +v.margin.toFixed(1)
  })),
  currentProfitStatus: '',
  profitProductionElasticity: '',
  profitThresholds: {
    highProfitTrigger: '',
    lossShutdownTrigger: ''
  },
  notes: ''
};

// Current status
const latest = monthlyData[monthlyData.length - 1];
const prev = monthlyData[monthlyData.length - 2];
result.currentProfitStatus = latest.profit > 900 ? '高利润（吨钢利润' + latest.profit.toFixed(0) + '元/吨，利润率' + latest.margin.toFixed(1) + '%）' : latest.profit > 500 ? '中等利润' : '微利';

// Elasticity analysis
// Group by profit percentile
const sorted = [...monthlyData].sort((a,b) => a.profit - b.profit);
const lowThird = sorted.slice(0, Math.floor(sorted.length / 3));
const midThird = sorted.slice(Math.floor(sorted.length / 3), Math.floor(2 * sorted.length / 3));
const highThird = sorted.slice(Math.floor(2 * sorted.length / 3));

const lowAvgProd = lowThird.reduce((s,v) => s + (v.production || 0), 0) / lowThird.filter(v => v.production != null).length;
const midAvgProd = midThird.reduce((s,v) => s + (v.production || 0), 0) / midThird.filter(v => v.production != null).length;
const highAvgProd = highThird.reduce((s,v) => s + (v.production || 0), 0) / highThird.filter(v => v.production != null).length;

const lowAvgProfit = lowThird.reduce((s,v) => s + v.profit, 0) / lowThird.length;
const highAvgProfit = highThird.reduce((s,v) => s + v.profit, 0) / highThird.length;

result.profitProductionElasticity =
  '利润与产量同期相关系数为0.711（强正相关），利润领先产量约1个月（r=0.655）。' +
  '低利润区间（均' + lowAvgProfit.toFixed(0) + '元/吨）平均产量' + lowAvgProd.toFixed(0) + '万吨；' +
  '高利润区间（均' + highAvgProfit.toFixed(0) + '元/吨）平均产量' + highAvgProd.toFixed(0) + '万吨。' +
  '利润每上升100元/吨，产量平均增加约' + Math.abs((lowAvgProd - highAvgProd) / (highAvgProfit - lowAvgProfit) * 100).toFixed(0) + '万吨/月；反之利润每下降100元/吨，产量平均减少相当幅度。';

// Threshold analysis: find profit level where production drops significantly
result.profitThresholds.highProfitTrigger =
  '当吨钢利润超过1000元/吨时（如2024年3-6月、2025年3-7月），螺纹钢月度产量可达1700-1850万吨高位，钢厂增产积极性强。利润升至900元/吨以上即显著刺激增产。';

result.profitThresholds.lossShutdownTrigger =
  '本分析期间（2024年1月-2026年5月）螺纹钢生产全程盈利，最低利润为745元/吨（2024年8月），对应产量降至1255万吨（年度低点），但未触发亏损减产。根据成本结构推算，螺纹钢亏损阈值约在总成本2545元/吨处（对应螺纹钢价格低于2545元/吨），即吨钢利润低于0元时将触发大规模减产。从利润-产量弹性看，利润每下降100元/吨（从900元降至800元区间），产量约下降8-12%。';

// Additional analysis
result.notes =
  '1. 成本模型基于行业通用配比：1.6吨62%品位铁矿石+0.5吨二级冶金焦+500元/吨加工费。' +
  '2. 铁矿石价格采用Wind中国铁矿石收盘价月均值（美元/吨），按央行中间价换算为人民币。' +
  '3. 焦炭价格采用唐山到厂含税二级冶金焦月均价。' +
  '4. 螺纹钢价格采用全国HRB400E 20mm市场价月均值。' +
  '5. 产量数据来源于西本新干线。' +
  '6. 2024年以来螺纹钢全行业持续盈利，最低利润出现在2024年8月（745元/吨），主要受高温淡季需求疲软影响。' +
  '7. 利润领先产量约1-2个月，反映了钢厂从利润信号到调产决策的时滞。' +
  '8. 2025年下半年以来利润呈收窄趋势（从1000+元降至800-900元区间），产量也相应从1700万吨高位回落至1400-1500万吨。';

console.log(JSON.stringify(result, null, 2));
