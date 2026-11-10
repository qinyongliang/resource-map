---
name: system-resource-template
description: Instantiate inside one discovered system resource, then replace template identity with the concrete resource ID.
---
# System Resource Skill Template

Model a business or operational boundary that aggregates projects, websites, services, servers, databases, message queues and shared dependencies. A system is not a duplicate inventory: it explains component roles, entrypoints, data/request flows, environment boundaries, logging/inspection coverage and ownership. Create it only when the aggregation has independent meaning, lifecycle or operational workflow.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
