---
name: new-review
description: Create a new feature review for the current branch with scenarios based on recent changes
---

Create a new feature review for the current branch with scenarios based on the recent changes.

## Steps

1. Detect the current git branch name
2. Analyze recent commits and changed files to understand the feature
3. Generate scenario titles and descriptions that cover the key user flows affected
4. Run `ranger create` with the generated title, branch, and scenarios
5. Report the created review ID and scenario summary
