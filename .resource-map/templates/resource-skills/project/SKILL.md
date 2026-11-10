---
name: project-resource-template
description: Instantiate inside one discovered project resource, then replace template identity with the concrete resource ID.
---
# Project Resource Skill Template

主动分析授权源码或部署包的 Git/manifest、模块、Dockerfile/Compose/K8s、CI、启动脚本、健康接口、日志配置、迁移/DDL，以及数据库、Redis、MQ、搜索、对象存储、注册中心和调度依赖。依赖包只证明能力，源码配置加运行证据才能证明实际使用。
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
