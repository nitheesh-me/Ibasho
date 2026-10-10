# Plugin evals (L8, manual gate M-D)

Three cases for `claude plugin eval`: explore GH1, find the biggest heat leak, and explain why inside wall insulation is absent. Each has a content grader and a grounding grader (no number without an ev id, no agent arithmetic).

They need the real MCP server and, for numbers, the engine (WP-02 `createEngine`, loaded by the MCP adapter). `claude plugin eval` mocks MCP servers by default, so turn mocks off to reach the real one. Run from the repo root (no install needed; the path target loads the plugin from disk):

```bash
claude plugin eval integrations/claude-code --mocks off --allow-tools "mcp__plugin_ibasho_ibasho__*" --runs 3
```

Record the scores on the blackboard (BUILD_PLAN WP-12 L8).
