---
name: redis-resource-template
description: Instantiate inside one discovered redis resource, then replace template identity with the concrete resource ID.
---
# Redis Resource Skill Template

读取 INFO server/memory/clients/stats/persistence/keyspace、DBSIZE、replication、cluster/sentinel 和有界 prefix/type 元数据。禁止 KEYS、读取 value、DUMP、MONITOR、写命令或故障转移。识别稳定 DB/prefix/stream/list/PubSub 后，将虚拟缓存或 MQ 对象建为独立资源，使用源码和运行证据关联生产者/消费者。
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
