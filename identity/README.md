# Echode Personality Prompt Extraction

This folder contains the current personality-defining prompts extracted from Echode source.
Text is preserved from source (including tags/placeholders where dynamic).

Additional non-tool behavior/shared prompt exports are included:
- `identity/shared.md` (shared prompt modules, excluding `shared/tools/*`)
- `identity/behavior.md` (mode workflow/rules/capabilities, excluding all `*/tools/*`)

## Source files
- `webview-ui/src/prompts/agent/sections/identity.ts`
- `webview-ui/src/prompts/plan/sections/identity.ts`
- `webview-ui/src/prompts/ask/sections/identity.ts`
- `webview-ui/src/prompts/ask/sections/style.ts`
- `webview-ui/src/prompts/chat/sections/identity.ts`
- `webview-ui/src/prompts/chat/sections/style.ts`
- `webview-ui/src/prompts/general/sections/identity.ts`
- `webview-ui/src/prompts/general/sections/communication-style.ts`
- `webview-ui/src/prompts/review/sections/identity.ts`
- `webview-ui/src/prompts/shared/isolation.ts`
- `src/utils/sub-agent/prompt-builder.ts`
