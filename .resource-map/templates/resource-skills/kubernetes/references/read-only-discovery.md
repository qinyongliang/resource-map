# Kubernetes Read-only Reference

禁止读取 Secret 值或全量 dump manifest。apply/delete/rollout/scale/exec/port-forward 均属于变更或额外触达，必须授权。