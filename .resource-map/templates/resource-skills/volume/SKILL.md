---
name: volume-resource-template
description: Instantiate inside one discovered volume resource, then replace template identity with the concrete resource ID.
---
# Volume Resource Skill Template

Create a volume only when the source has a stable named/numbered division or the analyst declares a reviewable editorial partition. It aggregates chapters and records the volume arc after its chapters have been read; it must not duplicate chapter bodies or pretend that an opening excerpt summarizes the volume.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
