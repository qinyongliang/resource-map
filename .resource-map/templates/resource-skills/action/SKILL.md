---
name: action-resource-template
description: Instantiate inside one discovered action resource, then replace template identity with the concrete resource ID.
---
# Narrative Action Resource Skill Template

Create a standalone action only when an intentional act has an actor, target, motive or consequence that must be queried independently or participates in a causal chain. Otherwise keep it inside the containing event or chapter analysis.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
