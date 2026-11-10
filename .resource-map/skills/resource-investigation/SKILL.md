---
name: resource-investigation
description: Close an operational root-cause chain using bounded, evidence-ranked, read-only investigation.
---
# Resource Investigation

Start from the symptom and exact time window, locate entry resources with the graph, then build a hypothesis tree. Follow the causal chain appropriate to the system: entry/DNS/TLS/proxy -> upstream and exact instance -> process/container/workload -> application logs and running build -> source/config/schedule -> database, queue, cache, storage or external dependency. Correlate the same request ID or sanitized key across layers and across instances. Distinguish application 500, connection/upstream 502 and timeout 504; a passing health probe is not business-function proof.

Call a root cause confirmed only when a concrete component, code/config/data/dependency condition and triggering window are evidenced and major alternatives are excluded. Otherwise record confirmed facts, candidates, missing evidence and the next bounded check. Stable facts go to resources, uncertainty to discoveries, reusable procedure to the concrete Skill, and real operations to a dated oplog/YYYY-MM-DD-<topic>.md entry. Restart, deploy, configuration change, write SQL, data repair, queue mutation and credential changes require explicit authorization.
