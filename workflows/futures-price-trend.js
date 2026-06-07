export const meta = {
  name: 'futures-price-trend',
  description: '期货品种价格趋势预测 — 基本面+技术面+资金面多因子打分',
  phases: [
    { title: '因子打分', detail: '并行计算基本面、技术面、资金面三组得分' },
    { title: '综合研判', detail: '加权汇总输出多空信号与关键价位' },
  ],
}

const { symbol, windCode, period, forecastMonths, reuseFundamental } = args

// 必填参数校验
if (!symbol || !windCode) {
  log('错误：缺少必要参数 symbol 或 windCode')
  return '## 错误：无法生成价格趋势研判，缺少必要参数（symbol、windCode）'
}

const parsed = parseInt(period)
const years = (!isNaN(parsed) && parsed > 0) ? parsed : 3
const months = forecastMonths || 3

phase('因子打分')

let fundamentalScore, technicalScore, capitalScore
try {
  [fundamentalScore, technicalScore, capitalScore] = await parallel([
    () => agent(
      `你是期货基本面分析专家。请对 **${symbol}**（Wind代码：${windCode}）进行**基本面因子打分**。

要求：
1. 通过 wind-mcp-skill 和 wind-find-finance-skill 获取以下数据：
   - 库存数据（社会库存、仓单）及历史分位数
   - 生产利润（当前利润水平 vs 历史区间）
   - 基差（现货-期货价差）
   - 上下游开工率
2. 如果${reuseFundamental ? '提供了' : '未提供'}已有的供需分析结果，请${reuseFundamental ? '参考使用' : '自行估算供需缺口'}

打分规则（每个维度 -2 到 +2，正数看多、负数看空）：
  - 库存分位：<20% = +2，20-40% = +1，40-60% = 0，60-80% = -1，>80% = -2
  - 生产利润：深度亏损 = +2（减产预期），高利润 = -2（增产预期）
  - 基差：深度贴水 = +2（期货修复），深度升水 = -2
  - 供需缺口：紧缺 = +2，过剩 = -2

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataSource": "数据来源",
  "scores": {
    "inventory": { "value": 分数, "reason": "理由（含当前分位数）" },
    "profit": { "value": 分数, "reason": "理由（含利润水平）" },
    "basis": { "value": 分数, "reason": "理由（含基差值）" },
    "supplyDemand": { "value": 分数, "reason": "理由" }
  },
  "compositeScore": 加权总分,
  "assessment": "基本面偏多/中性/偏空",
  "keyFundamentals": ["关键基本面要点1", "要点2", "要点3"],
  "notes": "分析说明"
}`,
      { label: '基本面打分', phase: '因子打分' }
    ),

    () => agent(
      `你是期货技术面分析专家。请对 **${symbol}**（Wind代码：${windCode}）进行**技术面因子打分**。

要求：
1. 通过 wind-mcp-skill 获取最近 ${years} 年的 K 线数据（日线）
2. 计算以下技术指标：

打分规则（-2 到 +2）：
  - 均线排列：多头排列 = +2，空头排列 = -2，交叉/粘合 = 0
  - RSI（14日）：<30 = +2（超卖反弹），30-40 = +1，40-60 = 0，60-70 = -1，>70 = -2（超买回落）
  - MACD：金叉/零轴上 = +2，死叉/零轴下 = -2，零轴附近 = 0
  - 布林带位置：下轨 = +2，中轨下 = +1，中轨 = 0，中轨上 = -1，上轨 = -2
  - 成交量趋势：放量上涨 = +1，缩量下跌 = +1（止跌），放量下跌 = -1

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataSource": "数据来源（Wind K线）",
  "scores": {
    "maArrangement": { "value": 分数, "description": "均线排列描述" },
    "rsi": { "value": 分数, "currentValue": RSI值, "description": "超买超卖状态" },
    "macd": { "value": 分数, "description": "MACD信号描述" },
    "bollinger": { "value": 分数, "description": "布林带位置描述" },
    "volume": { "value": 分数, "description": "成交量趋势描述" }
  },
  "compositeScore": 技术面加权总分,
  "assessment": "技术面偏多/中性/偏空",
  "supportLevels": ["支撑位1", "支撑位2"],
  "resistanceLevels": ["压力位1", "压力位2"],
  "trendStrength": "趋势强度描述（强/中/弱 + 方向）",
  "notes": "分析说明"
}`,
      { label: '技术面打分', phase: '因子打分' }
    ),

    () => agent(
      `你是期货资金面分析专家。请对 **${symbol}**（Wind代码：${windCode}）进行**资金面因子打分**。

要求：
1. 通过 wind-mcp-skill 获取以下数据：
   - 持仓量变化（近 1 个月主力合约持仓趋势）
   - 主力合约换月进展（移仓情况）
   - 注册仓单变化
   - 成交量变化

打分规则（-2 到 +2）：
  - 持仓量趋势：持续增仓+价格上涨 = +2，持续增仓+价格下跌 = -2，减仓 = 0
  - 主力移仓：多头移仓积极 = +1，空头移仓积极 = -1
  - 仓单变化：仓单减少 = +2（现货紧张），仓单增加 = -2（现货充裕）
  - 成交量：放量上涨 = +1，缩量下跌 = +1（卖压减小），放量下跌 = -1

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataSource": "数据来源",
  "scores": {
    "position": { "value": 分数, "description": "持仓量变化描述" },
    "rollover": { "value": 分数, "description": "主力移仓情况" },
    "warehouseReceipt": { "value": 分数, "description": "仓单变化描述" },
    "volume": { "value": 分数, "description": "成交量趋势描述" }
  },
  "compositeScore": 资金面加权总分,
  "assessment": "资金面偏多/中性/偏空",
  "speculatorPositioning": "投机资金定位描述",
  "notes": "分析说明"
}`,
      { label: '资金面打分', phase: '因子打分' }
    ),
  ])
} catch (e) {
  log(`数据采集阶段异常：${e.message}`)
}

const validResults = [fundamentalScore, technicalScore, capitalScore].filter(Boolean)
if (validResults.length === 0) {
  log('错误：所有因子打分均失败，无法生成报告')
  return `## 数据获取失败\n\n${symbol} 的基本面、技术面、资金面打分数据均无法获取。请检查参数或网络连接后重试。`
}
if (validResults.length < 2) {
  log('⚠️ 部分因子打分失败，综合研判的可靠性下降')
}

phase('综合研判')

const report = await agent(
  `你是期货首席策略分析师。请基于以下三组因子得分，生成 **${symbol}** 的价格趋势综合研判报告。

## 因子得分

### 基本面因子
${JSON.stringify(fundamentalScore, null, 2)}

### 技术面因子
${JSON.stringify(technicalScore, null, 2)}

### 资金面因子
${JSON.stringify(capitalScore, null, 2)}

## 多空判断规则

按照以下权重加权：
- 基本面权重：50%
- 技术面权重：30%
- 资金面权重：20%

最终得分 > 0.5 → 🟢 看多
最终得分 -0.5 到 0.5 → 🟡 中性/震荡
最终得分 < -0.5 → 🔴 看空

## 任务

生成完整的 Price Trend 研判报告（Markdown），包含：

### 1. 多空信号灯
大号展示：🟢 看多 / 🟡 中性 / 🔴 看空
标注置信度（高/中/低）

### 2. 各因子得分明细

| 因子类别 | 细分指标 | 得分 | 方向 | 简要理由 |
|---------|---------|------|------|---------|
| 基本面  | 库存    | ...  | ...  | ...     |
| ...     | ...    | ...  | ...  | ...     |

### 3. 加权总分与信号

| 因子类别 | 得分 | 权重 | 加权贡献 |
|---------|------|------|---------|
| 基本面  | ...  | 50%  | ...     |
| 技术面  | ...  | 30%  | ...     |
| 资金面  | ...  | 20%  | ...     |
| **合计** | —   | 100% | **总分** |

### 4. 关键价位

| 类型 | 价位 | 来源 |
|------|------|------|
| 强支撑 | ... | （技术面/成本支撑） |
| 弱支撑 | ... | ... |
| 当前价 | ... | — |
| 弱压力 | ... | ... |
| 强压力 | ... | ... |

### 5. 情景推演（未来 ${months} 个月）

| 情景 | 概率 | 目标价位 | 核心假设 |
|------|------|---------|---------|
| 🟢 乐观 | ...%  | ...     | ...     |
| 🟡 基准 | ...%  | ...     | ...     |
| 🔴 悲观 | ...%  | ...     | ...     |

### 6. 交易策略参考（200字）
- 当前位置的战术建议
- 什么信号出现需要调整观点
- 止损/止盈参考位

### 7. 风险提示清单
- 5 条以上关键风险因素

### 8. 追问建议
- 2-3 个可深挖的方向

注意：
- 报告标题使用：## ${symbol} 价格趋势研判报告（YYYY-MM-DD）
- 这是辅助分析工具，不构成投资建议，末尾必须加免责声明
- 不要编造价格目标，基于逻辑推导`,
  { label: '综合研判', phase: '综合研判' }
)

return report
