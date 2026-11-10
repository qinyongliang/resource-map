---
name: cloud_provider-resource-template
description: Instantiate inside one discovered cloud_provider resource, then replace template identity with the concrete resource ID.
---
# Cloud Provider Resource Skill Template

Model a provider capability and its confirmed account topology, supported API/CLI entry and regions. Do not flatten every region, network or product into nodes: promote only objects with independent entry, lifecycle, reuse, access rules, risk or inspection workflow.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
