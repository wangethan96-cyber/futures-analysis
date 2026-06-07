export const meta = {
  name: 'futures-supply-demand',
  description: '期货品种供需平衡表分析 — 产量、进出口、下游消费、库存',
  phases: [
    { title: '数据采集', detail: '并行拉取产量、进出口、消费、库存四项数据' },
    { title: '平衡表汇总', detail: '汇总供需平衡表并输出解读' },
  ],
}

const { symbol, windCode, period } = args
const years = period ? parseInt(period) : 3

phase('数据采集')

const [production, trade, consumption, inventory] = await parallel([
  () => agent(
    `你是期货基本面数据专家。请通过 wind-mcp-skill 获取 **${symbol}**（Wind代码：${windCode}）的**国内产量数据**。

要求：
1. 先使用 wind-find-finance-skill 发现万得中与"产量/产能/开工率"相关的数据接口
2. 再使用 wind-mcp-skill 获取最近 ${years} 年的月度产量数据
3. 如果万得无法获取产量数据，尝试从公开源（行业网站、统计局）通过 WebFetch 补充

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataSource": "数据来源说明",
  "monthlyData": [
    { "month": "2024-01", "production": 数值（万吨）, "yoy": 同比变化% },
    ...
  ],
  "capacityUtilization": 最近产能利用率%,
  "trend": "近年产量趋势描述（增/减/稳）",
  "notes": "数据质量说明和局限性"
}`,
    { label: '产量数据', phase: '数据采集' }
  ),

  () => agent(
    `你是期货基本面数据专家。请获取 **${symbol}**（Wind代码：${windCode}）的**进出口数据**。

要求：
1. 通过 wind-mcp-skill 获取最近 ${years} 年的月度进出口量
2. 通过 WebFetch 从中国海关总署网站补充进出口数据
3. 计算净进口量（进口 - 出口）

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataSource": "数据来源说明",
  "monthlyData": [
    { "month": "2024-01", "import": 进口量, "export": 出口量, "netImport": 净进口量 },
    ...
  ],
  "importDependency": 进口依存度%,
  "mainImportSources": ["主要进口来源国1", "来源国2"],
  "trend": "近年进出口趋势描述",
  "notes": "数据质量说明"
}`,
    { label: '进出口数据', phase: '数据采集' }
  ),

  () => agent(
    `你是期货基本面数据专家。请获取 **${symbol}**（Wind代码：${windCode}）的**下游消费数据**。

要求：
1. 通过 wind-mcp-skill 和 wind-find-finance-skill 查找下游行业的需求/消费数据
2. 可用的替代方法：下游行业产量 × 单耗系数倒推消费量
3. 关注下游开工率、订单量等高频指标

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataSource": "数据来源说明",
  "estimationMethod": "消费量估算方法",
  "monthlyData": [
    { "month": "2024-01", "consumption": 预计消费量（万吨） },
    ...
  ],
  "downstreamSectors": [
    { "sector": "下游行业名", "share": 消费占比%, "demandTrend": "趋势" }
  ],
  "trend": "近年消费趋势描述",
  "notes": "估算方法说明和局限性"
}`,
    { label: '下游消费数据', phase: '数据采集' }
  ),

  () => agent(
    `你是期货基本面数据专家。请获取 **${symbol}**（Wind代码：${windCode}）的**库存数据**。

要求：
1. 通过 wind-mcp-skill 获取社会库存（贸易商库存）数据
2. 获取交易所注册仓单数据
3. 计算库存消费比（库存/月消费量）
4. 判断当前库存处于历史什么分位

返回格式（JSON）：
{
  "productName": "${symbol}",
  "dataSource": "数据来源说明",
  "monthlyData": [
    { "month": "2024-01", "socialInventory": 社会库存, "warehouseReceipts": 仓单量 },
    ...
  ],
  "currentInventory": 当前库存量,
  "inventoryConsumptionRatio": 库存消费比（天数）,
  "historicalPercentile": 当前库存在过去${years}年中的分位数%,
  "trend": "库存趋势（累库/去库）",
  "notes": "数据质量说明"
}`,
    { label: '库存数据', phase: '数据采集' }
  ),
])

// Filter out nulls from skipped agents
const validResults = [production, trade, consumption, inventory].filter(Boolean)
if (validResults.length < 2) {
  log('⚠️ 数据获取不完整，仅基于已有数据生成报告')
}

phase('平衡表汇总')

const report = await agent(
  `你是期货基本面高级分析师。请基于以下数据编制 **${symbol}** 的供需平衡表。

## 数据输入

### 产量数据
${JSON.stringify(production, null, 2)}

### 进出口数据
${JSON.stringify(trade, null, 2)}

### 下游消费数据
${JSON.stringify(consumption, null, 2)}

### 库存数据
${JSON.stringify(inventory, null, 2)}

## 任务

生成一份完整的供需平衡表分析报告（Markdown 格式），包含：

### 1. 供需平衡表（表格）
列：月份 | 产量 | 进口 | 出口 | 净进口 | 表观消费 | 库存变化 | 供需缺口
- 表观消费 = 产量 + 净进口 - 库存变化
- 供需缺口 = 产量 + 净进口 - 表观消费

### 2. 供给端分析（200-300字）
- 产量趋势及主要驱动因素
- 进口依赖度评估
- 供给端关键变化点

### 3. 需求端分析（200-300字）
- 下游消费趋势
- 各下游行业景气度
- 需求端关键变化点

### 4. 库存分析（200字）
- 当前库存水平（绝对值和分位数）
- 累库/去库周期判断
- 库存对价格的潜在影响

### 5. 供需格局研判（150字）
- 当前是供过于求还是供不应求
- 供需边际变化方向（改善/恶化）
- 未来 1-3 个月供需格局预判

### 6. 风险提示
- 3-5 条关键风险点

### 7. 追问建议
- 2-3 个可进一步深挖的方向

注意：
- 数据缺失的月份标注 "N/A"
- 不要编造数据，不确定的用"估算"标注
- 报告标题使用：## ${symbol} 供需平衡表分析（YYYY-MM-DD）
- 末尾注明各数据来源`,
  { label: '平衡表汇总分析', phase: '平衡表汇总' }
)

return report
