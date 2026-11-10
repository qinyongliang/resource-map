---
name: resource-map-maintenance
description: Proactively maintain strict project-local resource context units and their specialist discovery skills.
---
# Resource Map Maintenance

All facts stay under `.resource-map`. Before creating any resource, read `runbooks/okf-resource-contract.md` and copy the structure of `examples/minimal-resource/index.md`; never author frontmatter or Wikilink targets from memory. Create resources at `resources/<type>/<environment>/<resource-id>/` with strict `resource` mapping in `index.md`, identity keys in `scripts/.env`, and concrete-resource workflow in `skill/SKILL.md`. Put detailed evidence in `skill/references/` or `references/`, uncertain findings in `discoveries/`, reusable read-only scripts in `skill/scripts/`, and operations in a dated `oplog/YYYY-MM-DD-<topic>.md` entry.

When a user supplies an operational endpoint, actively perform safe bounded read-only discovery. Do not stop at the supplied object: identify reusable runtimes and virtual resources such as Docker containers, Redis DB/prefix/stream/pubsub, MQ queues/topics/routes, Nacos/Consul service names, Kubernetes workloads/services/ingresses, database schemas/tables, websites and upstreams. Create each justified resource context and typed wikilinks.

Select `templates/resource-skills/<type>/`, copy it into the concrete resource's `skill/`, replace template identity with the resource ID, add resource-specific references and evolve it after every real probe. Use `.resource-map/skills/resource-investigation/` for causal diagnosis, `source-analysis/` for repository/build evidence, `metadata-safety/` for bounded discovery and authorization, and `resource-evolution/` for closeout. Templates are plugin-managed and may be upgraded; they never replace concrete resource skills.

## Required evolution closeout

After resource discovery, chapter reading, source analysis, database analysis, or any failed extraction attempt, decide whether practice exposed a reusable fact, method, failure mode, admission rule, evidence rule, or safety limit. Stable facts and concise evidence-backed summaries go to the resource index; requirements, modeling instructions, admission rules, coordinate semantics, and concrete repeatable workflow go to its skill/reference/script—never place them in the resource body as if they were facts. Uncertainty goes to discoveries; operations go to a dated oplog/YYYY-MM-DD-<topic>.md entry. If an instruction caused shallow, duplicated, ungrounded, or unreadable nodes, replace it in the concrete skill rather than appending a conflicting exception. Pure graph lookup with no new evidence needs no writeback.

For narrative analysis, work in a quality-gated sample before scaling. Read complete chapters, keep full text once, add stable Obsidian block IDs to evidence paragraphs, and create only justified novel/volume/chapter/entity/event/action/timeline resources. Never create direct SQLite rows, chapter-resource copies, generic binding nodes, one node per keyword, or untyped co-occurrence edges. Run resource_graph_check after each batch; inspect isolated nodes, kind explosion, duplicate content and missing semantic edges, then update the relevant concrete kind skill before the next batch.

Unknown facts remain unknown; writes to real operational systems require explicit authorization.
