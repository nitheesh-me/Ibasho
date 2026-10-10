---
type: llm
weight: 1
---

Fail if any number lacks an evidence id (ev_...), if the response does arithmetic on tool values itself (a sum, a difference, a percentage or a ratio), or if it names a rule, regulation or check that no tool result returned. Years, ordinal words and quoted ids do not count as numbers.
