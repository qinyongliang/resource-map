---
name: cloud_provider_account-resource-template
description: Instantiate inside one discovered cloud_provider_account resource, then replace template identity with the concrete resource ID.
---
# Cloud Provider Account Resource Skill Template

Model one account or tenant without secrets: parent provider, non-secret account identity/profile label, account type, regions, inspection status and mapped resources. Credentials stay in this account's scripts/.env or approved external store.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
