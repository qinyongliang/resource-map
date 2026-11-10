---
name: database-resource-template
description: Instantiate inside one discovered database resource, then replace template identity with the concrete resource ID.
---
# Database Resource Skill Template

识别引擎/版本/角色、实例、逻辑库/schema、容量、连接/活动摘要、复制、备份元数据和 DDL。运行实例、逻辑库和重要表/view 分层建模；项目使用关系需源码配置与运行连接证据闭合。
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
