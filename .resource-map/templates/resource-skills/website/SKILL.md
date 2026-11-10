---
name: website-resource-template
description: Instantiate inside one discovered website resource, then replace template identity with the concrete resource ID.
---
# Website Resource Skill Template

读取 DNS、HTTP 状态/headers、TLS issuer/SAN/expiry、redirect，并在授权主机核对 nginx/OpenResty/Traefik/Caddy 虚拟主机与 upstream 摘要。建立 website -> proxy -> runtime -> project 证据链。
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
