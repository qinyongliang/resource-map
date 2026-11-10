# Investigation and Root Cause

Build a time window and hypothesis tree, then follow entry/proxy -> exact instance -> process/container/workload -> application evidence and running build -> source/config/schedule -> database/queue/cache/storage/external dependency. Correlate the same request ID or sanitized key across layers and instances. Distinguish 500, 502 and 504. Root cause is confirmed only with a concrete component/condition/trigger and major alternatives excluded; otherwise document confirmed facts, candidates, missing evidence and next read-only check.
