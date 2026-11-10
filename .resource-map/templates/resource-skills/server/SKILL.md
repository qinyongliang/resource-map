---
name: server-resource-template
description: Instantiate inside one discovered server resource, then replace template identity with the concrete resource ID.
---
# Server Resource Skill Template

主动核验主机身份、OS/内核、uptime、CPU/内存/文件系统、监听端口及进程、systemd、cron、浅层部署目录和容器运行时。发现独立服务、数据库、Redis、MQ、注册中心、K8s、代理、网站和调度器后，继续创建独立资源上下文单元，不把所有事实堆在服务器 index.md。
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
