---
name: mq-resource-template
description: Instantiate inside one discovered mq resource, then replace template identity with the concrete resource ID.
---
# MQ Runtime Inspection Compatibility Template

先识别 RabbitMQ/Kafka/RocketMQ/ActiveMQ。只读获取 broker、vhost、topic/queue、partition、exchange、binding、route、consumer/group、connection 和 alarm 元数据。broker 运行服务与虚拟 MQ/channel/route 分层建模，项目生产/消费关系必须有源码、运行连接或管理面证据。
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
