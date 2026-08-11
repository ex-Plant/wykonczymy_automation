---
id: kosztorys-client-share
slice: S-13
linear: EX-532
status: archived
branch: konradantonik/ex-532-kosztorys-client-share
worktree: .claude/worktrees/ex-532-client-share
created: 2026-07-20
updated: 2026-07-24
archived_at: 2026-07-24T13:59:02Z
---

# Kosztorys client share view

A live, read-only, token-gated client-facing view of a kosztorys. The owner shares `/k/<token>`;
the client reopens it over the life of the job and sees current per-etap progress.

The subcontractor cost view (z narzędziami / bez narzędzi) must not surface — the render pins the
price view to `'client'`, so subcontractor prices are never computed.

**Superseded — the payload is NOT stripped.** This change's design argued a _structural_ no-leak
guarantee: a `toClientView` projection plus a client-safe DTO, so subcontractor inputs never entered
the client render's module graph. The owner retired that the same week (`kosztorys-client-view-reuse`,
2026-07-20): the full tree ships to the client and the render side alone decides what is shown. The
design brief that argued the stripped-payload architecture has been deleted; `git log --follow` on
this folder still reaches it.
