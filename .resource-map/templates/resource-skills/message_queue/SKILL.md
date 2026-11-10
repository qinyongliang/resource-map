---
name: message_queue-resource-template
description: Instantiate inside one discovered message_queue resource, then replace template identity with the concrete resource ID.
---
# Message Queue Resource Skill Template

Model an abstract messaging capability separately from its broker service. Identify backend type, backing service, stable destinations, producer/consumer systems and channels. Ownership requires source, runtime connection, deployment or authenticated consumer evidence; names and consumer counts alone are insufficient.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
