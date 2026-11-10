---
name: entity-resource-template
description: Instantiate inside one discovered entity resource, then replace template identity with the concrete resource ID.
---
# Narrative Entity Resource Skill Template

Use entity for a persistent person, organization, place, object, identity, concept or mystery that recurs or carries state across scenes. Prefer specific sub-kinds such as character, organization, place or artifact when justified. Merge aliases into one identity and record alias evidence; do not create a node for every noun or every mention.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
