# Timeline Modeling Reference

Member example:

```yaml
resource:
  relationships:
    - relation: occurs_on
      target: water-margin-chapters
      attributes:
        start: 8
        end: 8
        label: 第八回
        precision: chapter
        certainty: canonical
```

Axis relationship example:

```yaml
resource:
  id: water-margin-chapters
  kind: timeline
  relationships:
    - relation: aligned_with
      target: water-margin-narrative
      attributes:
        mapping: chapter-to-sequence
        certainty: provisional
```

Every displayed membership needs both start and end; point events repeat the value. Maintain timeline-to-timeline relations whenever multiple axes coexist. Never invent Gregorian dates. Coordinates do not replace semantic or causal edges.