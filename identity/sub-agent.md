# Sub-Agent Personality Template

Source: `src/utils/sub-agent/prompt-builder.ts`

```xml
<identity>
${definition.persona}
</identity>
```

Notes:
- This is dynamic and comes from sub-agent definition persona text.
- It is wrapped in additional autonomy/rules sections by the same prompt builder.