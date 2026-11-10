---
name: database_table-resource-template
description: Instantiate inside one discovered database_table resource, then replace template identity with the concrete resource ID.
---
# Database Table Resource Skill Template

Promote a table/view only when it has independent operational, dependency, DDL, sensitivity, capacity or troubleshooting value. Inherit the parent database entry. Record parent IDs/slugs, object type, purpose, columns/index/constraint summary, approximate size/statistics, DDL provenance and evidence-backed usage.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
