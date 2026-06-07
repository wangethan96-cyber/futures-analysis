export const meta = {
  name: 'futures-production',
  description: '期货品种产量预测 — 趋势外推、季节性修正、利润驱动、多因子加权',
  phases: [
    { title: '数据采集', detail: '并行拉取历史趋势、利润模型、季节+政策三组数据' },
    { title: '产量预测', detail: '多因子加权预测与情景分析' },
  ],
}

// 品种中文名/简称 → { symbol, windCode } 映射表
const PRODUCT_MAP = {
  '螺纹':   { symbol: '螺纹钢',   windCode: 'RB.SHF' },
  '螺纹钢':  { symbol: '螺纹钢',   windCode: 'RB.SHF' },
  '热卷':   { symbol: '热轧卷板',  windCode: 'HC.SHF' },
  '热轧卷板': { symbol: '热轧卷板',  windCode: 'HC.SHF' },
  '铁矿':   { symbol: '铁矿石',   windCode: 'I.DCE' },
  '铁矿石':  { symbol: '铁矿石',   windCode: 'I.DCE' },
  '焦炭':   { symbol: '焦炭',     windCode: 'J.DCE' },
  '焦煤':   { symbol: '焦煤',     windCode: 'JM.DCE' },
  '动力煤':  { symbol: '动力煤',   windCode: 'ZC.ZCE' },
  '甲醇':   { symbol: '甲醇',     windCode: 'MA.ZCE' },
  'PTA':   { symbol: 'PTA',      windCode: 'TA.ZCE' },
  '乙二醇':  { symbol: '乙二醇',   windCode: 'EG.DCE' },
  '苯乙烯':  { symbol: '苯乙烯',   windCode: 'EB.DCE' },
  '聚丙烯':  { symbol: '聚丙烯',   windCode: 'PP.DCE' },
  '塑料':   { symbol: 'LLDPE',   windCode: 'L.DCE' },
  'PVC':   { symbol: 'PVC',      windCode: 'V.DCE' },
  '豆粕':   { symbol: '豆粕',     windCode: 'M.DCE' },
  '豆油':   { symbol: '豆油',     windCode: 'Y.DCE' },
  '棕榈油':  { symbol: '棕榈油',   windCode: 'P.DCE' },
  '菜粕':   { symbol: '菜粕',     windCode: 'RM.ZCE' },
  '菜油':   { symbol: '菜油',     windCode: 'OI.ZCE' },
  '白糖':   { symbol: '白糖',     windCode: 'SR.ZCE' },
  '棉花':   { symbol: '棉花',     windCode: 'CF.ZCE' },
  '棉纱':   { symbol: '棉纱',     windCode: 'CY.ZCE' },
  '苹果':   { symbol: '苹果',     windCode: 'AP.ZCE' },
  '红枣':   { symbol: '红枣',     windCode: 'CJ.ZCE' },
  '生猪':   { symbol: '生猪',     windCode: 'LH.DCE' },
  '鸡蛋':   { symbol: '鸡蛋',     windCode: 'JD.DCE' },
  '沪铜':   { symbol: '沪铜',     windCode: 'CU.SHF' },
  '沪铝':   { symbol: '沪铝',     windCode: 'AL.SHF' },
  '沪锌':   { symbol: '沪锌',     windCode: 'ZN.SHF' },
  '沪镍':   { symbol: '沪镍',     windCode: 'NI.SHF' },
  '沪锡':   { symbol: '沪锡',     windCode: 'SN.SHF' },
  '沪铅':   { symbol: '沪铅',     windCode: 'PB.SHF' },
  '沪银':   { symbol: '沪银',     windCode: 'AG.SHF' },
  '沪金':   { symbol: '沪金',     windCode: 'AU.SHF' },
  '不锈钢':  { symbol: '不锈钢',   windCode: 'SS.SHF' },
  '纯碱':   { symbol: '纯碱',     windCode: 'SA.ZCE' },
  '玻璃':   { symbol: '玻璃',     windCode: 'FG.ZCE' },
  '尿素':   { symbol: '尿素',     windCode: 'UR.ZCE' },
  '纸浆':   { symbol: '纸浆',     windCode: 'SP.SHF' },
  '橡胶':   { symbol: '橡胶',     windCode: 'RU.SHF' },
  '20号胶': { symbol: '20号胶',   windCode: 'NR.INE' },
  '沥青':   { symbol: '沥青',     windCode: 'BU.SHF' },
  '燃料油':  { symbol: '燃料油',   windCode: 'FU.SHF' },
  '原油':   { symbol: '原油',     windCode: 'SC.INE' },
  '硅铁':   { symbol: '硅铁',     windCode: 'SF.ZCE' },
  '锰硅':   { symbol: '锰硅',     windCode: 'SM.ZCE' },
  '玉米':   { symbol: '玉米',     windCode: 'C.DCE' },
  '淀粉':   { symbol: '淀粉',     windCode: 'CS.DCE' },
}

// 解析参数：支持字符串简写（如 "螺纹"）或完整对象
let symbol, windCode, period, forecastMonths

if (typeof args === 'string') {
  // 字符串模式：从映射表查找
  const key = args.trim()
  const mapping = PRODUCT_MAP[key]
  if (!mapping) {
    const supported = Object.keys(PRODUCT_MAP).filter((k, i, a) => a.indexOf(k) === i).join('、')
    log(`错误：未识别品种 "${key}"，支持的品种：${supported}`)
    return `## 错误：未识别品种 "${key}"\n\n请使用以下支持品种之一：${supported}\n\n或传入完整参数：\`{ symbol: "品种名", windCode: "代码.交易所" }\``
  }
  symbol = mapping.symbol
  windCode = mapping.windCode
} else if (typeof args === 'object' && args !== null) {
  symbol = args.symbol
  windCode = args.windCode
  period = args.period
  forecastMonths = args.forecastMonths
} else {
  log('错误：参数格式不正确，传入字符串（品种名）或对象 {symbol, windCode}')
  return '## 错误：无法生成产量预测，缺少必要参数（symbol、windCode）'
}

// 必填参数校验
if (!symbol || !windCode) {
  log('错误：缺少必要参数 symbol 或 windCode')
  return '## 错误：无法生成产量预测，缺少必要参数（symbol、windCode）'
}

const parsed = parseInt(period)
const years = (!isNaN(parsed) && parsed > 0) ? parsed : 3
const months = forecastMonths || 3

phase('数据采集')

let trendData, profitModel, seasonalPolicy
try {
  [trendData, profitModel, seasonalPolicy] = await parallel([
    () => agent(
      `你是期货基本面分析专家。请获取 **${symbol}**（Wind代码：${windCode}）的**历史产量趋势与产能数据**。

要求：
1. 通过 wind-mcp-skill 获取最近 ${years} 年月度产量数据
2. 获取产能数据（设计产能、有效产能）
3. 获取产能利用率时间序列
4. 计算产量的线性趋势和同比增长率

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataSource": "数据来源",
  "monthlyProduction": [
    { "month": "2024-01", "production": 产量, "capacity": 产能, "utilizationRate": 利用率% },
    ...
  ],
  "trendEquation": "线性趋势方程（y = ax + b）",
  "avgYoYGrowth": 平均同比增长率%,
  "capacityForecast": "未来产能变化（新装置投产/淘汰计划）",
  "notes": "数据说明"
}`,
      { label: '历史趋势与产能', phase: '数据采集' }
    ),

    () => agent(
      `你是期货基本面分析专家。请分析 **${symbol}**（Wind代码：${windCode}）的**利润与产量关系**。

要求：
1. 通过 wind-mcp-skill 获取产品价格和主要原料成本数据
2. 计算生产利润时间序列（产品价格 - 原料成本）
3. 分析利润变化对产量的领先/滞后关系
4. 找出利润阈值（盈利/亏损对产量的敏感度）

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataSource": "数据来源",
  "costStructure": {
    "mainRawMaterial": "主要原料",
    "rawMaterialCost": 原料成本（元/吨）,
    "processingCost": 加工费（元/吨）,
    "totalCost": 总成本（元/吨）
  },
  "monthlyProfit": [
    { "month": "2024-01", "price": 产品价格, "cost": 成本, "profit": 利润, "margin": 利润率% },
    ...
  ],
  "currentProfitStatus": "当前利润水平描述（高利润/微利/亏损）",
  "profitProductionElasticity": "利润-产量弹性描述",
  "profitThresholds": {
    "highProfitTrigger": "高利润刺激增产的阈值",
    "lossShutdownTrigger": "亏损导致减产的阈值"
  },
  "notes": "分析说明"
}`,
      { label: '利润与产量模型', phase: '数据采集' }
    ),

    () => agent(
      `你是期货基本面分析专家。请分析 **${symbol}**（Wind代码：${windCode}）的**季节性因子与政策检修情报**。

要求：
1. 计算历史产量月度季节性指数（每月产量/年均产量）
2. 通过 WebFetch 从交易所网站、行业资讯网站获取检修计划信息
3. 关注环保限产、能耗双控等政策影响
4. 汇总未来 ${months} 个月已知的供给扰动事件

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataSource": "数据来源",
  "monthlySeasonalIndex": [
    { "month": 1, "index": 季节性指数 },
    ...
  ],
  "maintenanceSchedule": [
    { "period": "2024-Q3", "company": "企业名", "capacity": 涉及产能, "duration": "检修时长" },
    ...
  ],
  "policyImpacts": [
    { "policy": "政策名称", "effectivePeriod": "生效时段", "estimatedImpact": 预计影响量 }
  ],
  "knownSupplyDisruptions": "未来 ${months} 个月已知的供给扰动汇总",
  "notes": "信息时效性说明"
}`,
      { label: '季节与政策情报', phase: '数据采集' }
    ),
  ])
} catch (e) {
  log(`数据采集阶段异常：${e.message}`)
}

const validResults = [trendData, profitModel, seasonalPolicy].filter(Boolean)
if (validResults.length === 0) {
  log('错误：所有数据源均获取失败，无法生成报告')
  return `## 数据获取失败\n\n${symbol} 的产量趋势、利润、季节性数据均无法获取。请检查参数或网络连接后重试。`
}
if (validResults.length < 2) {
  log('⚠️ 部分数据获取不完整，预测可靠性下降')
}

phase('产量预测')

const report = await agent(
  `你是期货基本面高级分析师。请基于以下数据预测 **${symbol}** 未来 ${months} 个月的产量。

## 数据输入

### 历史趋势与产能
${JSON.stringify(trendData, null, 2)}

### 利润与产量模型
${JSON.stringify(profitModel, null, 2)}

### 季节性因子与政策检修
${JSON.stringify(seasonalPolicy, null, 2)}

## 预测方法论

使用多因子加权模型：
1. **趋势外推**（权重 40%）— 基于线性趋势和同比增长率
2. **季节性修正**（权重 30%）— 基于历史月度季节性指数调整
3. **利润驱动修正**（权重 20%）— 当前利润水平对产量的激励/抑制
4. **事件驱动修正**（权重 10%）— 检修计划、政策限产等一次性事件

## 任务

生成一份完整的产量预测报告（Markdown），包含：

### 1. 历史产量回顾（200字）
- 过去 ${years} 年的产量趋势
- 产能增长情况
- 关键拐点事件

### 2. 影响因素分析（300字）
- 利润驱动分析（当前利润水平、对产量的影响方向）
- 产能利用率变化
- 季节性因子分析
- 检修/政策事件影响

### 3. 产量预测（核心输出）

以表格呈现未来 ${months} 个月预测：

| 月份 | 趋势外推 | 季节性修正 | 利润修正 | 事件修正 | 综合预测 | 置信区间（±1σ） |
|------|---------|-----------|---------|---------|---------|-----------------|
| ...  | ...     | ...       | ...     | ...     | ...     | ...             |

### 4. 贡献度拆解
- 趋势贡献 X%
- 季节性贡献 Y%
- 利润贡献 Z%
- 事件贡献 W%

### 5. 情景分析

| 情景 | 假设条件 | 产量预测 | 概率 |
|------|---------|---------|------|
| 乐观 | ... | ... | ...% |
| 基准 | ... | ... | ...% |
| 悲观 | ... | ... | ...% |

### 6. 风险提示（3-5 条）

### 7. 预测质量自评
- 数据完整性评估
- 模型局限性说明
- 历史回测误差参考（如有）

注意：
- 报告标题使用：## ${symbol} 产量预测报告（YYYY-MM-DD）
- 不要编造数据，不确定的标注"估算"
- 所有预测值保留 1 位小数`,
  { label: '产量预测汇总', phase: '产量预测' }
)

return report
