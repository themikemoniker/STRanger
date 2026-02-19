---
name: verify
description: Run ranger verification on the current review and report results
---

Run ranger go on the current review and report results.

## Steps

1. Identify the current feature review (from branch name or `.ranger/project.json`)
2. Run `ranger go` with the current profile
3. Stream live verification progress
4. Report the final verdict for each scenario
5. If any scenario failed or is partial, summarize the issues and suggest fixes
