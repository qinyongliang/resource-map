const boundary = `## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。\n`

const templates = {
  server: [`# Server Resource Skill Template

主动核验主机身份、OS/内核、uptime、CPU/内存/文件系统、监听端口及进程、systemd、cron、浅层部署目录和容器运行时。发现独立服务、数据库、Redis、MQ、注册中心、K8s、代理、网站和调度器后，继续创建独立资源上下文单元，不把所有事实堆在服务器 index.md。\n${boundary}`, `# Server Discovery Reference

记录有界命令、证据时间、监听到进程映射、容器摘要、发现缺口和排除项。禁止递归扫描大型 volume/data 目录。`],
  service: [`# Service Resource Skill Template

Model one independently operated runtime instance or cluster. Establish runtime identity, engine/version, lifecycle owner, hosting boundary, listeners, health, logs, deployment provenance, maintenance and backup entry, upstream/downstream dependencies and consuming projects/systems. A container is evidence for a service, not automatically a second service node. Separate logical database, cache, queue, registry name or website when it has independent identity or workflow.\n${boundary}`, `# Service Read-only Discovery

Begin from the approved scripts/.env entry. Correlate process/container/workload metadata, bounded listener-to-process projection, health endpoint metadata, restart policy, shallow mounts, log configuration and current build/image/commit evidence. Do not dump Env, full logs, configuration values, request payloads or business data. Health passing proves only the health probe. Record evidence time, exclusions, unresolved owner/version mismatches and the next bounded check.`],
  system: [`# System Resource Skill Template

Model a business or operational boundary that aggregates projects, websites, services, servers, databases, message queues and shared dependencies. A system is not a duplicate inventory: it explains component roles, entrypoints, data/request flows, environment boundaries, logging/inspection coverage and ownership. Create it only when the aggregation has independent meaning, lifecycle or operational workflow.\n${boundary}`, `# System Aggregation Reference

Reconcile component IDs through typed edges; distinguish source projects from runtime instances and shared dependencies from environment-specific ones. Require a logging collection or inspection entry for each important path; missing entries remain planned gaps. Do not infer an environment's topology from another environment or copy credentials into the system resource.`],
  ops_document: [`# Operations Document Resource Skill Template

Import only reusable operational material such as installation, deployment, account-entry, certificate, database, server, API or troubleshooting guidance. Capture source metadata, scope, sensitivity classification, exploration status and evidence-backed resource associations. Media, task progress, bug workflow, test noise and pure project-management material are not operations-document resources.\n${boundary}`, `# Operations Document Discovery Reference

Inspect document/table metadata before content, and for sheets record whether headers were checked. Store secrets only in the owning scripts/.env or approved secret store, never Markdown. Associations remain candidate or unresolved until the document content and target resource identity agree. Preserve source locator without authentication data.`],
  cloud_provider: [`# Cloud Provider Resource Skill Template

Model a provider capability and its confirmed account topology, supported API/CLI entry and regions. Do not flatten every region, network or product into nodes: promote only objects with independent entry, lifecycle, reuse, access rules, risk or inspection workflow.\n${boundary}`, `# Cloud Provider Discovery Reference

Use an approved read-only account entry to enumerate identity-safe provider metadata and region/product counts. Never print profiles, tokens, secret keys, signed requests or full policies. Map provider capabilities to existing accounts/projects/systems with evidence and keep unconfirmed regions or ownership in discoveries.`],
  cloud_provider_account: [`# Cloud Provider Account Resource Skill Template

Model one account or tenant without secrets: parent provider, non-secret account identity/profile label, account type, regions, inspection status and mapped resources. Credentials stay in this account's scripts/.env or approved external store.\n${boundary}`, `# Cloud Account Read-only Reference

Start with identity/who-am-I and explicit region scoping, then bounded inventory summaries for compute, networking, storage, database and load-balancing metadata. Record counts and stable resource identifiers only when safe. Creation, deletion, policy/IAM/network/firewall changes and credential rotation require explicit authorization.`],
  cloud_resource: [`# Cloud Resource Skill Template

Promote a cloud object only when it has stable identity and an independent lifecycle, relationship, access boundary, risk or inspection method. Otherwise keep region/VPC/subnet/security metadata on its owning account or runtime resource.\n${boundary}`, `# Cloud Resource Discovery Reference

Capture provider/account/region, resource type, lifecycle state, non-secret network/access summary, tags needed for ownership, and links to consuming resources. Never copy full IAM policies, user data, secret values, object contents or provider-generated credentials.`],
  project: [`# Project Resource Skill Template

主动分析授权源码或部署包的 Git/manifest、模块、Dockerfile/Compose/K8s、CI、启动脚本、健康接口、日志配置、迁移/DDL，以及数据库、Redis、MQ、搜索、对象存储、注册中心和调度依赖。依赖包只证明能力，源码配置加运行证据才能证明实际使用。\n${boundary}`, `# Project Analysis Reference

记录仓库/commit、manifest、部署文件、配置键名、入口和依赖证据；不保存密钥、完整连接串或源码中的敏感值。`],
  docker: [`# Docker Resource Skill Template

只读盘点 Docker/Compose 的版本、容器名、镜像、状态/health、端口、restart policy、mount、network、labels 和 Compose project。只使用 inspect 投影，禁止转储 Env。每个有独立生命周期的容器运行服务与 backing resource 建独立资源并维护 hosts/runs_on/depends_on。\n${boundary}`, `# Docker Inspection Reference

保留容器元数据摘要、Compose 边界、端口和 mount 证据。禁止 docker exec 业务命令、logs 全量读取、pull/restart/prune。`],
  database_namespace: [`# Database Namespace Resource Skill Template

Model one logical database or schema under a database runtime. Inherit the parent runtime entry and credentials; never copy a DSN. Record parent_database_id, engine-native name, namespace slug, purpose, size/object-count summaries, DDL provenance, sensitivity and evidence-backed users.\n${boundary}`, `# Database Namespace Metadata Reference

Use catalogs/information_schema under read-only transaction and short statement timeout. Collect schema/database identity, comments, object types/counts, aggregate size and grants/roles only as sanitized summaries. No business rows. DDL artifacts must be schema-only, timestamped, provenance-labeled and free of credentials.`],
  database_table: [`# Database Table Resource Skill Template

Promote a table/view only when it has independent operational, dependency, DDL, sensitivity, capacity or troubleshooting value. Inherit the parent database entry. Record parent IDs/slugs, object type, purpose, columns/index/constraint summary, approximate size/statistics, DDL provenance and evidence-backed usage.\n${boundary}`, `# Database Table Metadata Reference

Inspect catalogs, comments, indexes, constraints, relation estimates and aggregate sizes with timeout. Never sample business rows by default and never store full sensitive SQL. Compare live DDL with migration/ORM evidence when available and record conflicts rather than selecting one source silently.`],
  message_queue: [`# Message Queue Resource Skill Template

Model an abstract messaging capability separately from its broker service. Identify backend type, backing service, stable destinations, producer/consumer systems and channels. Ownership requires source, runtime connection, deployment or authenticated consumer evidence; names and consumer counts alone are insufficient.\n${boundary}`, `# Message Queue Discovery Reference

Recognize RabbitMQ, Kafka, RocketMQ, ActiveMQ, Pulsar and Redis messaging. Use read-only broker/vhost/topic/queue/exchange/binding/group/consumer/connection/alarm metadata. Dynamic or tenant-generated destinations remain discoveries until stable identity is proved. Never consume, publish, acknowledge, replay or purge messages.`],
  mq_channel: [`# MQ Channel Resource Skill Template

Model a stable queue, topic, exchange or stream under one message_queue. Record parent_mq_id, type, raw name, stable slug, durability/retention/partition properties, bounded depth/rate metadata, users, bindings and evidence time. Broker endpoint and credentials remain on the backing service.\n${boundary}`, `# MQ Channel Metadata Reference

Collect metadata only: existence, type, durability/auto-delete/exclusive, partitions, retention, depth, consumers and bindings as supported. Do not read payloads or infer ownership from the destination name. High-cardinality ephemeral names stay aggregated in discoveries.`],
  mq_route: [`# MQ Route Resource Skill Template

Model one evidence-backed producer, consumer or binding route under a channel. Record parent IDs/slugs, route type, project/system endpoint, target channel, routing selector and non-secret properties. Create a route only when source/runtime/management evidence identifies both ends.\n${boundary}`, `# MQ Route Reconciliation Reference

Reconcile declarations/listeners/templates with broker bindings, groups or authenticated connections. Record evidence, confidence and unresolved dynamic selectors. Do not expose credentials, message bodies or full connection strings, and do not publish/consume test messages without explicit authorization.`],
  redis: [`# Redis Resource Skill Template

读取 INFO server/memory/clients/stats/persistence/keyspace、DBSIZE、replication、cluster/sentinel 和有界 prefix/type 元数据。禁止 KEYS、读取 value、DUMP、MONITOR、写命令或故障转移。识别稳定 DB/prefix/stream/list/PubSub 后，将虚拟缓存或 MQ 对象建为独立资源，使用源码和运行证据关联生产者/消费者。\n${boundary}`, `# Redis Read-only Reference

允许 INFO、DBSIZE、有界 SCAN+TYPE、PUBSUB CHANNELS/NUMSUB、XLEN/XINFO/LLEN。禁止 GET/MGET/HGET/SMEMBERS/LRANGE/XRANGE/SUBSCRIBE 及任何写命令。`],
  mq: [`# MQ Runtime Inspection Compatibility Template

先识别 RabbitMQ/Kafka/RocketMQ/ActiveMQ。只读获取 broker、vhost、topic/queue、partition、exchange、binding、route、consumer/group、connection 和 alarm 元数据。broker 运行服务与虚拟 MQ/channel/route 分层建模，项目生产/消费关系必须有源码、运行连接或管理面证据。\n${boundary}`, `# MQ Read-only Reference

RabbitMQ 使用 overview/vhost/queue/exchange/binding/consumer metadata；Kafka 使用 cluster/topic/partition/group metadata；RocketMQ/ActiveMQ 使用 broker/topic/queue/consumer metadata。禁止读取、发布、确认或清理消息。`],
  registry: [`# Registry Resource Skill Template

识别 Nacos、Consul、Etcd、ZooKeeper，读取成员、namespace、catalog/service、instance、health/check 和配置 key 名元数据。运行注册中心与虚拟 service-name/namespace 分层建模；host:port、健康检查和运行服务证据一致后才能确认归属。\n${boundary}`, `# Registry Read-only Reference

只保存 service 名、实例地址、tag、健康和配置键名摘要；禁止输出配置值、ACL/token、session secret，禁止注册/注销或修改配置。`],
  kubernetes: [`# Kubernetes Resource Skill Template

在授权 context 中只读盘点 cluster/version/node、namespace、workload、service、ingress、endpoint、PVC、ConfigMap 名、Secret 名、job 和有界 events。cluster、workload、service/ingress、持久化和外部依赖分层建模，并关联部署项目。\n${boundary}`, `# Kubernetes Read-only Reference

禁止读取 Secret 值或全量 dump manifest。apply/delete/rollout/scale/exec/port-forward 均属于变更或额外触达，必须授权。`],
  database: [`# Database Resource Skill Template

识别引擎/版本/角色、实例、逻辑库/schema、容量、连接/活动摘要、复制、备份元数据和 DDL。运行实例、逻辑库和重要表/view 分层建模；项目使用关系需源码配置与运行连接证据闭合。\n${boundary}`, `# Database Read-only Reference

只保存脱敏 SQL 形态、统计和 DDL 摘要，不输出密码、完整 SQL、业务行。写 SQL、kill session、schema 变更、备份恢复需授权。`],
  novel: [`# Novel Resource Skill Template

Start from the complete source text, detect volume/chapter boundaries, encoding, omissions and duplicated headings, then preserve the original chapter text as the body of one chapter resource. The novel node is only the work-level identity and aggregation root. Any analysis spanning multiple ordered chapters and extracting events must create at least one chapter-order \`kind: timeline\` resource in the same quality-gated batch; every extracted event with known chapter scope must join it through an attributed edge carrying start/end/label/precision/certainty. Never write derived nodes directly to SQLite. Sample a few chapters first and evolve the kind skills before scaling to the whole book.\n${boundary}`, `# Novel Analysis Reference

Required layers are novel -> volume -> chapter -> evidence-backed entity/event/action -> timeline. For a multi-chapter event extraction batch, the deliverable is incomplete until a chapter-order timeline resource and attributed placements for every chapter-scoped event exist. This is a professional Skill quality gate, not a universal \`resource_graph_check\` validator rule. A chapter is one context unit with full text and stable heading/block anchors. Do not create chapter-resource copies, generic binding nodes, one node per keyword hit, or co-occurrence edges without semantic evidence. Keep raw source provenance and analysis status explicit.`],
  volume: [`# Volume Resource Skill Template

Create a volume only when the source has a stable named/numbered division or the analyst declares a reviewable editorial partition. It aggregates chapters and records the volume arc after its chapters have been read; it must not duplicate chapter bodies or pretend that an opening excerpt summarizes the volume.\n${boundary}`, `# Volume Analysis Reference

Relate chapters with belongs_to/contains and the novel with part_of. Record arc, turning points, unresolved threads and confidence from chapter evidence. Do not promote every batch or agent work chunk into a volume.`],
  chapter: [`# Chapter Resource Skill Template

One chapter resource owns the complete chapter Markdown body. Read the whole chapter before extracting a concise synopsis, scene transitions, participants, state changes, explicit reveals, conflicts and unresolved clues. Add stable block IDs to the exact evidence paragraphs used by graph edges. A chapter is not duplicated as chapter-resource or binding.\n${boundary}`, `# Chapter Analysis Reference

Admission gate: preserve full text; identify volume/chapter order; provide previous/next and belongs_to edges; when a reviewed batch spans multiple chapters, ensure its chapter-order timeline exists and chapters/events with known ranges receive attributed placements; attach only evidence-backed entity/event/action edges with anchors such as [[chapter-id#^evidence-id]]. Keyword occurrence alone stays in prose or discoveries and does not create an edge. Mark shallow/unread analysis as draft rather than claiming completion.`],
  entity: [`# Narrative Entity Resource Skill Template

Use entity for a persistent person, organization, place, object, identity, concept or mystery that recurs or carries state across scenes. Prefer specific sub-kinds such as character, organization, place or artifact when justified. Merge aliases into one identity and record alias evidence; do not create a node for every noun or every mention.\n${boundary}`, `# Entity Analysis Reference

Admission gate: an entity needs stable identity plus at least two meaningful appearances, an independent relationship/state, or explicit user importance. Record first evidence, aliases, knowledge/state changes and typed relations. Mention edges point to chapter anchors; inferred identity remains provisional with competing evidence.`],
  event: [`# Narrative Event Resource Skill Template

Create an event only for a bounded change that matters beyond one sentence: it changes state, reveals information, causes later action, joins multiple entities, or anchors a narrative/historical timeline. State what changed, participants, cause, outcome and exact chapter evidence.\n${boundary}`, `# Event Analysis Reference

Admission gate: before/after state or a durable consequence must be expressible. Use occurs_in, involves, causes, reveals, resolves and follows relations. In every multi-chapter extraction batch, join each event whose chapter scope is known to the chapter-order timeline through attributed edges with start/end/label/precision/certainty before declaring the batch complete. Dialogue snippets and keyword co-occurrence are not events.`],
  action: [`# Narrative Action Resource Skill Template

Create a standalone action only when an intentional act has an actor, target, motive or consequence that must be queried independently or participates in a causal chain. Otherwise keep it inside the containing event or chapter analysis.\n${boundary}`, `# Action Analysis Reference

Require actor, action semantics, evidence anchor and outcome/attempt status. Use performed_by, targets, part_of, causes or prevents. Avoid one action node per verb; repeated routine acts and incidental movements remain prose.`],
  timeline: [`# Timeline Resource Skill Template

Model each timeline as an ordinary \`kind: timeline\` resource. People, events, actions, tasks, chapters, evidence and historical facts join it through attributed relationship edges; never add a special \`resource.timelines\` field. A membership edge must identify the timeline target and carry \`attributes.start\`, \`attributes.end\`, \`attributes.label\`, \`attributes.precision\`, and \`attributes.certainty\`. Use equal start/end for a point. Keep semantic edges such as before, after, occurs_in, participates_in and causes in addition to placement. Timeline resources must relate to other axes using aligned_with, contains or derived_from and include mapping evidence when coordinates differ.\n${boundary}`, `# Timeline Modeling Reference

Member example:\n\n\`\`\`yaml\nresource:\n  relationships:\n    - relation: occurs_on\n      target: water-margin-chapters\n      attributes:\n        start: 8\n        end: 8\n        label: 第八回\n        precision: chapter\n        certainty: canonical\n\`\`\`\n\nAxis relationship example:\n\n\`\`\`yaml\nresource:\n  id: water-margin-chapters\n  kind: timeline\n  relationships:\n    - relation: aligned_with\n      target: water-margin-narrative\n      attributes:\n        mapping: chapter-to-sequence\n        certainty: provisional\n\`\`\`\n\nEvery displayed membership needs both start and end; point events repeat the value. Maintain timeline-to-timeline relations whenever multiple axes coexist. Never invent Gregorian dates. Coordinates do not replace semantic or causal edges.`],
  website: [`# Website Resource Skill Template

读取 DNS、HTTP 状态/headers、TLS issuer/SAN/expiry、redirect，并在授权主机核对 nginx/OpenResty/Traefik/Caddy 虚拟主机与 upstream 摘要。建立 website -> proxy -> runtime -> project 证据链。\n${boundary}`, `# Website Read-only Reference

禁止读取 TLS 私钥、Cookie、Authorization、WAF secret。DNS/TLS、反代配置和运行证据一致后才能确认归属。`],
}

export const RESOURCE_SKILL_TEMPLATES = Object.fromEntries(Object.entries(templates).flatMap(([kind, [skill, reference]]) => [
  [`templates/resource-skills/${kind}/SKILL.md`, `---\nname: ${kind}-resource-template\ndescription: Instantiate inside one discovered ${kind} resource, then replace template identity with the concrete resource ID.\n---\n${skill}`],
  [`templates/resource-skills/${kind}/references/read-only-discovery.md`, reference],
]))

export const KIND_DESIGN_SKILL = `---
name: resource-kind-design
description: Design an evidence-backed professional resource-kind template for an unknown domain, test it on a small sample, and evolve it from observed extraction failures.
---
# Professional Resource Kind Design

Use this before creating a new kind or processing an unfamiliar domain. A kind is a reusable responsibility and analysis method, not merely a display category.

## 1. Establish the domain job

Write the questions this kind must answer, its source material, the unit an agent must read completely, and what later agents need to query independently. Separate primary evidence, stable facts, interpretations, derived projections and temporary work products.

## 2. Node admission test

Create a resource node only when at least one condition holds and evidence supports it:

- stable identity across multiple contexts;
- independent lifecycle, state or ownership;
- reused by multiple resources;
- participates in typed relationships that must be queried independently;
- needs a distinct workflow, safety boundary or verification status.

Keep narrative content in its owning Markdown when it is a mention, transient action, scene detail, unresolved interpretation or formatting subdivision. Extraction artifacts such as keyword-hit lists, binding summaries, temporary JSON and copied snippets belong in discoveries or disposable work products, not in the canonical resource body or graph. A virtual node is justified only when the virtual object has stable identity plus independent relationships/state or a specialist workflow. Never create generic binding, match, row, snippet or copy nodes merely to connect evidence.

## 3. Evidence contract

Choose stable evidence anchors before extraction. Markdown evidence uses Obsidian headings or lowercase-kebab block IDs, never physical line numbers. Every inferred fact records certainty; every semantic event/entity/action relation can be traced to an owning resource anchor. Preserve source text once and use links, not copied bodies. Define what evidence upgrades draft/provisional claims and what evidence is forbidden to infer.

## 4. Professional method template

A new kind template must define:

- complete-read/discovery procedure and bounded source scope;
- minimum fields and node admission/rejection examples;
- typed outgoing/incoming relationships and evidence requirements;
- state, chronology, aliases, certainty and conflict handling when relevant;
- what stays in Markdown versus references/discoveries/oplog;
- virtual-node criteria and anti-explosion limits;
- read-only/safety boundary;
- completion criteria and quality checks;
- concrete Skill evolution triggers.

Instantiate the template into each concrete resource Skill and replace generic identity with its resource ID and actual evidence paths. Templates are managed defaults; concrete Skills contain practiced knowledge.

## 5. Quality-gated trial

Before scaling, process the smallest representative sample end-to-end. For narrative text use 3–10 complete chapters; for infrastructure use one bounded target plus its immediate dependencies. Run resource_graph_check and query schema/neighbors. Measure and inspect:

- isolated-node ratio and nodes with no semantic edge;
- kind distribution and sudden kind explosion;
- duplicated bodies or one-to-one wrapper nodes;
- edges based only on co-occurrence or keyword matching;
- missing/invalid evidence anchors;
- unsupported certainty, invented dates or identities;
- whether a human can understand topology and selected Markdown.

Do not scale while these checks fail.

## 6. Evolve from practice

After each batch classify findings as false-positive nodes, false-negative nodes, wrong merge/split, wrong edge semantics, missing evidence, shallow reading, unsafe method, UI projection problem, or schema limitation. If a template instruction caused the failure, replace that instruction in this managed methodology/source template; if the lesson is domain-specific, replace the corresponding kind template; if resource-specific, update its concrete Skill. Do not append contradictory exceptions. Record unresolved conflicts in discoveries.

A template update is required when the same correction would help the next resource of that kind, when an admission rule repeatedly needs human correction, or when quality checks reveal systematic unreadability. No update is needed for pure lookup with no new practice.
`

export const PUBLIC_CORE_SKILLS = {
  'resource-investigation': `---
name: resource-investigation
description: Close an operational root-cause chain using bounded, evidence-ranked, read-only investigation.
---
# Resource Investigation

Start from the symptom and exact time window, locate entry resources with the graph, then build a hypothesis tree. Follow the causal chain appropriate to the system: entry/DNS/TLS/proxy -> upstream and exact instance -> process/container/workload -> application logs and running build -> source/config/schedule -> database, queue, cache, storage or external dependency. Correlate the same request ID or sanitized key across layers and across instances. Distinguish application 500, connection/upstream 502 and timeout 504; a passing health probe is not business-function proof.

Call a root cause confirmed only when a concrete component, code/config/data/dependency condition and triggering window are evidenced and major alternatives are excluded. Otherwise record confirmed facts, candidates, missing evidence and the next bounded check. Stable facts go to resources, uncertainty to discoveries, reusable procedure to the concrete Skill, and real operations to a dated oplog/YYYY-MM-DD-<topic>.md entry. Restart, deploy, configuration change, write SQL, data repair, queue mutation and credential changes require explicit authorization.
`,
  'source-analysis': `---
name: source-analysis
description: Analyze an authorized repository or running package to establish deployment and dependency evidence without leaking source secrets.
---
# Source Analysis

Identify repository and exact commit/branch/build evidence; inspect manifests, modules, entrypoints, Docker/Compose/Kubernetes descriptors, CI, startup scripts, routes, health, logging, migrations/DDL and configuration key names. Package presence proves capability, not actual use: close dependencies with configuration plus runtime/deployment evidence. For messaging, identify stable producers/listeners/destinations; for data stores, identify namespace/table/migration use; for websites, correlate frontend/backend route contracts.

Do not preserve local clone paths, credentials, full connection strings, secret values, business payloads or copyrighted source bodies in resources. Record provenance, status (complete/pending/blocked), evidence paths relative to the project, conflicts with running artifacts and unresolved gaps. Compare source with deployed image/JAR/build metadata before treating source behavior as production behavior.
`,
  'metadata-safety': `---
name: metadata-safety
description: Apply public-safe bounded metadata discovery and authorization boundaries across infrastructure resources.
---
# Metadata Safety

Use the owning resource scripts/.env as the approved entry, but never print the file or complete environment. Prefer projections, counts, schema, headers and metadata over content. Set explicit limits/timeouts and avoid recursive scans of large data/volume/cache directories. Never output credentials, private keys, cookies, tokens, signed requests, full policies, business rows, message/cache/object contents, full logs or secret-bearing commands.

Read-only metadata is the default. Require explicit authorization before restart/deploy/rollback, configuration/IAM/network/firewall change, write SQL, kill session, publish/consume/ack/purge messages, cache writes/flush, restore/delete backup, retention change, scale/failover or credential rotation. Record evidence time, scope, redactions, exclusions and residual risk.
`,
  'resource-evolution': `---
name: resource-evolution
description: Evolve concrete resource Skills and managed kind methods after real practice without preserving private facts.
---
# Resource Evolution

After discovery, source/chapter/database analysis, script execution or a failed extraction, classify: stable facts, reusable workflow, uncertainty, operation evidence and misleading old guidance. Facts belong in index.md; entry secrets in scripts/.env; methods/failure modes/safety limits in the concrete Skill/reference/script; uncertainty in discoveries; real operations in a dated oplog/YYYY-MM-DD-<topic>.md entry. If old instructions caused failure, replace or merge them—do not append contradictory exceptions.

Review recurring unnamed objects for kind extraction only when they have stable identity, lifecycle, reuse, access/risk or independent workflow. Trial method changes on a bounded sample and run resource_graph_check; inspect isolation, kind explosion, duplicate wrappers, missing evidence and semantic connectivity before scaling. Pure graph lookup with no new evidence needs no writeback. Public managed templates contain methods and synthetic placeholders only, never copied resource facts or incident details.
`,
}

export const PUBLIC_METHOD_REFERENCES = {
  'intake-and-scope.md': `# Intake and Scope

Identify the supplied object, environment and authorization boundary. Query the graph first for candidates, then verify the selected resource index, scripts/.env identity and concrete Skill. Treat graph/cache results as location hints, not live truth. Bound every probe by target, timeout, result count and evidence time. Unknown ownership or environment stays unknown and goes to discoveries; never copy another environment's facts.
`,
  'evidence-and-uncertainty.md': `# Evidence and Uncertainty

Prefer current bounded runtime metadata, then deployment/build evidence, matching source/configuration, existing verified records, and finally human or old-document claims. Record provenance, timestamp, scope, exclusions and certainty. Package presence proves capability only. Health probes prove only their check. Conflicting evidence remains explicit until reconciled. Use stable resource IDs and Obsidian anchors; never physical line numbers as durable evidence.
`,
  'safe-metadata-discovery.md': `# Safe Metadata Discovery

Collect identity, versions, state, counts, schema, headers, listeners, process/container projections, topology and aggregate capacity. Never print complete environment files, credentials, private keys, cookies, tokens, signed requests, full policies, business rows, payloads, message/cache/object contents or unrestricted logs. Avoid recursive enumeration of large data, volume, cache and object trees. Mutation, restart, deploy, failover, scale, restore, write SQL and credential/network changes require explicit authorization.
`,
  'source-and-deployment-analysis.md': `# Source and Deployment Analysis

Establish repository and exact commit/branch/build/image/package evidence. Inspect manifests, modules, entrypoints, CI, deployment descriptors, startup scripts, health, logging, migrations/DDL and configuration key names. Close dependencies using configuration plus runtime/deployment evidence. Compare source to the running artifact before attributing behavior. Preserve only summaries and project-relative evidence—not source bodies, local clone paths, secrets or full connection strings.
`,
  'investigation-and-root-cause.md': `# Investigation and Root Cause

Build a time window and hypothesis tree, then follow entry/proxy -> exact instance -> process/container/workload -> application evidence and running build -> source/config/schedule -> database/queue/cache/storage/external dependency. Correlate the same request ID or sanitized key across layers and instances. Distinguish 500, 502 and 504. Root cause is confirmed only with a concrete component/condition/trigger and major alternatives excluded; otherwise document confirmed facts, candidates, missing evidence and next read-only check.
`,
  'evolution-closeout.md': `# Evolution Closeout

After real practice classify stable facts, reusable procedure, uncertainty, operation evidence and misleading guidance. Write facts to index.md; entry secrets to scripts/.env; workflow/failure/safety to the concrete Skill/reference/script; uncertainty to discoveries; operations to oplog. Replace misleading instructions rather than appending conflicts. Review repeated objects for type extraction only when identity/lifecycle/reuse/risk/workflow justify it. Validate a bounded sample before scaling. Pure lookup with no new evidence needs no writeback.
`,
  'public-release-gate.md': `# Public Release Gate

Managed templates and public Skills contain methodology and synthetic placeholders only. Reject real organization/customer/project/resource names, hostnames, domains, private or public endpoints copied from operations, IPs, account IDs, ports tied to actual systems, schema/table/queue names, incident timestamps, build IDs, capacity figures, absolute user paths, credentials, secret-like assignments, private keys, raw logs, source bodies, business rows and payloads. Examples must use neutral IDs such as example-service and documentation-only domains. Run the package public-content audit and tests before release.
`,
  'portable-script-contract.md': `# Portable Script Contract

A resource-local script must be cross-platform where practical, consume the owning scripts/.env, verify RESOURCE_ID/RESOURCE_KIND/ENVIRONMENT, default to bounded read-only behavior, expose timeout/limit inputs, redact sensitive output and exit nonzero on missing identity/configuration. Do not add platform-only .cmd/.bat/.ps1 entrypoints. Any mutation mode needs an explicit confirmation flag, prior user authorization and operation logging.
`,
}

export const OKF_MANAGED_FILES = {
  'runbooks/okf-resource-contract.md': `# Strict OKF Resource Contract

Only \`.resource-map/resources/**/index.md\` files become graph nodes. Before creating one, copy \`.resource-map/examples/minimal-resource/index.md\` and replace its synthetic identity; never write frontmatter from memory.

## Required shape

\`resource\` is a YAML mapping, not a scalar. Keep \`title\` and \`tags\` at top level. The minimum accepted record is:

\`\`\`yaml
---
title: Example Service
resource:
  kind: service
  id: example-service
  name: Example Service
  environment: unknown
  status: active
  owners: []
  description: Synthetic service used only to demonstrate the public format.
tags:
  - example
---
\`\`\`

IDs and kinds are lowercase kebab-case; relationships are lowercase snake_case. Every target is another resource's global \`resource.id\`, never a relative path, display name, filename or directory-qualified target. Use \`[[example-dependency]]\`, not \`[[services/example-dependency]]\`.

## Typed relations

Use either strict Markdown in \`## 图引用\`:

\`\`\`markdown
- depends_on: [[example-dependency#^dependency-evidence|dependency evidence]]
\`\`\`

or attributed frontmatter edges:

\`\`\`yaml
  relationships:
    - relation: occurs_on
      target: example-timeline
      anchor: ^timeline-evidence
      attributes:
        start: 1
        end: 1
        label: Example point
        precision: sequence
        certainty: synthetic
\`\`\`

Do not hand-write derived graph/cache fields. Add stable evidence anchors to factual Markdown blocks. Keep instructions and coordinate semantics in Skills/references, not resource facts.

## Operation logs

Operation evidence lives in the resource's \`oplog/\` directory and is classified by
date. Every entry is exactly one file named \`oplog/YYYY-MM-DD-<topic>.md\`:

- The \`YYYY-MM-DD\` prefix is the local date the operation happened and is
  mandatory. A file without that prefix is not a valid operation log entry.
- \`<topic>\` is a short lowercase kebab-case summary, for example
  \`2026-11-10-disk-cleanup.md\`.
- One file per operated date and topic. Start a new dated file for a later day
  instead of appending that day's work to an existing entry.
- Record the operation window, resource ID, entrypoint, command summary, result and
  follow-up updates. Never store secrets, full connection strings, raw logs or
  business rows.

## Required workflow

1. Read this contract and the relevant \`templates/resource-skills/<kind>/SKILL.md\`.
2. Copy the minimal example outside \`resources/\`, then replace ID/kind/name/environment/status/body and remove synthetic relations that do not apply.
3. Create the concrete resource \`skill/SKILL.md\` from the kind template.
4. Add only targets whose index already exists or is created in the same batch.
5. Run \`resource_graph_check\` immediately. On error, read and repair every reported file; do not bypass the graph, write SQLite or continue scaling.
`,
  'examples/README.md': `# Synthetic OKF Examples

These files are plugin-managed documentation fixtures outside \`resources/\`; they are never indexed as project facts. Copy their structure when creating resources, replace all \`example-*\` identities and synthetic prose, and delete relations that do not apply. Never move the demo unchanged into a real resource map.
`,
  'examples/minimal-resource/index.md': `---
title: Example Service
resource:
  kind: service
  id: example-service
  name: Example Service
  environment: unknown
  status: active
  owners: []
  description: Synthetic service demonstrating a strict resource context unit.
tags:
  - example
---

# Example Service

This is synthetic documentation, not an observed runtime. ^service-summary

## Evidence

The example demonstrates a typed relation whose target is a global resource ID. ^dependency-evidence

## 图引用

- depends_on: [[example-dependency#^dependency-summary|synthetic dependency]]
`,
  'examples/minimal-related/index.md': `---
title: Example Dependency
resource:
  kind: service
  id: example-dependency
  name: Example Dependency
  environment: unknown
  status: active
  owners: []
  description: Synthetic dependency paired with the minimal resource example.
tags:
  - example
---

# Example Dependency

This synthetic node exists only to make the example relation resolvable. ^dependency-summary

## 图引用
`,
  'examples/minimal-resource/scripts/.env': `RESOURCE_ID=example-service
RESOURCE_KIND=service
ENVIRONMENT=unknown
`,
  'examples/minimal-related/scripts/.env': `RESOURCE_ID=example-dependency
RESOURCE_KIND=service
ENVIRONMENT=unknown
`,
}

export const MAINTENANCE_SKILL = `---
name: resource-map-maintenance
description: Proactively maintain strict project-local resource context units and their specialist discovery skills.
---
# Resource Map Maintenance

All facts stay under \`.resource-map\`. Before creating any resource, read \`runbooks/okf-resource-contract.md\` and copy the structure of \`examples/minimal-resource/index.md\`; never author frontmatter or Wikilink targets from memory. Create resources at \`resources/<type>/<environment>/<resource-id>/\` with strict \`resource\` mapping in \`index.md\`, identity keys in \`scripts/.env\`, and concrete-resource workflow in \`skill/SKILL.md\`. Put detailed evidence in \`skill/references/\` or \`references/\`, uncertain findings in \`discoveries/\`, reusable read-only scripts in \`skill/scripts/\`, and operations in a dated \`oplog/YYYY-MM-DD-<topic>.md\` entry.

When a user supplies an operational endpoint, actively perform safe bounded read-only discovery. Do not stop at the supplied object: identify reusable runtimes and virtual resources such as Docker containers, Redis DB/prefix/stream/pubsub, MQ queues/topics/routes, Nacos/Consul service names, Kubernetes workloads/services/ingresses, database schemas/tables, websites and upstreams. Create each justified resource context and typed wikilinks.

Select \`templates/resource-skills/<type>/\`, copy it into the concrete resource's \`skill/\`, replace template identity with the resource ID, add resource-specific references and evolve it after every real probe. Use \`.resource-map/skills/resource-investigation/\` for causal diagnosis, \`source-analysis/\` for repository/build evidence, \`metadata-safety/\` for bounded discovery and authorization, and \`resource-evolution/\` for closeout. Templates are plugin-managed and may be upgraded; they never replace concrete resource skills.

## Required evolution closeout

After resource discovery, chapter reading, source analysis, database analysis, or any failed extraction attempt, decide whether practice exposed a reusable fact, method, failure mode, admission rule, evidence rule, or safety limit. Stable facts and concise evidence-backed summaries go to the resource index; requirements, modeling instructions, admission rules, coordinate semantics, and concrete repeatable workflow go to its skill/reference/script—never place them in the resource body as if they were facts. Uncertainty goes to discoveries; operations go to a dated oplog/YYYY-MM-DD-<topic>.md entry. If an instruction caused shallow, duplicated, ungrounded, or unreadable nodes, replace it in the concrete skill rather than appending a conflicting exception. Pure graph lookup with no new evidence needs no writeback.

For narrative analysis, work in a quality-gated sample before scaling. Read complete chapters, keep full text once, add stable Obsidian block IDs to evidence paragraphs, and create only justified novel/volume/chapter/entity/event/action/timeline resources. Never create direct SQLite rows, chapter-resource copies, generic binding nodes, one node per keyword, or untyped co-occurrence edges. Run resource_graph_check after each batch; inspect isolated nodes, kind explosion, duplicate content and missing semantic edges, then update the relevant concrete kind skill before the next batch.

Unknown facts remain unknown; writes to real operational systems require explicit authorization.
`
