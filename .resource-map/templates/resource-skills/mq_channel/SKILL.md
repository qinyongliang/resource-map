---
name: mq_channel-resource-template
description: Instantiate inside one discovered mq_channel resource, then replace template identity with the concrete resource ID.
---
# MQ Channel Resource Skill Template

Model a stable queue, topic, exchange or stream under one message_queue. Record parent_mq_id, type, raw name, stable slug, durability/retention/partition properties, bounded depth/rate metadata, users, bindings and evidence time. Broker endpoint and credentials remain on the backing service.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
