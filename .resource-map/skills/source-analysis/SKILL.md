---
name: source-analysis
description: Analyze an authorized repository or running package to establish deployment and dependency evidence without leaking source secrets.
---
# Source Analysis

Identify repository and exact commit/branch/build evidence; inspect manifests, modules, entrypoints, Docker/Compose/Kubernetes descriptors, CI, startup scripts, routes, health, logging, migrations/DDL and configuration key names. Package presence proves capability, not actual use: close dependencies with configuration plus runtime/deployment evidence. For messaging, identify stable producers/listeners/destinations; for data stores, identify namespace/table/migration use; for websites, correlate frontend/backend route contracts.

Do not preserve local clone paths, credentials, full connection strings, secret values, business payloads or copyrighted source bodies in resources. Record provenance, status (complete/pending/blocked), evidence paths relative to the project, conflicts with running artifacts and unresolved gaps. Compare source with deployed image/JAR/build metadata before treating source behavior as production behavior.
