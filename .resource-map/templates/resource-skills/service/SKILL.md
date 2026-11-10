---
name: service-resource-template
description: Instantiate inside one discovered service resource, then replace template identity with the concrete resource ID.
---
# Service Resource Skill Template

Model one independently operated runtime instance or cluster. Establish runtime identity, engine/version, lifecycle owner, hosting boundary, listeners, health, logs, deployment provenance, maintenance and backup entry, upstream/downstream dependencies and consuming projects/systems. A container is evidence for a service, not automatically a second service node. Separate logical database, cache, queue, registry name or website when it has independent identity or workflow.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
