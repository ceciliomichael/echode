Here is a blueprint for the JSON method, outlining the structure for both the small, quick-loading index file and the detailed, full-content session files.

-----

## 📘 JSON Storage Blueprint for Chat History

### 1\. Index File (`index.json`)

This single file contains minimal metadata to quickly generate the list of all past conversations.

| Key | Type | Description |
| :--- | :--- | :--- |
| **Root** | Array (`[]`) | An array of chat metadata objects. |
| **`id`** | String | A unique identifier for the conversation (e.g., a timestamp like `"20251207-152054"`). This is used to link to the full session file. |
| **`title`** | String | A short, human-readable title for the chat, displayed in the history list (e.g., `"Generate Login Form"`). |
| **`lastUpdate`** | String (ISO 8601) | The timestamp of the last message sent in this conversation. Used for sorting the list. |

#### Example `index.json`

```json
[
  {
    "id": "20251207-152054",
    "title": "React Login Form Component",
    "lastUpdate": "2025-12-07T15:30:10Z"
  },
  {
    "id": "20251206-091230",
    "title": "SQL Query Optimization",
    "lastUpdate": "2025-12-06T10:05:00Z"
  }
]
```

-----

### 2\. Session File (`[id].json`)

This file contains the full history of a single conversation, used when a user clicks an item in the list.

| Key (Message Object) | Type | Description |
| :--- | :--- | :--- |
| **Root** | Array (`[]`) | An array of message objects, in chronological order. |
| **`role`** | String | The sender: `"user"` or `"assistant"`. |
| **`timestamp`** | String (ISO 8601) | The precise time the message was sent/received. |
| **`content`** | String | The actual text of the message (the prompt or the response, including any code blocks). |
| **`model?`** | String | *(Optional)* The specific AI model used for the response. |

#### Example `20251207-152054.json`

````json
[
  {
    "role": "user",
    "timestamp": "2025-12-07T15:21:00Z",
    "content": "Generate a simple and accessible React component for a login form."
  },
  {
    "role": "assistant",
    "timestamp": "2025-12-07T15:21:15Z",
    "content": "```jsx\nimport React, { useState } from 'react';\n\nfunction LoginForm() {\n  // component code...\n}\n\nexport default LoginForm;\n```",
    "model": "gpt-4o"
  }
  // ... potentially more turns here
]
````