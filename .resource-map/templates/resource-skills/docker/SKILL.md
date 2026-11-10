---
name: docker-resource-template
description: Instantiate inside one discovered docker resource, then replace template identity with the concrete resource ID.
---
# Docker Resource Skill Template

只读盘点 Docker/Compose 的版本、容器名、镜像、状态/health、端口、restart policy、mount、network、labels 和 Compose project。只使用 inspect 投影，禁止转储 Env。每个有独立生命周期的容器运行服务与 backing resource 建独立资源并维护 hosts/runs_on/depends_on。
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
