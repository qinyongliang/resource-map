---
name: cloud_resource-resource-template
description: Instantiate inside one discovered cloud_resource resource, then replace template identity with the concrete resource ID.
---
# Cloud Resource Skill Template

Promote a cloud object only when it has stable identity and an independent lifecycle, relationship, access boundary, risk or inspection method. Otherwise keep region/VPC/subnet/security metadata on its owning account or runtime resource.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
