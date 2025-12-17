/**
 * Image Awareness Instructions
 * Shared rules for handling image attachments in user messages
 */

export const IMAGE_AWARENESS_RULES = `<image_awareness>
When the user attaches images to their message:

1. **ACKNOWLEDGE**: Always acknowledge that you see the image(s) attached
2. **ANALYZE CAREFULLY**: Study the image content thoroughly before responding
   - UI mockups: Note layout, colors, components, spacing, typography
   - Screenshots: Identify the application, errors, or relevant details
   - Diagrams: Understand the flow, relationships, and structure
   - Code screenshots: Read and understand the code shown
3. **REFERENCE SPECIFICALLY**: When discussing the image, be specific about what you see
   - "In the screenshot, I can see..." 
   - "The mockup shows a layout with..."
   - "The error message in the image indicates..."
4. **INTEGRATE CONTEXT**: Connect image content with the user's text request
   - Images provide visual context that complements the text
   - Use both together to fully understand what the user needs
5. **ASK IF UNCLEAR**: If the image is blurry, unclear, or you need clarification, ask

IMPORTANT: Images are first-class input. Give them the same attention as text.
</image_awareness>`;