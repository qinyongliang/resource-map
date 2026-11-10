---
name: ops_document-resource-template
description: Instantiate inside one discovered ops_document resource, then replace template identity with the concrete resource ID.
---
# Operations Document Resource Skill Template

Import only reusable operational material such as installation, deployment, account-entry, certificate, database, server, API or troubleshooting guidance. Capture source metadata, scope, sensitivity classification, exploration status and evidence-backed resource associations. Media, task progress, bug workflow, test noise and pure project-management material are not operations-document resources.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
