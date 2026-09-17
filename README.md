# Pelican Bicycle

22 个鹈鹕骑自行车动画版本的本地预览与对比入口。原始 HTML 集中放在 `animations/` 文件夹中，入口 `index.html` 保留在项目根目录。

直接打开 `index.html` 即可使用，不需要安装依赖。也可以在目录中运行：

```sh
python3 -m http.server 18777 --bind 127.0.0.1
```

访问 <http://127.0.0.1:18777>。

“全部动画”页面位于 `pages/gallery.html`，可从顶部导航进入，或访问 <http://127.0.0.1:18777/pages/gallery.html>。它在同一页以响应式网格加载全部 22 个动画，每个作品独立播放，并提供原页和放大查看入口。新作品更新目录后也会自动出现在该页面。

- 左侧选择目标画面 A / B，然后点击版本进行替换。
- 支持单版预览、双版对比、交换位置、同时重新载入，以及前后切换。
- 搜索支持名称匹配；按 `/` 聚焦搜索，按 `Esc` 清空。
- 当前版本和预览模式保存在地址片段中，刷新或复制地址可保留选择。
- 每个作品都在 1000 × 650 的隔离 iframe 中运行，并随容器等比缩放；窄屏下上下排列。
- 重播代表同时重新载入，不保证不同实现的动画逐帧同步。
- 预览只加载当前可见的 1–2 个作品；单版模式移除第二个预览以减少动画开销。

点击“原页”可在新标签打开未经包装的作品。部分作品存在自己的固定尺寸或外部字体，最终表现以原页为准。

## 目录结构

```text
index.html                  预览与对比入口
README.md                   项目说明
animations/                 22 个原始动画
pages/                      全部动画页面
assets/css/                 页面样式
assets/js/                  页面交互与用量展示脚本
data/                       原始创建日期与汇率快照
data/generated/             页面读取的版本目录和用量数据
data/raw/                   本地 CSV 导出及本机临时文件（不上传）
scripts/                    目录与用量数据生成脚本
```

Git 元数据仍在隐藏的 `.git/` 目录。根目录仅保留 `index.html` 和 `README.md` 两个文件。

## 添加作品

将新的 `.html` 作品放到 `animations/` 文件夹，然后执行：

```sh
python3 scripts/update-catalog.py
```

刷新入口即可看到新版本。`data/generated/models.js` 是生成的文件，名称直接取自文件名，不代表对模型身份或能力的验证。

## Token 与费用标注

预览页和全部动画页按各作品的原始创建日期，从本地两份 CSV 匹配该模型当天的 Token 和 Usage。Token 使用 K（1 K = 1,000 tokens），保留最多两位小数。页面同时显示创建日期。这是模型当天的用量，可能包含当天其他请求。

原始文件创建日期按 Europe/Berlin 时区从 macOS `st_birthtime` 提取并固定在 `data/animation-dates.json`。重新克隆、复制或修改文件不会改变统计日期。CSV 的日期列直接与创建日期匹配，源文件未提供时区转换信息。添加作品时需将其原始创建日期补入该文件，不能用克隆日期代替。

已确认 CSV 的 Usage 原始币种是 USD。费用根据 `data/fx-rates.json` 保存的 ECB 汇率换算为人民币：`RMB = USD × (每欧元人民币 / 每欧元美元)`。优先使用创建当天的汇率；当天尚未公布或休市时使用此前最近的汇率，超过七天则要求更新汇率快照。当前快照为 2026-09-16（1 EUR = 1.1537 USD = 7.738 CNY），因此 9 月 17 日作品暂用该日汇率，页面明确标注。参考来源：https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml 。

```sh
python3 scripts/update-usage.py
```

脚本按“创建日期＋CSV 模型名称”精确取值，通过 `MODEL_MAP` 显式对应作品。已确认的三组别名也计入统计：DeepSeek4.1 → DeepSeek V4.1 Flash、bytedance-seed → Seed 2.1 Turbo、Tencent-hy4 → Hy4 preview。

缺失的 Token 或 Usage 分别保留为空，页面显示“暂无数据”；不使用 `Other` 补足，也不把缺失记录当作 0。汇率和费用以十进制计算；人民币显示为参考折算值，最多四位小数。卡片保留原始美元金额、实际采用的汇率和汇率日期，悬停数字可查看精确值。数据快照 `data/generated/usage-data.js` 包含对应作品的统计、来源、创建日期和换算依据；原始 CSV 保存在 `data/raw/`，继续留在本机并由该目录的 `.gitignore` 排除。新作品、CSV 或汇率快照更新后，请重新运行该脚本。
