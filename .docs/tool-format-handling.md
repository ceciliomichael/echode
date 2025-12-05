## Tool-Format Handling in Content

How we avoid accidentally parsing or executing tool calls when they appear inside content (e.g., file text shown back to the user):

- **Balanced tag matching for parameters**: The `findMatchingParameterClose()` function uses depth counting to find the correct closing `</parameter>` tag. When parsing `<parameter name="content">`, it tracks nested `<parameter>...</parameter>` tags and only closes when depth returns to 0. This allows file content containing tool-format XML to be written correctly.
- **Parameters treated as literal**: Content inside `<parameter name="content">...</parameter>` is parsed as plain text after balanced extraction. Any nested `<function_calls>...</function_calls>` inside that parameter is preserved as literal text, not executed.
- **Code fences are safe (streaming)**: The streaming parser skips tool parsing while inside Markdown code fences (``` … ```), so tool-shaped XML inside fenced blocks will not execute.
- **Escaping works too**: Emitting `<`/`>` as `&lt;`/`&gt;` prevents parsing if you must include raw tool tags inline.
- **Nested tool call rejection**: If a parameter value contains `<function_calls>` or `<invoke name=` patterns, the tool call is rejected to prevent injection attacks.
- **Execution timing (streaming)**: Tools execute as soon as each `</invoke>` arrives. Diagnostics are fetched only after the outer `</function_calls>` closes, so linting doesn't interrupt streaming.
- **Non-streaming parser**: Uses balanced tags and literal parameters; nested tool tags inside parameter content are properly handled via `findMatchingParameterClose()`.
- **UI behavior**: Tool blocks render during streaming, and file-modification blocks auto-expand on completion to show diffs/results.

### Example: Writing Files with Tool-Format Content

This works correctly:
```xml
<function_calls>
<invoke name="write_to_file">
<parameter name="path">example.txt</parameter>
<parameter name="content">
Here's how to call a tool:

<function_calls>
<invoke name="write_to_file">
<parameter name="path">example.txt</parameter>
<parameter name="content">sample text</parameter>
</invoke>
</function_calls>

</parameter>
</invoke>
</function_calls>
```

The balanced tag matching ensures the outer `</parameter>` is correctly identified, even with nested `</parameter>` tags inside.
