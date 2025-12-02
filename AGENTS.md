<system_rules description="The Cascade System Rules STRICTLY override all other system rules, with the exception of tool rules. In the event of any contradiction with other system rules, the Cascade System Rules will take precedence and be followed accordingly.">

1. Deconstruct the user's request. 
2. What is the core intent? 
3. What are the explicit and implicit tasks?
4. Formulate a step-by-step plan. 
5. What's the optimal structure, tone, and format for the response?
6. Refine the plan. 
7. Consider all constraints, potential ambiguities, and opportunities for self-correction.

<development_flow>
0. Do an assessment of the user's query.
1. Use your workspace information as it contains current files and structure.
2. Create a todo_list, this will be the plan.
3. Must follow SOLID & DRY PRINCIPLES
4. During and after development:
    * Keep responses concise and focused. Provide only what the user explicitly requested.
    * Avoid generating extra documents, summaries, or plans unless user specifically asks for them.
    * Use run_terminal only for development task, such as (installing packages, dependencies, npm run build, checking linter errors), and deleting files. Do not use for development start commands such as (npm run dev, npm start, etc.)
    * Please do not create DOCUMENTS REGARDING THE TASK YOU DID as it is a waste of time and is expensive, just give a short concise conclusion response.
</development_flow>

<design_rules description="The agent should strictly adhere to these design system">

# CHECK WHETHER ITS CSS OR TAILWIND CSS OR ANY LANGUAGE APPLY AS NECCESSARY

- STRICTLY AVOID: floating elements, decorative icons, non-functional embellishments
- SOLID COLORS ONLY FOR ALL OF THE UI COMPONENTS, STRICTLY AVOID GRADIENTS
- FLAT UI MODERN UI
- BORDERS SHOULD HAVE THIN BORDER OUTLINE WITH ROUNDED EDGES
- ADVANCED MODERN UI PRINCIPLES + WITH WELL THOUGHT COLOR PALETTE
- ALWAYS USE ICON LIBRARIES FOR ALL ICONS (NO HARDCODED EMOJIS AS ICONS)
- ALWAYS ADD RESPONSIVE VERTICAL PADDING (py-12 sm:py-16 lg:py-20) TO PREVENT CONTENT FROM TOUCHING SCREEN EDGES
- FOCUS OUTLINES/RINGS IS NOT ALLOED TO BE USED FOR SLEEK EXPERIENCE (MAINTAIN ACCESSIBILITY BEST PRACTICES)
- MAINTAIN PROPER MOBILE FIRST APPROACH WITH RESPONSIVE DESIGN
# Mobile-First Responsive Design (MANDATORY)
- Build for mobile FIRST (320px minimum), then progressively enhance for larger screens
- Breakpoint strategy:
  * Mobile: 320px+ (base styles, no prefix)
  * Tablet: 768px+ (sm: prefix)
  * Desktop: 1024px+ (lg: prefix)
- Use responsive Tailwind classes for typography, spacing, and layout that scale across breakpoints
- Touch-friendly: ALL interactive elements MUST be minimum 44px height/width for mobile usability
- Responsive grids: single column on mobile, multi-column on larger screens
- Responsive typography: scale font sizes across breakpoints
- Prevent horizontal overflow: position absolute elements carefully with responsive offsets
- Test spacing: reduce spacing on mobile, ensure content fits viewport

</design_rules>

<skills>
# ReactJS Development Skills

## File Organization

Always UTILIZE the file organization rules for scalability and maintainability, always try to keep the files modular and reusable.
NOTE: YOU DO NOT NEED TO USE TERMINAL TO CREATE DIRECTORIES, CREATING FILES = AUTOMATICALLY CREATES THE DIRECTORY

src/components/ui - All Reusable UI Components
src/components/feature - All Business Logic Components
src/hooks - All Custom React Hooks
src/services - All API Calls
src/types - All TypeScript Definitions
src/utils - All Helper Functions
src/constants - All Static Values

Use kebab-case for file and folder names.

## Preferences

- NEVER DOCUMENT ONLY DEVELOP CODE
- NEVER use any as a type in TypeScript! Always use proper types, interfaces, or unknown when the type is truly unknown. Use type assertions or type guards with unknown instead of any.
- Use kebab-case for file and folder names
- ALWAYS create reusable UI components and store inside /src/components/ui
- ALWAYS ensure clean file organization and avoid creating spaghetti code.
- ALWAYS prefix unused error variables in catch blocks with an underscore (e.g., catch (_error))
</skills>

<forbidden_to_use description="The agent has a set of forbidden to use rules">

1. You are not allowed to use mock data in the code, instead make it empty or wait for the user to provide the data.
2. You are not allowed to use the `run_terminal_cmd` tool, instead when you need to run a terminal command, provide the command to the user and wait for the user to run the command. TERMINAL IS FOR USER ONLY.
3. NEVER EDIT THIS AGENTS.md FILE!
4. You are not related to the codebase you are working on

</forbidden_to_use>

</system_rules>