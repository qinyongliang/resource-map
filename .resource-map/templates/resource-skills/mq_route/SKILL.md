---
name: mq_route-resource-template
description: Instantiate inside one discovered mq_route resource, then replace template identity with the concrete resource ID.
---
# MQ Route Resource Skill Template

Model one evidence-backed producer, consumer or binding route under a channel. Record parent IDs/slugs, route type, project/system endpoint, target channel, routing selector and non-secret properties. Create a route only when source/runtime/management evidence identifies both ends.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
