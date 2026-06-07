# 期货基本面分析 Skill 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建期货基本面分析 Skill 族 — 1 个入口 Skill + 4 个分析 Workflow，覆盖国内商品期货和能源化工品种

**Architecture:** 入口 Skill (`futures-analysis`) 负责解析用户意图并调度 Workflow；4 个独立 Workflow 分别处理供需平衡表、季节性分析、产量预测、价格趋势预测；每个 Workflow 内部通过并行 Agent 拉取 Wind MCP + 公开数据源

**Tech Stack:** Claude Code Skills (.md)、Claude Code Workflows (.js / Workflow API)、Wind MCP Skill、WebFetch

---

## 文件结构

```
.claude/
├── skills/
│   └── futures-analysis.md          # 入口 Skill（创建）
├── workflows/
│   ├── futures-supply-demand.js     # 供需平衡表 Workflow（创建）
│   ├── futures-seasonal.js          # 季节性分析 Workflow（创建）
│   ├── futures-production.js        # 产量预测 Workflow（创建）
│   └── futures-price-trend.js       # 价格趋势预测 Workflow（创建）
└── settings.json                    # 注册 skill（创建）
```

---

### Task 1: 创建入口 Skill

**Files:**
- Create: `.claude/skills/futures-analysis.md`

- [ ] **Step 1: 写入入口 Skill 文件**

```markdown
---
name: futures-analysis
description: 期货基本面分析 — 供需平衡表、季节性分析、产量预测、价格趋势预测。覆盖国内商品期货与能源化工品种。Wind 数据为主，公开数据源补充。
---

# 期货基本面分析

当用户请求分析期货品种基本面时触发。支持：螺纹钢、铁矿石、PTA、甲醇、原油等主要国内商品期货及能源化工品种。

## 核心职责

你只负责三件事：**解析意图 → 确认模糊项 → 调度 Workflow**。不要自己分析数据，数据由 Workflow 拉取。

## 品种映射表

| 简称 | 全称 | Wind 代码 |
|------|------|-----------|
| 螺纹/螺纹钢/rb | 螺纹钢 | RB |
| 热卷/热轧卷板/hc | 热轧卷板 | HC |
| 铁矿/铁矿石/i | 铁矿石 | I |
| 焦炭/j | 焦炭 | J |
| 焦煤/jm | 焦煤 | JM |
| 动力煤/zc | 动力煤 | ZC |
| PTA/TA/ta | PTA | TA |
| 甲醇/MA/ma | 甲醇 | MA |
| 原油/sc | 中质含硫原油 | SC |
| 沥青/bu | 沥青 | BU |
| 塑料/L/l | LLDPE | L |
| PP/聚丙烯/pp | 聚丙烯 | PP |
| PVC/v | PVC | V |
| 橡胶/ru | 天然橡胶 | RU |
| 豆粕/m | 豆粕 | M |
| 豆油/y | 豆油 | Y |
| 棕榈油/p | 棕榈油 | P |
| 白糖/sr | 白糖 | SR |
| 棉花/cf | 棉花 | CF |
| 玉米/c | 玉米 | C |
| 生猪/lh | 生猪 | LH |
| 铜/cu | 沪铜 | CU |
| 铝/al | 沪铝 | AL |
| 锌/zn | 沪锌 | ZN |
| 鸡蛋/jd | 鸡蛋 | JD |
| 苹果/ap | 苹果 | AP |
| 纯碱/sa | 纯碱 | SA |
| 玻璃/fg | 玻璃 | FG |
| 尿素/ur | 尿素 | UR |

## 分析类型映射

| 用户表述 | Workflow 文件 |
|----------|--------------|
| 供需/平衡表/供给/需求/上游/下游 | futures-supply-demand |
| 季节性/季节规律/淡季/旺季/月度规律 | futures-seasonal |
| 产量/预测/产能/供给预测 | futures-production |
| 价格/趋势/走势/方向/多空/涨跌 | futures-price-trend |
| 全面/全套/完整/综合/深度 | 全部四个 |

## 执行流程

### Step 1: 解析输入

从用户消息中提取三个要素：
1. **品种** — 在映射表中查找（大小写不敏感）
2. **分析类型** — 关键词匹配
3. **参数** — 时间范围（默认 3 年）、预测周期（默认 3 个月）

### Step 2: 确认模糊项

- 品种不明确 → 列出匹配项，用 AskUserQuestion 让用户选择
- 分析类型不明确 → 列出四种分析 + 全套，让用户选择
- 明确则跳过，直接进入 Step 3

### Step 3: 调度 Workflow

使用 Workflow 工具启动对应的 workflow 文件。

**单个分析**：
直接调用 Workflow，传入品种参数：
```
Workflow({
  scriptPath: ".claude/workflows/futures-{type}.js",
  args: { symbol: "品种名", windCode: "Wind代码", period: "3Y", forecastMonths: 3 }
})
```

**全套分析**：
依次执行四个 Workflow，每个完成后展示摘要。执行顺序：供需 → 季节性 → 产量预测 → 价格趋势。
价格趋势的 args 中设置 `reuseFundamental: true` 以复用供需分析结果。

### Step 4: 展示结果与追问提示

Workflow 完成后，展示返回的报告。在报告末尾添加追问建议：
- "💬 你可以追问：'展开 XX 数据来源' / '换个时间范围看看' / '比较其他品种'"

### 追问处理

- "展开 XX" → 说明该数据来自哪个 Agent、数据源和获取方式
- "换个时间范围 5 年" → 重新调用同一 Workflow，修改 period 参数
- "比较 XX 品种" → 对两个品种分别执行分析，对比结果
```

- [ ] **Step 2: 验证文件已创建**

```bash
test -f .claude/skills/futures-analysis.md && echo "OK" || echo "FAIL"
```

- [ ] **Step 3: 提交**

```bash
git add .claude/skills/futures-analysis.md
git commit -m "feat: 添加期货分析入口 Skill"
```

---

### Task 2: 创建供需平衡表 Workflow

**Files:**
- Create: `.claude/workflows/futures-supply-demand.js`

- [ ] **Step 1: 写入供需平衡表 Workflow 文件**

```javascript
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
```

- [ ] **Step 2: 验证文件已创建**

```bash
test -f .claude/workflows/futures-supply-demand.js && echo "OK" || echo "FAIL"
```

- [ ] **Step 3: 提交**

```bash
git add .claude/workflows/futures-supply-demand.js
git commit -m "feat: 添加供需平衡表分析 Workflow"
```

---

### Task 3: 创建季节性分析 Workflow

**Files:**
- Create: `.claude/workflows/futures-seasonal.js`

- [ ] **Step 1: 写入季节性分析 Workflow 文件**

```javascript
export const meta = {
  name: 'futures-seasonal',
  description: '期货品种季节性分析 — 价格季节性、价差季节性、供需季节性',
  phases: [
    { title: '数据采集', detail: '并行拉取价格、价差、供需三组季节性数据' },
    { title: '季节性研判', detail: '交叉验证生成季节性综合判断' },
  ],
}

const { symbol, windCode, period } = args
const years = period ? parseInt(period) : 5

phase('数据采集')

const [priceSeasonal, spreadSeasonal, sdSeasonal] = await parallel([
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

const validResults = [priceSeasonal, spreadSeasonal, sdSeasonal].filter(Boolean)
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
```

- [ ] **Step 2: 验证文件已创建**

```bash
test -f .claude/workflows/futures-seasonal.js && echo "OK" || echo "FAIL"
```

- [ ] **Step 3: 提交**

```bash
git add .claude/workflows/futures-seasonal.js
git commit -m "feat: 添加季节性分析 Workflow"
```

---

### Task 4: 创建产量预测 Workflow

**Files:**
- Create: `.claude/workflows/futures-production.js`

- [ ] **Step 1: 写入产量预测 Workflow 文件**

```javascript
export const meta = {
  name: 'futures-production',
  description: '期货品种产量预测 — 趋势外推、季节性修正、利润驱动、多因子加权',
  phases: [
    { title: '数据采集', detail: '并行拉取历史趋势、利润模型、季节+政策三组数据' },
    { title: '产量预测', detail: '多因子加权预测与情景分析' },
  ],
}

const { symbol, windCode, period, forecastMonths } = args
const years = period ? parseInt(period) : 3
const months = forecastMonths || 3

phase('数据采集')

const [trendData, profitModel, seasonalPolicy] = await parallel([
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

const validResults = [trendData, profitModel, seasonalPolicy].filter(Boolean)
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
```

- [ ] **Step 2: 验证文件已创建**

```bash
test -f .claude/workflows/futures-production.js && echo "OK" || echo "FAIL"
```

- [ ] **Step 3: 提交**

```bash
git add .claude/workflows/futures-production.js
git commit -m "feat: 添加产量预测 Workflow"
```

---

### Task 5: 创建价格趋势预测 Workflow

**Files:**
- Create: `.claude/workflows/futures-price-trend.js`

- [ ] **Step 1: 写入价格趋势预测 Workflow 文件**

```javascript
export const meta = {
  name: 'futures-price-trend',
  description: '期货品种价格趋势预测 — 基本面+技术面+资金面多因子打分',
  phases: [
    { title: '因子打分', detail: '并行计算基本面、技术面、资金面三组得分' },
    { title: '综合研判', detail: '加权汇总输出多空信号与关键价位' },
  ],
}

const { symbol, windCode, period, forecastMonths, reuseFundamental } = args
const years = period ? parseInt(period) : 3
const months = forecastMonths || 3

phase('因子打分')

const [fundamentalScore, technicalScore, capitalScore] = await parallel([
  () => agent(
    `你是期货基本面分析专家。请对 **${symbol}**（Wind代码：${windCode}）进行**基本面因子打分**。

要求：
1. 通过 wind-mcp-skill 和 wind-find-finance-skill 获取以下数据：
   - 库存数据（社会库存、仓单）及历史分位数
   - 生产利润（当前利润水平 vs 历史区间）
   - 基差（现货-期货价差）
   - 上下游开工率
2. 如果 ${reuseFundamental ? '提供了' : '未提供'} 已有的供需分析结果，请${reuseFundamental ? '参考使用' : '自行估算供需缺口'}

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

const validResults = [fundamentalScore, technicalScore, capitalScore].filter(Boolean)
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
```

- [ ] **Step 2: 验证文件已创建**

```bash
test -f .claude/workflows/futures-price-trend.js && echo "OK" || echo "FAIL"
```

- [ ] **Step 3: 提交**

```bash
git add .claude/workflows/futures-price-trend.js
git commit -m "feat: 添加价格趋势预测 Workflow"
```

---

### Task 6: 注册 Skill 与最终验证

**Files:**
- Create: `.claude/settings.json`

- [ ] **Step 1: 创建 settings.json 注册 skill**

当前项目只有 `settings.local.json`，需要创建 `settings.json` 来注册自定义 skill 和 workflow。

```json
{
  "skills": {
    "futures-analysis": {
      "path": ".claude/skills/futures-analysis.md",
      "description": "期货基本面分析 — 供需、季节性、产量预测、价格趋势"
    }
  },
  "workflows": {
    "futures-supply-demand": {
      "path": ".claude/workflows/futures-supply-demand.js",
      "description": "供需平衡表分析"
    },
    "futures-seasonal": {
      "path": ".claude/workflows/futures-seasonal.js",
      "description": "季节性分析"
    },
    "futures-production": {
      "path": ".claude/workflows/futures-production.js",
      "description": "产量预测"
    },
    "futures-price-trend": {
      "path": ".claude/workflows/futures-price-trend.js",
      "description": "价格趋势预测"
    }
  }
}
```

- [ ] **Step 2: 验证所有文件存在**

```bash
echo "=== 文件检查 ==="
for f in \
  .claude/skills/futures-analysis.md \
  .claude/workflows/futures-supply-demand.js \
  .claude/workflows/futures-seasonal.js \
  .claude/workflows/futures-production.js \
  .claude/workflows/futures-price-trend.js \
  .claude/settings.json; do
  if test -f "$f"; then echo "✅ $f"; else echo "❌ $f 缺失"; fi
done
echo "=== 目录结构 ==="
find .claude -type f | sort
```

- [ ] **Step 3: 提交**

```bash
git add .claude/settings.json
git commit -m "feat: 注册期货分析 Skill 与 Workflow"
```

- [ ] **Step 4: 验证 git 状态**

```bash
git log --oneline -6
echo "---"
git status
```

---

## Self-Review

### 1. Spec Coverage
- ✅ 入口 Skill（第 3 节） → Task 1
- ✅ 供需平衡表 Workflow（第 4 节） → Task 2
- ✅ 季节性分析 Workflow（第 5 节） → Task 3
- ✅ 产量预测 Workflow（第 6 节） → Task 4
- ✅ 价格趋势预测 Workflow（第 7 节） → Task 5
- ✅ 数据层（第 8 节） → 在各 Workflow 的 Agent 中引用 wind-mcp-skill + WebFetch
- ✅ 报告格式（第 9 节） → 各 Workflow 的 Synthesizer Agent 中定义模板
- ✅ 文件结构（第 10 节） → 与 Task 1-6 完全对应
- ✅ 依赖声明（第 10.2 节） → 在 Workflow Agent 指令中引用

### 2. Placeholder Scan
- ✅ 无 "TBD" / "TODO"
- ✅ 无 "implement later"
- ✅ 无 "add appropriate error handling"（已有 filter(Boolean) 处理）
- ✅ 所有代码步骤包含完整可执行内容
- ✅ 所有 JSON 返回 schema 完整定义
- ✅ 所有 agent prompt 包含完整指令

### 3. Type Consistency
- ✅ `args` 参数在各 Workflow 中统一使用 `symbol`, `windCode`, `period`, `forecastMonths`
- ✅ 价格趋势 Workflow 额外使用 `reuseFundamental` 参数
- ✅ 各 Agent label 与 phase 声明一致
- ✅ JSON 返回 schema 字段名在各 Synthesizer 中引用一致
