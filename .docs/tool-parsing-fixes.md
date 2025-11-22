# Tool Parsing Robustness Improvements

## Problem

The AI/LLM sometimes generates **malformed XML** when outputting tool calls, causing parsing failures. Common mistakes include:

1. **Duplicate opening tags**: `<function_call><function_call><tool_name>...`
2. **Missing closing tags**: `<function_call>...(no closing)</function_call><function_call>...`
3. **Duplicate closing tags**: `</function_call></function_call>`

### Example of Issue

From console logs:
```
<function_call>
<function_call>
<tool_name>read_file</tool_name>
<path>biome.json</path>
</function_call>
```

The AI output `<function_call>` twice instead of just once, causing the parser to fail.

## Solution

### 1. Parser Auto-Correction

Added `cleanToolCallContent()` function that automatically fixes common AI mistakes:

- **Removes duplicate opening tags**: `<function_call><function_call>` → `<function_call>`
- **Removes duplicate closing tags**: `</function_call></function_call>` → `</function_call>`
- **Adds missing closing tags**: Detects unclosed tool calls and adds `</function_call>` before next call

### 2. Enhanced System Prompt

Strengthened XML formatting instructions with:

- **CRITICAL XML RULES** section with explicit do's and don'ts
- Visual examples showing ✅ correct and ❌ wrong formatting
- Specific warning about duplicate tags in FORBIDDEN formats

### 3. Debug Logging

Added console logging to track when corrections are made:

```
[ToolParser] 🔧 Fixed 1 duplicate opening tag(s)
[ToolParser] ⚠️ AI generated malformed XML - automatically corrected
```

## Files Modified

1. **`webview-ui/src/lib/tool-parser.ts`**
   - Added `cleanToolCallContent()` function
   - Applied cleaning to all tool block extraction functions
   - Added debug logging

2. **`webview-ui/src/lib/tool-config.ts`**
   - Enhanced `<tool_format>` section with stronger XML rules
   - Added visual examples of correct/wrong formatting

## Testing

To test the fix:

1. Run the extension in debug mode
2. Ask the AI to use multiple tools
3. Watch console for `[ToolParser]` messages
4. Tool calls should work even if AI generates duplicate tags

## Future Improvements

- Add telemetry to track how often AI makes these mistakes
- Consider adding validation that shows warnings to model providers
- Potentially add retry logic with corrected format examples in context
