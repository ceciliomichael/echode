export interface JsonParseEvent {
  type: 'key' | 'value_start' | 'value_chunk' | 'value_end';
  value?: string;
}

type ParserState = 
  | 'WAITING_KEY_START' 
  | 'READING_KEY' 
  | 'WAITING_COLON' 
  | 'WAITING_VALUE_START' 
  | 'READING_STRING_VALUE' 
  | 'READING_PRIMITIVE_VALUE'
  | 'ESCAPING';

export class IncrementalJsonParser {
  private state: ParserState = 'WAITING_KEY_START';
  private buffer = '';
  private currentKey = '';
  private unicodeBuffer = '';

  parse(chunk: string): JsonParseEvent[] {
    const events: JsonParseEvent[] = [];
    
    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];
      
      switch (this.state) {
        case 'WAITING_KEY_START':
          if (char === '"') {
            this.state = 'READING_KEY';
            this.currentKey = '';
          }
          break;
          
        case 'READING_KEY':
          if (char === '"') {
            this.state = 'WAITING_COLON';
            events.push({ type: 'key', value: this.currentKey });
          } else {
            this.currentKey += char;
          }
          break;
          
        case 'WAITING_COLON':
          if (char === ':') {
            this.state = 'WAITING_VALUE_START';
          }
          break;
          
        case 'WAITING_VALUE_START':
          if (char === '"') {
            this.state = 'READING_STRING_VALUE';
            events.push({ type: 'value_start' });
          } else if (char !== ' ' && char !== '\n' && char !== '\t' && char !== '\r') {
            // Start of primitive (number, boolean, null)
            // For now we mostly care about strings for content streaming, 
            // but we should handle primitives to stay in sync.
            this.state = 'READING_PRIMITIVE_VALUE';
            events.push({ type: 'value_start' });
            // Re-process this char as part of the value
            i--; 
          }
          break;
          
        case 'READING_STRING_VALUE':
          if (char === '\\') {
            this.state = 'ESCAPING';
          } else if (char === '"') {
            this.state = 'WAITING_KEY_START'; // Reset to look for next key
            events.push({ type: 'value_end' });
          } else {
            events.push({ type: 'value_chunk', value: char });
          }
          break;
          
        case 'ESCAPING':
          this.state = 'READING_STRING_VALUE';
          // Handle common escapes
          if (char === 'n') events.push({ type: 'value_chunk', value: '\n' });
          else if (char === 'r') events.push({ type: 'value_chunk', value: '\r' });
          else if (char === 't') events.push({ type: 'value_chunk', value: '\t' });
          else if (char === '"') events.push({ type: 'value_chunk', value: '"' });
          else if (char === '\\') events.push({ type: 'value_chunk', value: '\\' });
          else if (char === '/') events.push({ type: 'value_chunk', value: '/' });
          else if (char === 'b') events.push({ type: 'value_chunk', value: '\b' });
          else if (char === 'f') events.push({ type: 'value_chunk', value: '\f' });
          else if (char === 'u') {
            // Unicode escape - simplistic handling (buffering not implemented for brevity, 
            // assuming generic tool content doesn't heavily rely on split unicode escapes)
            // Ideally we need a UNICODE_ESCAPE state. 
            // For robustness, let's just emit \u if we don't handle it fully, 
            // or better, strict JSON parsing of fragments is hard. 
            // Let's emit the raw sequence if we can't parse it easily? 
            // Or just ignore it? 
            // Correct way: Enter UNICODE state.
            // For now: just emit \u to avoid swallowing chars, but it won't be unescaped.
            // A better tradeoff for code generation: mostly ASCII/UTF8 chars, explicit unicode escapes are rare in code body.
            events.push({ type: 'value_chunk', value: '\\u' }); 
          }
          else {
            // Unknown escape, just emit char
            events.push({ type: 'value_chunk', value: char });
          }
          break;

        case 'READING_PRIMITIVE_VALUE':
          if (char === ',' || char === '}') {
            this.state = 'WAITING_KEY_START';
            events.push({ type: 'value_end' });
            if (char === '}') {
                // Could be end of object
            }
          } else {
             // Accumulate primitive value if needed, or stream it
             events.push({ type: 'value_chunk', value: char });
          }
          break;
      }
    }
    
    return events;
  }
}