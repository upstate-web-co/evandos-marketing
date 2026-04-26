---
name: workflow-preferences
description: User preferences for how to approach work — commit timing, file creation, update cadence
type: feedback
---

Do not commit or push to git until explicitly asked. Finish the full work first, then review and commit together.
**Why:** User rejected a premature `ls` of sibling repos and asked to batch work before touching git.
**How to apply:** Complete all session tasks before suggesting a commit. Never auto-commit.

User wants LESSONS.md and DEBUGGING.md maintained alongside CLAUDE.md files — update them as issues arise during development.
**Why:** User explicitly requested these files for tracking lessons and debug sessions.
**How to apply:** After resolving any non-trivial issue, log it in the appropriate file.

Update Claude-related files (PROJECT_STATE.md, memory, etc.) between sessions or when explicitly asked.
**Why:** User asked "update claude related files and continue" — expects these to stay current.
**How to apply:** Update PROJECT_STATE.md after completing each session's deliverables. Update memory files when patterns or gotchas are discovered.
