# EchoDE Mode Principles

## Plan Mode (design before coding)
Plan Mode is optimized for architecture quality before implementation: it stays strictly in requested scope, lists exact files/functions to change, preserves existing project patterns, and applies SOLID + DRY + modular separation (types, logic, UI, utils) while planning edge cases and error handling.

## Agent Mode (implement with quality gates)
Agent Mode is optimized for reliable execution: complete the full task end-to-end, keep changes minimal and in scope, avoid over-engineering, enforce SOLID + DRY + modularity during edits, and verify outcomes with diagnostics before considering work done.

## Shared principles you can reference in custom instructions
- Scope discipline: no unrequested features, abstractions, or refactors.
- Simplicity first: prefer the smallest correct change.
- Robustness: handle errors and edge cases.
- Architecture preservation: follow existing naming, file layout, and patterns.
- Quality gate: finish only when implementation is complete and validated.
