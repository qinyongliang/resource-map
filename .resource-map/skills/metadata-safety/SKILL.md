---
name: metadata-safety
description: Apply public-safe bounded metadata discovery and authorization boundaries across infrastructure resources.
---
# Metadata Safety

Use the owning resource scripts/.env as the approved entry, but never print the file or complete environment. Prefer projections, counts, schema, headers and metadata over content. Set explicit limits/timeouts and avoid recursive scans of large data/volume/cache directories. Never output credentials, private keys, cookies, tokens, signed requests, full policies, business rows, message/cache/object contents, full logs or secret-bearing commands.

Read-only metadata is the default. Require explicit authorization before restart/deploy/rollback, configuration/IAM/network/firewall change, write SQL, kill session, publish/consume/ack/purge messages, cache writes/flush, restore/delete backup, retention change, scale/failover or credential rotation. Record evidence time, scope, redactions, exclusions and residual risk.
