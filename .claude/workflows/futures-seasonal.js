export const meta = {
  name: 'futures-seasonal',
  description: '期货品种季节性分析 — 价格季节性、价差季节性、供需季节性',
  phases: [
    { title: '数据采集', detail: '并行拉取价格、价差、供需三组季节性数据' },
    { title: '季节性研判', detail: '交叉验证生成季节性综合判断' },
  ],
}

const { symbol, windCode, period } = args

// 必填参数校验
if (!symbol || !windCode) {
  log('错误：缺少必要参数 symbol 或 windCode')
  return '## 错误：无法生成季节性分析报告，缺少必要参数（symbol、windCode）'
}

const parsed = parseInt(period)
const years = (!isNaN(parsed) && parsed > 0) ? parsed : 5

phase('数据采集')

let priceSeasonal, spreadSeasonal, sdSeasonal
try {
  [priceSeasonal, spreadSeasonal, sdSeasonal] = await parallel([
    () => agent(
      `你是期货技术面分析专家。请分析 **${symbol}**（Wind代码：${windCode}）的**月度价格季节性**。

要求：
1. 通过 wind-mcp-skill 获取最近 ${years} 年的日频或周频 K 线收盘价数据
2. 按月份聚合，计算：月度均价、月度上涨概率、季节性因子（月度均价/年均价）
3. 标注季节性最强和最弱的月份

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataYears": "${years}年",
  "monthlyStats": [
    {
      "month": 1,
      "avgPrice": 月均价,
      "upProbability": 上涨概率%,
      "seasonalFactor": 季节性因子（>1 表示高于年均价）,
      "strength": "强/弱/中性"
    },
    ...
  ],
  "strongestMonth": 最强月份,
  "weakestMonth": 最弱月份,
  "currentDeviation": {
    "currentPrice": 当前价格,
    "historicalAvgForCurrentMonth": 历史同期均价,
    "deviationSigma": 偏离标准差倍数
  },
  "notes": "分析方法说明"
}`,
      { label: '价格季节性', phase: '数据采集' }
    ),

    () => agent(
      `你是期货价差分析专家。请分析 **${symbol}**（Wind代码：${windCode}）的**价差季节性**。

要求：
1. 通过 wind-mcp-skill 获取最近 ${years} 年的近月-远月合约价差月度数据
2. 获取基差数据（现货-期货）
3. 计算各月份价差的均值和中位数
4. 判断价差是否存在明显的季节性规律

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataYears": "${years}年",
  "monthlySpreads": [
    {
      "month": 1,
      "nearFarSpread": 近远月价差均值,
      "basis": 基差均值,
      "spreadPattern": "contango/backwardation/平水"
    },
    ...
  ],
  "currentSpreadStatus": {
    "nearFarSpread": 当前近远月价差,
    "basis": 当前基差,
    "vsHistorical": "高于/低于/符合历史同期均值"
  },
  "notes": "价差分析说明"
}`,
      { label: '价差季节性', phase: '数据采集' }
    ),

    () => agent(
      `你是期货基本面分析专家。请分析 **${symbol}**（Wind代码：${windCode}）的**供需季节性**。

要求：
1. 通过 wind-mcp-skill 和 wind-find-finance-skill 获取产量、消费、库存的月度数据
2. 将每月数据除以年均值得到季节性指数
3. 识别供给和需求的季节性高峰/低谷月份

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataYears": "${years}年",
  "monthlySDIndex": [
    {
      "month": 1,
      "productionIndex": 产量季节性指数（1=年均水平）,
      "consumptionIndex": 消费季节性指数,
      "inventoryIndex": 库存季节性指数,
      "sdBalance": "供>需/供<需/平衡"
    },
    ...
  ],
  "productionPeakMonth": 产量高峰月份,
  "consumptionPeakMonth": 消费高峰月份,
  "inventoryPeakMonth": 库存高峰月份,
  "currentSDStatus": "当前供需相对位置描述",
  "notes": "供需季节性分析说明"
}`,
      { label: '供需季节性', phase: '数据采集' }
    ),
  ])
} catch (e) {
  log(`数据采集阶段异常：${e.message}`)
}

const validResults = [priceSeasonal, spreadSeasonal, sdSeasonal].filter(Boolean)
if (validResults.length === 0) {
  log('错误：所有数据源均获取失败，无法生成报告')
  return `## 数据获取失败\n\n${symbol} 的价格、价差、供需季节性数据均无法获取。请检查参数或网络连接后重试。`
}
if (validResults.length < 2) {
  log('⚠️ 部分数据获取失败，将基于已有数据生成报告')
}

phase('季节性研判')

const report = await agent(
  `你是期货季节性分析高级分析师。请基于以下数据生成 **${symbol}** 的季节性综合分析报告。

## 数据输入

### 价格季节性
${JSON.stringify(priceSeasonal, null, 2)}

### 价差季节性
${JSON.stringify(spreadSeasonal, null, 2)}

### 供需季节性
${JSON.stringify(sdSeasonal, null, 2)}

## 任务

生成一份完整的季节性分析报告（Markdown），包含：

### 1. 价格季节性因子图（描述为表格）
表头：月份 | 季节性因子 | 上涨概率 | 强度评级
- 季节性因子 > 1.05 标记为 "偏强 📈"
- 季节性因子 < 0.95 标记为 "偏弱 📉"
- 之间标记为 "中性 ➡️"

### 2. 季节性日历（200字）
- 一年中该品种的旺季/淡季划分
- 每个阶段的特征和驱动因素
- 标注关键拐点月份

### 3. 价差季节性分析（200字）
- 近远月价差的季节性规律
- 基差季节性变化
- 当前价差水平与历史同期的对比

### 4. 当前偏离度评估（150字）
- 当前价格 vs 历史同期均值偏离程度（σ 值）
- 如果偏离超过 1.5σ，标注为"异常"
- 如果偏离超过 2σ，标注为"显著异常 ⚠️"

### 5. 未来 3 个月季节性展望（200字）
- 接下来 3 个月的季节性倾向（偏多/偏空/中性）
- 当前指标是否支持季节性规律
- 最佳交易窗口建议

### 6. 风险提示
- 季节性规律可能失效的风险因素

### 7. 追问建议
- 2-3 个可进一步深挖的方向

注意：
- 报告标题使用：## ${symbol} 季节性分析报告（YYYY-MM-DD）
- 数据缺失处标注 "N/A"`,
  { label: '季节性研判', phase: '季节性研判' }
)

return report
