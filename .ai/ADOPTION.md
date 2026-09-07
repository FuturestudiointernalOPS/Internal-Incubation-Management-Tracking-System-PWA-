# ADOPTION.md — How to Adopt and Extend the Engineering Runtime

**Purpose:** How future projects adopt the framework and extend it over time.
**Audience:** Engineers copying `.ai/` into a new project.

## Adopting in a New Project

1. **Copy the runtime:** copy the entire `.ai/` directory into the new repo.
2. **Replace project knowledge (Phase 3 files):**
   - Rewrite `PROJECT.md` for the new project (stack, architecture, business rules).
   - Replace MEMORY.md entries with the new project's decisions and known issues; keep the structure.
   - Update STANDARDS.md to the new project's conventions.
3. **Keep global, replace local:** SYSTEM.md and `core/` are intentionally generic. Change them only to improve the runtime itself — never to fit a project.
4. **Verify:** run the self-test (`core/self-test.md`) with debug mode on to confirm the runtime behaves before real work.

## Adding a Skill

1. Drop a new `.md` file into `.ai/skills/` with metadata front-matter: `name`, `purpose`, `trigger`, `workflow_weight`, `can_chain`.
2. The router discovers it automatically — no code changes, no hardcoded lists.
3. Reference an output template from the skill's **Output Template** section (add a template if none fits).
4. One page maximum. Purpose, triggers, workflow, stop conditions, output template, metadata. Nothing else.

## Adding a Template

1. Drop a file into `.ai/templates/` with a `name` / `purpose` / `used_by` header.
2. Reference it from the relevant skill's **Output Template** section.

## Maintaining Memory

- Append decisions and reusable facts to MEMORY.md as they become reusable.
- Remove resolved issues after two releases. Never store chat history.
- Keep MEMORY.md curated — if it outgrows ~150 lines, prune or split.

## Evolving the Runtime

- The runtime is designed to stay small. Two rules:
  - Orchestration change (routing, state, context) → SYSTEM.md or `core/`.
  - Domain change → project files (PROJECT/MEMORY/STANDARDS), never the runtime.
- Bump the version header in SYSTEM.md on meaningful changes.
- Skills and templates are the extension points; new ones must never require runtime changes.
