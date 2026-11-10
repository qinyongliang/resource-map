---
name: resource-map
description: Build and maintain a project-local linked Markdown graph of resources, notes, journals, mind maps and any other related data under <project>/.resource-map. Use when mapping infrastructure or operational assets (servers, services, databases, websites, pipelines, networks, identity, cloud resources, message queues, container platforms), when modeling narrative or notebook material (novels, chapters, entities, events, actions, timelines), when relating arbitrary notes, or when validating, indexing and querying an existing .resource-map.
---

# 资源地图 (Resource map)

把散落在项目各处的知识，整理成一张有证据、可共享、并且就存放在项目内部的关系图。
每个节点都是一个 Markdown 文件，每条关系都是一个不依赖任何工具就能读懂的双链。

> Source: <https://github.com/qinyongliang/resource-map> (the `skill` branch).
> The `main` branch ships the same tool as a DSH plugin named 资源地图.

## 内容位置

**本技能的全部内容都放在 `.resource-map/` 目录下，和 DSH 插件完全相同。**
把它整体复制到目标项目根目录即可使用：

```text
<项目>/
└── .resource-map/
    ├── config.json                 允许的 kind / environment / status
    ├── runbooks/okf-resource-contract.md   严格 OKF 契约
    ├── examples/                   最小可用示例
    ├── skills/                     公开方法参考与维护流程
    ├── templates/resource-skills/  27 种资源类型的模板
    ├── tools/                      自包含 CLI（resource-graph.mjs + lib/）
    ├── resources/                  你自己的资源节点存放处
    └── .gitignore                  只忽略可再生的 graph.sqlite 缓存
```

节点创建在 `.resource-map/resources/<kind>/<environment>/<id>/index.md`，
每份记录都是带严格 OKF frontmatter 的完整上下文单元。

## 入口选择：优先工具，回退到 CLI

| 运行环境 | 入口 |
| --- | --- |
| 已启用本插件的 DSH | `resource_graph_check` 与 `resource_graph_query` 工具 |
| 其它 Agent、编辑器、CI 或普通终端 | `.resource-map/tools/resource-graph.mjs` |

两者是同一份实现、读写同一个 `.resource-map/graph.sqlite` 缓存；CLI 直接接受 DSH 的工具名，因此为一种环境写的指令在另一种环境同样成立：

```bash
node .resource-map/tools/resource-graph.mjs init  --root <项目>
node .resource-map/tools/resource-graph.mjs resource_graph_check --root <项目> --write-index --json
node .resource-map/tools/resource-graph.mjs resource_graph_query --root <项目> --query "checkout" --json
```

`resource_graph_check` 对应 `check`，`resource_graph_query` 对应 `query`。要求 Node.js 22.5 或更高版本，无 `node_modules` 依赖，也不使用 Python。

## 工作流

1. **把 `.resource-map/` 放进项目。** 复制本目录到项目根；如果只想刷新工具与模板，执行 `resource-graph.mjs init --root <项目>`。
2. **先读契约。** 阅读 `.resource-map/runbooks/okf-resource-contract.md`，并照抄 `.resource-map/examples/minimal-resource/index.md` 的结构；不要凭记忆写 frontmatter。
3. **选类型。** 遇到新领域或节点边界不清时，先读 `.resource-map/skills/resource-kind-design/SKILL.md`，再用 `.resource-map/templates/resource-skills/<kind>/` 下对应模板。
4. **一个资源一个节点。** 在 `.resource-map/resources/<kind>/<environment>/<id>/index.md` 落盘，需要运行入口时同时写 `scripts/.env`。
5. **用双链表达关系**，而不是散文。使用严格的 `## 图引用` 列表（`- relation: [[node-id]]`），带属性的边写入 `resource.relationships`。
6. **校验并建立索引。** 运行 `check --write-index`；对每条报错都要读文件、修复、重跑，不要绕过或重复报错。
7. **先查询再大范围搜索。** 用 `query` 定位节点与关系，不要一上来就全局 grep。
8. **收尾。** 可复用流程写入该资源的 `skill/`，不确定项写入 `discoveries/`，实际操作写入 `oplog/`，方法见 `.resource-map/skills/resource-map-maintenance/SKILL.md`。

## 必须遵守的规则

- `.resource-map/resources/**/index.md` 是唯一的图内容来源。不要手写 `graph.sqlite`，它是可再生的缓存。
- 使用稳定的 kebab-case ID；不要把目录路径当作双链目标。
- 未知事实写 `unknown`，缺失集合写空值。不要从名称、相似环境或过期文档推断拓扑。
- 操作日志按日期分类：每条记录是一个文件 `oplog/YYYY-MM-DD-<topic>.md`，`YYYY-MM-DD` 前缀是操作发生的本地日期，强制必填；不同日期新建文件，不要追加到旧条目。
- 不要写入密钥：token、私钥、口令、cookie、连接串或私有端点都不行；运行入口只放在资源的 `scripts/.env`。
- 默认只读。重启、部署、改配置、写 SQL、改数据、轮换凭证，以及改 DNS、防火墙、负载均衡、IAM 或云资源，都必须有用户明确指令，并写入操作日志。
- 发布安全靠检查而不是假设：保持示例为虚构，并在共享前按 `.resource-map/skills/resource-map-maintenance/references/public-release-gate.md` 过一遍。

## 该读什么

| 需要 | 阅读 |
| --- | --- |
| frontmatter 与 `## 图引用` 的准确形状 | `.resource-map/runbooks/okf-resource-contract.md` |
| 最小可用记录 | `.resource-map/examples/minimal-resource/index.md` |
| 界定未知领域或新类型 | `.resource-map/skills/resource-kind-design/SKILL.md` |
| 范围界定、授权与证据纪律 | `.resource-map/skills/resource-map-maintenance/references/intake-and-scope.md`、`evidence-and-uncertainty.md` |
| 安全的元数据发现 | `.resource-map/skills/resource-map-maintenance/references/safe-metadata-discovery.md` |
| 源码、部署与依赖分析 | `.resource-map/skills/resource-map-maintenance/references/source-and-deployment-analysis.md` |
| 根因闭环 | `.resource-map/skills/resource-map-maintenance/references/investigation-and-root-cause.md` |
| 可移植的资源脚本 | `.resource-map/skills/resource-map-maintenance/references/portable-script-contract.md` |
| 实践后的进化 | `.resource-map/skills/resource-map-maintenance/SKILL.md`、`references/evolution-closeout.md` |
| 某个具体类型 | `.resource-map/templates/resource-skills/<kind>/SKILL.md` |

## 与 DSH 插件的关系

本技能与 DSH 插件「资源地图」(`dsh-resource-map`) 携带同一套实现与同一套方法论，
内容都位于 `.resource-map/` 下。由任一面初始化或维护过的项目，在另一面都可以直接继续使用：
插件只对已包含 `.resource-map` 的项目注册它的两个工具，并在初始化时刷新 `.resource-map/tools/`，
使 CLI 不会与工具脱节。
