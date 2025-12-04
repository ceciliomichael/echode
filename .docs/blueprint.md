# Summarization Flow Blueprint (Simple Version)

## 1. When to Summarize

- **Input**  
  - `messages`: full chat history  
  - `systemPrompt`: current system prompt  
  - `contextSettings`: includes `enabled`, `model`, `maxContextTokens`, `thresholdPercent`

- **Steps**  
  1. Estimate token usage of `systemPrompt + messages`.
  2. Compute `usagePercent = totalTokens / maxContextTokens * 100`.
  3. If:
     - summarization disabled, or  
     - no model configured, or  
     - `usagePercent < thresholdPercent`  
     → **Do nothing**.
  4. Otherwise → **trigger summarizer**.

---

## 2. What Gets Summarized (What Survives)

- **History is split into three parts**:
  - **First message (`firstMessage`)**  
    - The very oldest message, usually the original user task.  
    - **All of its content and pipeline survive unchanged**  
      (role, text, tool executions, attachments, etc.).
  - **Last N messages (`lastMessages`)**  
    - The most recent N messages (e.g. 4).  
    - **All of their content and pipeline survive unchanged**  
      (assistant replies, tool calls/results, attachments, etc.).
  - **Middle messages (`messagesToSummarize`)**  
    - Everything between `firstMessage` and `lastMessages`.  
    - These are the only messages that get summarized and then removed.

- **Goal**  
  - Only the **middle** messages are compressed into a summary.  
  - The **first message** and the **last N messages** stay exactly as they were.

---

## 3. Build Summarization Prompt

- **Prepare content**:
  - For each `messagesToSummarize`:
    - Strip tool XML sections.
    - Truncate extremely long text.
    - Format as `[USER]` / `[ASSISTANT]` blocks.
    - Optionally add short tool execution summaries.

- **Prompt structure**:
  - A **system-style instruction**:  
    - “You are summarizing a coding assistant conversation for continuation.”  
    - Keep: main task, current work, key technical details, relevant files, decisions, TODOs.
  - Embed the conversation text:
    - `<conversation_to_summarize> ... </conversation_to_summarize>`.
  - Ask for a concise, structured summary.

---

## 4. Call Summarizer Model

- **Client → Extension**:
  - Webview sends `type: 'summarize'` with:
    - `requestId`, `prompt`, `provider`, `model`, `apiKey`, `baseURL`.

- **Extension → LLM**:
  - Build `messages = [{ role: 'user', content: prompt }]`.
  - Call `streamChat` with:
    - `maxTokens = 2000` (summary length limit).
    - `temperature = 0.0` (deterministic).
  - Collect streamed chunks into `summaryContent`.

- **Extension → Client**:
  - On stream end, send:
    - `type: 'summarizationResult'`, `requestId`, `summary: summaryContent`.

---

## 5. Rewrite History with Summary (What Survives Again)

- **Use the same split** as in step 2:
  - `firstMessage`, `lastMessages`.

- **Construct new history**:
  1. Start with `firstMessage` (if exists).  
     - **Unchanged content and pipeline**.
  2. Insert a new `summaryMessage`:
     - `role: 'assistant'`
     - `content: <conversation_summary>...summaryContent...</conversation_summary>`
  3. Append all `lastMessages` (unchanged).  
     - **Unchanged content and pipeline** (assistant, tools, attachments, etc.).

- **Effect**:
  - Old **middle messages** are removed.
  - Replaced by one compact **summary message**.
  - The **first (oldest) message** and the **last N (newest) messages** keep *all* their contents and tool pipelines exactly as they were.

---

## 6. Continue Chat Normally

- Next user/assistant turns use this shortened history:
  - `[ firstMessage ] → [ summary ] → [ recent messages ] → [ new messages ]`.
- The LLM sees:
  - Original task (untouched),
  - Compressed middle history,
  - Latest detailed steps (untouched),
  - And can continue without hitting context limits as fast.