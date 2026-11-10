---
name: novel-resource-template
description: Instantiate inside one discovered novel resource, then replace template identity with the concrete resource ID.
---
# Novel Resource Skill Template

Start from the complete source text, detect volume/chapter boundaries, encoding, omissions and duplicated headings, then preserve the original chapter text as the body of one chapter resource. The novel node is only the work-level identity and aggregation root. Any analysis spanning multiple ordered chapters and extracting events must create at least one chapter-order `kind: timeline` resource in the same quality-gated batch; every extracted event with known chapter scope must join it through an attributed edge carrying start/end/label/precision/certainty. Never write derived nodes directly to SQLite. Sample a few chapters first and evolve the kind skills before scaling to the whole book.
## 安全边界

默认仅允许有界只读探测。禁止输出凭证、完整环境变量、私钥、业务行、消息正文或缓存值。重启、部署、写配置、写 SQL、清理、扩缩容、故障转移和凭证变更必须先获得用户明确授权。
