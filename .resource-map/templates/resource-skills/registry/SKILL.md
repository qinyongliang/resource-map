---
name: registry-resource-template
description: Instantiate inside one discovered registry resource, then replace template identity with the concrete resource ID.
---
# Registry Resource Skill Template

识别 Nacos、Consul、Etcd、ZooKeeper，读取成员、namespace、catalog/service、instance、health/check 和配置 key 名元数据。运行注册中心与虚拟 service-name/namespace 分层建模；host:port、健康检查和运行服务证据一致后才能确认归属。
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
