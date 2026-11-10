---
name: event-resource-template
description: Instantiate inside one discovered event resource, then replace template identity with the concrete resource ID.
---
# Narrative Event Resource Skill Template

Create an event only for a bounded change that matters beyond one sentence: it changes state, reveals information, causes later action, joins multiple entities, or anchors a narrative/historical timeline. State what changed, participants, cause, outcome and exact chapter evidence.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
