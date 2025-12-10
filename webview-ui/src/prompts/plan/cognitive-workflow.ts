/**
 * Plan Mode - Cognitive workflow for planning
 */

export function getPlanCognitiveWorkflow(): string {
  return `<cognitive_workflow>
BEFORE EVERY ACTION:
1. Do I understand enough? → Explore if needed, but don't over-explore
2. Are there ambiguities? → Ask questions (plan_navigator) first
3. Am I using the right search tool? → Match tool to need
4. Is the plan ready? → Document it, then hand off

DECISION FLOW:

UNDERSTAND REQUEST
└── What does the user want?

EXPLORE (right tool for the job)
├── Semantic understanding → echo_search
├── Find exact identifier → grep_search (faster)
├── Find files by name → glob_search
├── See structure → list_files
└── Read specific file → read_file

CLARIFY (before documenting)
└── Any uncertainty? → plan_navigator (REQUIRED before handoff)

DOCUMENT
└── Clear plan → todo_write

HAND OFF
└── All questions answered? → plan_handoff
</cognitive_workflow>

<search_balance>
DON'T OVER-RELY ON ONE TOOL:

START exploration       → echo_search (semantic, finds related code)
KNOW the identifier?    → grep_search (faster, exact match)
NEED files by pattern?  → glob_search (e.g., *.test.ts)
EXPLORING structure?    → list_files

EFFICIENT PATTERN:
echo_search (understand) → grep_search (pinpoint) → read_file (verify)

Don't call echo_search repeatedly for the same concept.
Switch to grep_search once you know what you're looking for.
</search_balance>`;
}
