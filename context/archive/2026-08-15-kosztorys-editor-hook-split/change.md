---
change_id: kosztorys-editor-hook-split
title: Split the use-kosztorys-editor god hook (EX-521)
status: archived
created: 2026-08-15
updated: 2026-08-17
archived_at: 2026-08-17T12:34:24Z
branch: kosztorys-editor-hook-split
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/kosztorys-editor-hook-split
---

## Notes

EX-521: split use-kosztorys-editor god hook; verify the three queued findings (sectionOrderRef dual source of truth, unbundled denormalized section fields, undo commands as closures) and settle whether a renderHook harness is actually required.

The issue as filed (2026-07-17) says the split is blocked on a `renderHook` test harness. That premise
looks stale: `use-undo-redo.ts` already ships a React-free `createUndoRedoStack` core tested with plain
vitest (`src/__tests__/components/kosztorys/editor/hooks/use-undo-redo.test.ts`), and the repo has no
`@testing-library/react` / jsdom at all (`vitest.config.ts` is node-env, `include: ['**/*.test.ts']`).
Research must settle whether the harness is genuinely required or whether extract-the-core is the
established pattern that makes it moot.
