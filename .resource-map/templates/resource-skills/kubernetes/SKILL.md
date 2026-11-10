---
name: kubernetes-resource-template
description: Instantiate inside one discovered kubernetes resource, then replace template identity with the concrete resource ID.
---
# Kubernetes Resource Skill Template

在授权 context 中只读盘点 cluster/version/node、namespace、workload、service、ingress、endpoint、PVC、ConfigMap 名、Secret 名、job 和有界 events。cluster、workload、service/ingress、持久化和外部依赖分层建模，并关联部署项目。
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
