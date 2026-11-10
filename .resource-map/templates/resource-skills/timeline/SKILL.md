---
name: timeline-resource-template
description: Instantiate inside one discovered timeline resource, then replace template identity with the concrete resource ID.
---
# Timeline Resource Skill Template

Model each timeline as an ordinary `kind: timeline` resource. People, events, actions, tasks, chapters, evidence and historical facts join it through attributed relationship edges; never add a special `resource.timelines` field. A membership edge must identify the timeline target and carry `attributes.start`, `attributes.end`, `attributes.label`, `attributes.precision`, and `attributes.certainty`. Use equal start/end for a point. Keep semantic edges such as before, after, occurs_in, participates_in and causes in addition to placement. Timeline resources must relate to other axes using aligned_with, contains or derived_from and include mapping evidence when coordinates differ.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
