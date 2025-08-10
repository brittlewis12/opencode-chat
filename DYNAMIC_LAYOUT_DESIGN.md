# Dynamic Width/Height Layout Design for OpenCode Chat UI

## Executive Summary

The current OpenCode Chat UI constrains all content to a maximum width of ~896px (`max-w-4xl`), resulting in significant wasted horizontal space on wide screens and suboptimal presentation of different content types. This design document proposes a dynamic layout system that adapts to screen size and content type, maximizing readability and information density.

## 1. Problem Analysis

### Current Layout Limitations

- **Fixed Maximum Width**: All content is constrained to `max-w-4xl` (~896px), regardless of screen size
- **One-size-fits-all Approach**: Text, code, and tool outputs all use the same narrow message bubble constraints
- **Wasted Horizontal Space**: On screens wider than 1200px, 40-60% of horizontal space is unused
- **Suboptimal Code Display**: Wide code blocks and command outputs are artificially constrained, requiring horizontal scrolling
- **Tool Call Cramping**: Complex tool outputs are embedded within narrow message bubbles

### Content Type Analysis

Different content types have vastly different optimal widths:

1. **Regular Text/Markdown**: 
   - Optimal: 60-80 characters per line (600-800px)
   - Current: Constrained to message bubble width (~400-600px)

2. **Code Blocks**:
   - Optimal: 100-120 characters per line (1000-1200px)
   - Current: Artificially narrow, requiring horizontal scroll

3. **Tool Command/Output**:
   - Optimal: Full available width for complex outputs (up to 1400-1600px)
   - Current: Cramped inside message bubbles

4. **Data/Tables**:
   - Optimal: Dynamic based on content, often wide (800-1400px)
   - Current: Not well-supported

### User Scanning Patterns & Readability Research

- **Text Reading**: 45-75 characters per line optimal for sustained reading
- **Code Scanning**: Developers prefer wider displays to see more context
- **Tool Output Review**: Wide displays reduce cognitive load when reviewing complex outputs
- **Conversation Flow**: Users scan chronologically, so vertical flow is critical

### Mobile vs Desktop Needs

- **Mobile (< 768px)**: Current narrow layout is appropriate
- **Tablet (768-1024px)**: Could benefit from slightly wider content areas
- **Desktop (1024-1440px)**: Significant opportunity for better space utilization
- **Wide Desktop (> 1440px)**: Major waste of horizontal space currently

## 2. Design Proposals

### Dynamic Width System Based on Content Type

#### Core Concept: Content-Aware Layout Containers

Instead of fixed message bubbles, implement dynamic containers that adapt based on content type:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Wide Screen Layout (1440px+)                                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  User: [────────────────────── 600px text ──────────────────────]               │
│                                                                                 │
│  Assistant: [──────────── 800px text response ────────────────]                 │
│                                                                                 │
│  ┌─────────────────────────── 1200px tool output ───────────────────────────┐   │
│  │ › bash                                                                    │   │
│  │ $ find . -name "*.tsx" | head -20                                        │   │
│  │ ./src/components/Chat.tsx                                                │   │
│  │ ./src/components/MessageContent.tsx                                      │   │
│  │ [... wide output continues ...]                                          │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Proposed Width Classes by Content Type

1. **Text Content** (`content-text`):
   - Mobile: 90% width
   - Tablet: min(70%, 600px)
   - Desktop: min(60%, 800px)
   - Wide: min(50%, 900px)

2. **Code Blocks** (`content-code`):
   - Mobile: 95% width
   - Tablet: 85% width
   - Desktop: min(80%, 1200px)
   - Wide: min(75%, 1400px)

3. **Tool Outputs** (`content-tool`):
   - Mobile: 95% width
   - Tablet: 90% width
   - Desktop: min(85%, 1300px)
   - Wide: min(80%, 1600px)

4. **Mixed Content** (`content-mixed`):
   - Adapts to the widest content type within the message
   - Ensures consistent alignment for readability

### Breaking Tool Calls Out of Assistant Message Bubbles

#### Current Structure (Problematic)
```
┌─Assistant Message Bubble─────────────────┐
│ Here's the file content:                │
│                                         │
│ ┌─Tool Output (Constrained)───────────┐  │
│ │ › Read                             │  │
│ │ Very long file content that gets   │  │
│ │ constrained and hard to read...    │  │
│ └────────────────────────────────────┘  │
│                                         │
│ The file shows...                       │
└─────────────────────────────────────────┘
```

#### Proposed Structure (Improved)
```
┌─Assistant Message─────────────────────────┐
│ Here's the file content:                 │
└──────────────────────────────────────────┘

┌─Tool Output (Full Width)─────────────────────────────────────────────────────┐
│ › Read                                                                      │
│ Long file content that can now use the full available width for better     │
│ readability and reduced horizontal scrolling...                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─Assistant Message (Continued)────────────┐
│ The file shows that the implementation   │
│ uses React components with...            │
└──────────────────────────────────────────┘
```

### Responsive Breakpoints Strategy

#### Proposed Breakpoints
- **xs**: < 480px (Mobile portrait)
- **sm**: 480px - 768px (Mobile landscape, small tablets)
- **md**: 768px - 1024px (Tablets, small laptops)
- **lg**: 1024px - 1440px (Laptops, desktop)
- **xl**: 1440px - 1920px (Large desktop)
- **2xl**: > 1920px (Ultra-wide displays)

#### Layout Behavior by Breakpoint

**xs/sm (Mobile)**:
- Keep current narrow layout
- Stack tool outputs vertically
- Minimize chrome, maximize content

**md (Tablet)**:
- Slight width expansion
- Start separating tool outputs from message bubbles
- More generous padding

**lg (Desktop)**:
- Implement content-aware widths
- Full tool output separation
- Optimize for scanning and reading

**xl/2xl (Wide Desktop)**:
- Maximum content width utilization
- Consider side-by-side layouts for some content
- Enhanced visual hierarchy

### Height Considerations for Long Outputs

#### Current Issues
- Long tool outputs create very tall message bubbles
- Difficult to maintain conversation context
- Scrolling through large outputs is cumbersome

#### Proposed Solutions

1. **Collapsible Tool Outputs**:
   - Auto-collapse outputs > 20 lines
   - Show preview (first/last few lines)
   - Expandable with smooth animations

2. **Virtual Scrolling for Large Outputs**:
   - Implement virtual scrolling for outputs > 100 lines
   - Maintain performance with large datasets

3. **Sticky Context Headers**:
   - Tool headers stay visible during scroll
   - Maintain context of what you're viewing

## 3. Key Decisions & Tradeoffs

### Should Tool Calls Be Inside or Outside Message Bubbles?

**Decision: Outside (Separated)**

**Rationale**:
- **Pro**: Allows optimal width for tool content
- **Pro**: Cleaner visual separation of assistant text vs tool execution
- **Pro**: Better scanning - users can quickly identify tool outputs
- **Pro**: Enables better responsiveness for different content types
- **Con**: May break visual message continuity
- **Con**: Slightly more complex to implement

**Mitigation**: Use consistent styling and subtle visual connectors to maintain flow.

### How to Handle Mixed Content?

**Decision: Content-Aware Container Sizing**

**Approach**:
1. Analyze message parts during render
2. Determine the appropriate container width based on content types present
3. Apply consistent width to the entire message group (text + tools)
4. Use nested containers for fine-grained control

### Alignment Strategies

**Decision: Asymmetric Layout**

- **User Messages**: Right-aligned, narrower (optimized for text input)
- **Assistant Text**: Left-aligned, medium width (optimized for reading)
- **Tool Outputs**: Left-aligned, wider (optimized for data/code)
- **System Messages**: Centered, narrow (minimal visual weight)

### Visual Hierarchy and Scanning Patterns

**Priority Order**:
1. **Assistant Text Responses** (highest priority)
2. **Tool Command Summaries** (medium-high)
3. **Tool Outputs** (medium - available but not dominant)
4. **User Messages** (low - already seen by user)

**Implementation**:
- Use typography scale and spacing to create clear hierarchy
- Assistant text gets most visual prominence
- Tool outputs use subdued backgrounds
- Proper whitespace prevents visual crowding

### Performance Implications of Dynamic Sizing

**Considerations**:
- **Container Queries**: Modern browsers support this efficiently
- **Re-layout Costs**: Minimize unnecessary re-calculations
- **Memory Usage**: Virtual scrolling for large outputs
- **Rendering Performance**: Avoid complex CSS calculations in hot paths

**Mitigations**:
- Use CSS custom properties for dynamic values
- Implement lazy loading for large tool outputs
- Optimize re-renders with React.memo and useMemo
- Progressive enhancement for older browsers

## 4. Implementation Approach

### CSS Strategies

#### Primary: CSS Grid with Container Queries

```css
.chat-container {
  display: grid;
  grid-template-columns: 
    minmax(2rem, 1fr) 
    minmax(auto, var(--content-max-width)) 
    minmax(2rem, 1fr);
  gap: 1rem;
}

.message-content {
  grid-column: 2;
  container-type: inline-size;
}

@container (min-width: 1200px) {
  .content-tool {
    max-width: 1400px;
  }
  
  .content-text {
    max-width: 800px;
  }
}
```

#### Fallback: CSS Custom Properties + Media Queries

```css
:root {
  --text-max-width: 600px;
  --code-max-width: 1000px;
  --tool-max-width: 1200px;
}

@media (min-width: 1440px) {
  :root {
    --text-max-width: 800px;
    --code-max-width: 1200px;
    --tool-max-width: 1400px;
  }
}
```

### React Component Architecture Changes Needed

#### New Component Structure

```typescript
// New container components
<ChatContainer>
  <MessageFlow>
    <UserMessage />
    <AssistantMessage />
    <ToolOutput separated />
    <AssistantMessage continued />
  </MessageFlow>
</ChatContainer>

// Updated MessageList.tsx
interface MessageListProps {
  // ... existing props
  enableDynamicLayout?: boolean;
  breakToolsOut?: boolean;
}
```

#### Content Type Detection

```typescript
enum ContentType {
  TEXT = 'text',
  CODE = 'code',
  TOOL = 'tool',
  MIXED = 'mixed'
}

function analyzeMessageContent(parts: MessagePart[]): ContentType {
  const hasText = parts.some(p => p.type === 'text');
  const hasCode = parts.some(p => p.type === 'code');
  const hasTools = parts.some(p => p.type === 'tool');
  
  if (hasTools) return ContentType.TOOL;
  if (hasCode && hasText) return ContentType.MIXED;
  if (hasCode) return ContentType.CODE;
  return ContentType.TEXT;
}
```

#### Smooth Transitions and Animations

```typescript
// Use framer-motion or CSS transitions
const layoutTransition = {
  duration: 0.3,
  ease: "easeInOut"
};

<AnimatePresence>
  <motion.div
    layout
    transition={layoutTransition}
    className={getContentClassName(contentType)}
  >
    {content}
  </motion.div>
</AnimatePresence>
```

## 5. Specific Recommendations

### Optimal Character Widths for Each Content Type

1. **Plain Text**: 45-75 characters (optimal: 65)
   - **Width**: 600-800px (with 16px font)
   - **Line Height**: 1.6

2. **Code**: 80-120 characters (optimal: 100)
   - **Width**: 1000-1200px (with 14px monospace)
   - **Line Height**: 1.4

3. **Tool Commands**: 80-100 characters
   - **Width**: Similar to code blocks
   - **Emphasized styling**: Background, borders

4. **Tool Output**: Variable, optimized for content type
   - **Text output**: Follow text rules
   - **JSON/Data**: Follow code rules
   - **Logs**: Full width available

### Breakpoint Values

```css
/* Mobile First Approach */
.content-container {
  width: 95%; /* xs: < 480px */
}

@media (min-width: 480px) {
  .content-container { width: 90%; } /* sm */
}

@media (min-width: 768px) {
  .content-container { max-width: 700px; } /* md */
}

@media (min-width: 1024px) {
  .content-text { max-width: 800px; } /* lg */
  .content-code { max-width: 1200px; }
  .content-tool { max-width: 1300px; }
}

@media (min-width: 1440px) {
  .content-text { max-width: 900px; } /* xl */
  .content-code { max-width: 1400px; }
  .content-tool { max-width: 1600px; }
}
```

### Margin/Padding Strategies

#### Vertical Spacing
```css
.message-group {
  margin-bottom: 2rem; /* Generous spacing between messages */
}

.message-part {
  margin-bottom: 1rem; /* Moderate spacing within messages */
}

.tool-output {
  margin: 1.5rem 0; /* Extra emphasis for tool outputs */
}
```

#### Horizontal Spacing
```css
.chat-container {
  padding-inline: max(2rem, 5vw); /* Responsive edge padding */
}

.content-container {
  padding: 1.5rem 2rem; /* Generous internal padding */
}
```

### Typography Adjustments for Different Widths

#### Responsive Typography Scale

```css
:root {
  /* Base (mobile) */
  --font-size-body: 16px;
  --font-size-code: 14px;
  --line-height-text: 1.6;
  --line-height-code: 1.4;
}

@media (min-width: 768px) {
  :root {
    --font-size-body: 17px;
    --font-size-code: 15px;
  }
}

@media (min-width: 1024px) {
  :root {
    --font-size-body: 18px;
    --font-size-code: 16px;
  }
}
```

#### Content-Specific Typography

```css
.content-text {
  font-size: var(--font-size-body);
  line-height: var(--line-height-text);
}

.content-code {
  font-size: var(--font-size-code);
  line-height: var(--line-height-code);
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
}

.tool-header {
  font-size: calc(var(--font-size-body) * 0.9);
  font-weight: 600;
  font-family: monospace;
}
```

## 6. Visual Examples

### Current Layout (Wide Screen Waste)
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Browser Window (1440px wide)                                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│           ┌────────────────────────────────────────────┐                        │
│           │ Fixed Width Container (896px)              │                        │
│           │                                            │                        │
│           │  User: Short message           │           │                        │
│           │                                            │                        │
│           │  Assistant: Long response but still│       │                        │
│           │  constrained to narrow width...   │       │                        │
│           │                                            │                        │
│           │  ┌──Tool Output (Very Cramped)──┐         │                        │
│           │  │ $ long command that needs    │          │                        │
│           │  │   horizontal scrolling...    │          │                        │
│           │  └──────────────────────────────┘         │                        │
│           │                                            │                        │
│           └────────────────────────────────────────────┘                        │
│                                                                                 │
│    ← 272px waste →                            ← 272px waste →                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Proposed Layout (Optimized Width Usage)
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Browser Window (1440px wide)                                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│        User: [────────── 600px text ─────────]                                 │
│                                                                                 │
│   Assistant: [─────────────── 800px response ──────────────]                   │
│                                                                                 │
│   ┌───────────────────── 1200px tool output ─────────────────────────────────┐  │
│   │ › Read /path/to/file.tsx                                                  │  │
│   │                                                                           │  │
│   │ export function ComponentName() {                                         │  │
│   │   // Much more readable code display with proper width                   │  │
│   │   const longVariableNameThatWouldPreviouslyRequireScrolling = getValue() │  │
│   │   return <div className="properly-visible-classname">Content</div>       │  │
│   │ }                                                                         │  │
│   └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│   Assistant: [─────────── Analysis continues here ─────────]                   │
│                                                                                 │
│ ← 120px margin →                                        ← 120px margin →       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Mobile Layout (Preserved Usability)
```
┌─────────────────────────────────┐
│ Mobile (375px wide)             │
├─────────────────────────────────┤
│                                 │
│ User: Short msg      │          │
│                                 │
│ Assistant: Response text that   │
│ wraps nicely on mobile screens  │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ › bash                      │ │
│ │ $ mobile-friendly display   │ │
│ │ output here                 │ │
│ └─────────────────────────────┘ │
│                                 │
│ ← 20px → content ← 20px →       │
└─────────────────────────────────┘
```

### Tool Output Flow Example
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Assistant Message: "I'll search the codebase for components"                     │
└─────────────────────────────────────────────────────────────────────────────────┘
  ↓ (visual connector)
┌─────────────────────────────────────────────────────────────────────────────────┐
│ › Grep                                                                          │
│ Pattern: "export.*Component"                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ ./src/components/MessageContent.tsx:export default function MessageContent │ │
│ │ ./src/components/MessageList.tsx:export default function MessageList       │ │
│ │ ./src/components/Chat.tsx:export default function Chat                     │ │
│ │ [... more results ...]                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
  ↓ (visual connector)
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Assistant Message: "I found several components. Let me examine the main Chat    │
│ component structure..."                                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 7. Integration with Existing Inline Permission UI

### Current Inline Permission Handling

The existing `InlinePermission` component is embedded within assistant message bubbles when `pendingPermission.callID` matches a tool call. This creates a seamless approval flow.

### Proposed Integration

#### Option A: Keep Permissions in Assistant Messages (Recommended)
- Permission UI stays embedded in assistant text messages
- Tool outputs display "Waiting for permission..." state
- Maintains current UX while gaining layout benefits

#### Option B: Move Permissions to Tool Output Areas
- Show permission UI directly in tool containers
- More direct visual connection between permission and tool
- May fragment conversation flow

### Implementation Details

```typescript
// In MessageList.tsx - keep permission in assistant bubble
<AssistantMessage>
  {textContent}
  {hasInlinePermission && (
    <InlinePermission 
      permission={activePermission}
      onRespond={onRespondPermission}
    />
  )}
</AssistantMessage>

// Tool output shows pending state
<ToolOutput status="waiting-permission">
  <ToolHeader>› {toolName}</ToolHeader>
  <PermissionWaitingIndicator />
</ToolOutput>
```

### Benefits of Preserved Integration

1. **Familiar UX**: Users already understand current permission flow
2. **Context Preservation**: Permission appears near explaining text
3. **Conversation Continuity**: Maintains chronological message flow
4. **Implementation Simplicity**: Minimal changes to existing permission logic

## 8. Light and Dark Theme Considerations

### Color Scheme Adaptations

#### Light Theme Enhancements
```css
.light-theme {
  --content-bg: #ffffff;
  --content-border: #e5e7eb;
  --tool-bg: #f8fafc;
  --tool-border: #cbd5e1;
  --code-bg: #f1f5f9;
}
```

#### Dark Theme Enhancements
```css
.dark-theme {
  --content-bg: #1e293b;
  --content-border: #475569;
  --tool-bg: #0f172a;
  --tool-border: #334155;
  --code-bg: #0f1419;
}
```

### Visual Hierarchy in Both Themes

- **Contrast Ratios**: Ensure WCAG AA compliance in both themes
- **Background Differentiation**: Clear separation between content types
- **Focus States**: Enhanced visibility for interactive elements
- **Syntax Highlighting**: Optimized color schemes for each theme

## 9. Open Questions & Ambiguities

### High Priority Questions

1. **Progressive Enhancement Strategy**:
   - Should we implement this as a feature flag initially?
   - How to handle browsers without container query support?

2. **User Preference Controls**:
   - Should users be able to toggle between layouts?
   - Save layout preferences per session or globally?

3. **Tool Output Handling Edge Cases**:
   - How to handle extremely wide content (tables, logs)?
   - Should we implement horizontal scrolling limits?

4. **Performance Thresholds**:
   - At what content size do we switch to virtual scrolling?
   - How to balance smooth animations with performance?

### Medium Priority Questions

5. **Keyboard Navigation**:
   - How does dynamic layout affect screen reader navigation?
   - Tab order considerations with separated tool outputs?

6. **Copy/Paste Behavior**:
   - Should copying include layout formatting?
   - How to handle copying across separated components?

7. **Print Styling**:
   - How should the dynamic layout render in print media?
   - Optimize for PDF export scenarios?

### Low Priority Questions

8. **Animation Preferences**:
   - Respect `prefers-reduced-motion`?
   - Allow users to disable layout transitions?

9. **Future Content Types**:
   - How to extend the system for new content types?
   - Plugin architecture for custom content renderers?

## Areas Needing User Feedback

### A/B Testing Opportunities

1. **Tool Separation**: Test separated vs. embedded tool outputs
2. **Content Widths**: Find optimal widths for different content types
3. **Transition Speed**: Determine preferred animation timing

### User Research Questions

1. **Scanning Patterns**: How do users actually scan conversations?
2. **Content Prioritization**: What content needs most visual prominence?
3. **Wide Screen Usage**: How do users with ultrawide monitors want to use the space?

### Accessibility Testing

1. **Screen Reader Compatibility**: Test with actual screen reader users
2. **Low Vision Support**: Ensure layout works with zoom/magnification
3. **Motor Impairment**: Verify keyboard navigation efficiency

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- CSS architecture setup
- Basic responsive containers
- Content type detection

### Phase 2: Core Layout (Weeks 3-4)
- Dynamic width implementation
- Tool output separation
- Basic animations

### Phase 3: Polish (Weeks 5-6)
- Typography optimization
- Theme integration
- Performance optimization

### Phase 4: Enhancement (Weeks 7-8)
- Advanced features (virtual scrolling)
- User preferences
- Accessibility improvements

This design document provides a comprehensive foundation for implementing dynamic layouts that will significantly improve the OpenCode Chat experience on wide screens while maintaining excellent mobile usability.