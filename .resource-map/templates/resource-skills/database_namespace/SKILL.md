---
name: database_namespace-resource-template
description: Instantiate inside one discovered database_namespace resource, then replace template identity with the concrete resource ID.
---
# Database Namespace Resource Skill Template

Model one logical database or schema under a database runtime. Inherit the parent runtime entry and credentials; never copy a DSN. Record parent_database_id, engine-native name, namespace slug, purpose, size/object-count summaries, DDL provenance, sensitivity and evidence-backed users.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
