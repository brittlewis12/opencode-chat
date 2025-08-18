import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import CopyButton from "../components/CopyButton";
import "../styles/playground.css";

const themeColors = {
  "liquid-dark": "#0a0a0b",
  "liquid-light": "#ffffff",
  terminal: "#000000",
  pastel: "#fef3f8",
  "earth": "#f4f1e8",
  "ocean": "#0a1628",
  "forest": "#1a2f1a",
  "sunset": "#2d1b2e",
  "monochrome": "#1c1c1c",
  "coffee": "#3c2415",
};

// Custom dropdown component for Safari compatibility
function CustomSelect({ value, onChange, options, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`custom-select ${className}`}>
      <button
        className="custom-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {options.find((o) => o.value === value)?.label || value}
      </button>
      {isOpen && (
        <div className="custom-select-dropdown">
          {options.map((option) => (
            <button
              key={option.value}
              className={`custom-select-option ${value === option.value ? "selected" : ""}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Configure marked with proper options
marked.setOptions({
  breaks: true,
  gfm: true,
  pedantic: false,
  smartLists: true,
  smartypants: false,
  highlight: function (code, lang) {
    if (!lang) return code;
    try {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    } catch (e) {
      return code;
    }
  },
  langPrefix: "language-",
});

// Markdown renderer component
function MarkdownMessage({ content }) {
  // Parse markdown and split into parts
  const parts = React.useMemo(() => {
    const html = marked.parse(content);
    const parts = [];

    // Parse HTML to extract structure
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Convert to React elements
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.tagName === "PRE") {
        const codeNode = node.querySelector("code");
        if (codeNode) {
          const language = codeNode.className?.replace("language-", "") || "";
          // Get the already highlighted HTML from marked
          return {
            type: "code",
            content: codeNode.textContent,
            html: codeNode.innerHTML,
            language,
          };
        }
      }

      // For other HTML elements, return as HTML string
      return {
        type: "html",
        content: node.outerHTML,
      };
    };

    Array.from(tempDiv.childNodes).forEach((node) => {
      const processed = processNode(node);
      if (processed) parts.push(processed);
    });

    return parts;
  }, [content]);

  console.log("MarkdownMessage rendering, parts:", parts);

  return (
    <div className="message-content markdown-rendered">
      {parts.map((part, index) => {
        if (typeof part === "string") {
          return <span key={index}>{part}</span>;
        }

        if (part.type === "code") {
          return (
            <div key={index} className="message-code-block">
              <div className="message-code-wrapper">
                <div className="message-copy-button-wrapper">
                  <CopyButton text={part.content} />
                </div>
                <pre className="message-content-pre">
                  <code className={`language-${part.language}`}>
                    {part.content}
                  </code>
                </pre>
              </div>
              {part.language && (
                <div className="message-code-header">
                  <span className="message-code-lang">{part.language}</span>
                </div>
              )}
            </div>
          );
        }

        if (part.type === "html") {
          return (
            <div
              key={index}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(part.content),
              }}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

// Advanced Chat Input Component
function ChatInput() {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState([]);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Send message
      if (value.trim()) {
        console.log("Send:", value);
        setValue("");
        setAttachments([]);
      }
    }
  };

  const addAttachment = (type) => {
    const newAttachment = {
      id: Date.now(),
      type,
      name:
        type === "image"
          ? "screenshot.png"
          : type === "file"
            ? "document.pdf"
            : "recording.m4a",
    };
    setAttachments([...attachments, newAttachment]);
  };

  const removeAttachment = (id) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  return (
    <div className="chat-input-container">
      {attachments.length > 0 && (
        <div className="chat-attachments">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="chat-attachment">
              <span className="attachment-icon">
                {attachment.type === "image"
                  ? "🖼"
                  : attachment.type === "file"
                    ? "📄"
                    : "🎤"}
              </span>
              <span className="attachment-name">{attachment.name}</span>
              <button
                className="attachment-remove"
                onClick={() => removeAttachment(attachment.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-input-wrapper">
        <div className="chat-input-actions-left">
          <button
            className="chat-action-btn"
            onClick={() => addAttachment("image")}
            title="Add image"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="14" height="14" rx="2" />
              <circle cx="8" cy="8" r="1.5" />
              <path d="M17 12L13 8L8 13L3 9" />
            </svg>
          </button>
          <button
            className="chat-action-btn"
            onClick={() => addAttachment("file")}
            title="Attach file"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M11 2L5 2C4 2 3 3 3 4V16C3 17 4 18 5 18H15C16 18 17 17 17 16V8L11 2Z" />
              <path d="M11 2V8H17" />
            </svg>
          </button>
          <button
            className="chat-action-btn"
            onClick={() => addAttachment("audio")}
            title="Voice message"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="9" y="3" width="2" height="8" rx="1" />
              <path d="M6 8V9C6 11 8 13 10 13C12 13 14 11 14 9V8" />
              <path d="M10 13V17M7 17H13" />
            </svg>
          </button>
        </div>

        <textarea
          ref={textareaRef}
          className="chat-input-field"
          placeholder="Type a message... (Shift+Enter for new line)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        <div className="chat-input-actions-right">
          <button
            className={`chat-send-btn ${value.trim() ? "active" : ""}`}
            disabled={!value.trim()}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M2 10L18 2L14 10L18 18L2 10Z" />
              <path d="M14 10H2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="chat-input-hints">
        <span className="hint-chip">@mention</span>
        <span className="hint-chip">/commands</span>
        <span className="hint-chip">:emoji:</span>
        <span className="char-count">{value.length} / 4000</span>
      </div>
    </div>
  );
}

export default function PlaygroundSimple() {
  const [theme, setTheme] = useState("liquid-dark");
  const [density, setDensity] = useState("normal");

  // Apply syntax highlighting to static code blocks
  useEffect(() => {
    const highlightStaticCode = () => {
      // Apply to all code blocks - both in messages and static sections
      document.querySelectorAll("pre code").forEach((block) => {
        // Clear the highlighted flag
        delete block.dataset.highlighted;
        // Always re-highlight
        hljs.highlightElement(block);
      });
    };
    // Small delay to ensure DOM is ready
    setTimeout(highlightStaticCode, 100);
  }, [theme, density]);

  useEffect(() => {
    // Add global mobile styles to prevent overflow
    if (window.innerWidth <= 768) {
      const style = document.createElement("style");
      style.innerHTML = `
        * {
          max-width: 100vw !important;
          box-sizing: border-box !important;
        }
        body {
          overflow-x: hidden !important;
        }
        .playground {
          width: 100% !important;
          max-width: 100vw !important;
          overflow-x: hidden !important;
        }
        .showcase-section {
          width: 100% !important;
          max-width: 100vw !important;
        }
        .component-grid {
          width: 100% !important;
        }
        .btn, .field, .card {
          width: 100% !important;
          max-width: 100% !important;
        }
        .tabs-list {
          overflow-x: auto !important;
          overflow-y: hidden !important;
          -webkit-overflow-scrolling: touch !important;
          display: flex !important;
          flex-direction: row !important;
          white-space: nowrap !important;
        }
        .tab-trigger {
          flex-shrink: 0 !important;
        }
      `;
      document.head.appendChild(style);
      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

  useEffect(() => {
    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", themeColors[theme]);
    }
    // Also set body and html background to match for overscroll
    document.body.style.backgroundColor = themeColors[theme];
    document.documentElement.style.backgroundColor = themeColors[theme];

    // Force CSS refresh for Safari
    const link = document.querySelector('link[href*="playground.css"]');
    if (link) {
      const href = link.getAttribute("href");
      link.setAttribute("href", href + "?t=" + Date.now());
    }

    return () => {
      // Reset on unmount
      document.body.style.backgroundColor = "";
    };
  }, [theme]);

  // Add inline styles for mobile to force override
  const isMobile = window.innerWidth <= 768;
  const mobileStyles = isMobile
    ? {
        padding: "1rem",
        width: "100%",
        maxWidth: "100vw",
        boxSizing: "border-box",
        overflowX: "hidden",
        overflowY: "auto",
      }
    : {};

  return (
    <div
      className={`playground theme-${theme} density-${density}`}
      style={mobileStyles}
    >
      <div
        className="playground-header"
        style={
          isMobile
            ? {
                flexDirection: "column",
                gap: "1rem",
                alignItems: "stretch",
                width: "100%",
              }
            : {}
        }
      >
        <h1 style={isMobile ? { fontSize: "1.5rem" } : {}}>UI Playground</h1>
        <div
          className="controls"
          style={
            isMobile
              ? {
                  width: "100%",
                  flexDirection: "column",
                  gap: "0.5rem",
                }
              : {}
          }
        >
          <CustomSelect
            className="theme-selector"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "liquid-dark", label: "Liquid Dark" },
              { value: "liquid-light", label: "Liquid Light" },
              { value: "terminal", label: "Terminal" },
              { value: "pastel", label: "Pastel" },
              { value: "earth", label: "Earth Tones" },
              { value: "ocean", label: "Deep Ocean" },
              { value: "forest", label: "Forest" },
              { value: "sunset", label: "Sunset" },
              { value: "monochrome", label: "Monochrome" },
              { value: "coffee", label: "Coffee" },
            ]}
          />
          <CustomSelect
            className="density-selector"
            value={density}
            onChange={setDensity}
            options={[
              { value: "compact", label: "Compact" },
              { value: "normal", label: "Normal" },
              { value: "spacious", label: "Spacious" },
            ]}
          />
          <button
            className="btn btn-ghost"
            onClick={() => (window.location.href = "/")}
          >
            Back
          </button>
        </div>
      </div>
      <div
        className="showcase-grid"
        style={
          isMobile
            ? {
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                width: "100%",
              }
            : {}
        }
      >
        <section
          className="showcase-section"
          style={
            isMobile
              ? {
                  padding: "0.75rem",
                  width: "100%",
                  boxSizing: "border-box",
                }
              : {}
          }
        >
          <h2>Buttons</h2>
          <div
            className="component-grid"
            style={
              window.innerWidth <= 768
                ? {
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }
                : {}
            }
          >
            <button
              className="btn btn-primary"
              style={window.innerWidth <= 768 ? { width: "100%" } : {}}
            >
              Primary
            </button>
            <button
              className="btn btn-secondary"
              style={window.innerWidth <= 768 ? { width: "100%" } : {}}
            >
              Secondary
            </button>
            <button
              className="btn btn-ghost"
              style={window.innerWidth <= 768 ? { width: "100%" } : {}}
            >
              Ghost
            </button>
            <button
              className="btn btn-danger"
              style={window.innerWidth <= 768 ? { width: "100%" } : {}}
            >
              Danger
            </button>
            <button
              className="btn btn-glass"
              style={window.innerWidth <= 768 ? { width: "100%" } : {}}
            >
              Glass Effect
            </button>
          </div>
        </section>

        <section className="showcase-section">
          <h2>Cards</h2>
          <div className="component-grid">
            <div className="card card-default">
              <h3>Default Card</h3>
              <p>Standard card with subtle styling</p>
            </div>
            <div className="card card-glass">
              <h3>Glass Card</h3>
              <p>With backdrop blur effect</p>
            </div>
            <div className="card card-elevated">
              <h3>Elevated Card</h3>
              <p>Higher shadow elevation</p>
            </div>
          </div>
        </section>

        <section className="showcase-section">
          <h2>Form Inputs</h2>
          <div className="component-grid">
            <div className="field">
              <label className="field-label">Text Input</label>
              <input
                className="field-input"
                type="text"
                placeholder="Enter text..."
              />
            </div>
            <div className="field">
              <label className="field-label">Search</label>
              <input
                className="field-input"
                type="search"
                placeholder="Search..."
              />
            </div>
            <div className="field">
              <label className="field-label">Number</label>
              <input className="field-input" type="number" placeholder="0" />
            </div>
          </div>
          <div style={{ marginTop: "var(--spacing-md)", width: "100%" }}>
            <div className="field">
              <label className="field-label">Textarea</label>
              <textarea
                className="field-textarea"
                rows={3}
                placeholder="Enter multiple lines of text..."
              />
            </div>
          </div>
        </section>

        <section className="showcase-section">
          <h2>Toggles & Switches</h2>
          <div className="component-grid">
            <div className="toggle-group">
              <label>Dark Mode</label>
              <div
                className="switch"
                data-checked
                onClick={(e) => {
                  if (e.currentTarget.hasAttribute("data-checked")) {
                    e.currentTarget.removeAttribute("data-checked");
                  } else {
                    e.currentTarget.setAttribute("data-checked", "true");
                  }
                }}
              >
                <div className="switch-thumb" />
              </div>
            </div>

            <div className="toggle-group">
              <label>Checkbox</label>
              <div
                className="checkbox"
                onClick={(e) => {
                  if (e.currentTarget.hasAttribute("data-checked")) {
                    e.currentTarget.removeAttribute("data-checked");
                  } else {
                    e.currentTarget.setAttribute("data-checked", "true");
                  }
                }}
              >
                <span className="checkbox-indicator">✓</span>
              </div>
            </div>

            <div className="radio-group">
              <div className="radio" data-checked onClick={() => {}}>
                <div className="radio-indicator" />
                <label>Option 1</label>
              </div>
              <div className="radio" onClick={() => {}}>
                <div className="radio-indicator" />
                <label>Option 2</label>
              </div>
            </div>
          </div>
        </section>

        <section className="showcase-section">
          <h2>Tabs</h2>
          <div className="tabs">
            <div className="tabs-list">
              <button className="tab-trigger" data-selected>
                Overview
              </button>
              <button className="tab-trigger">Features</button>
              <button className="tab-trigger">Documentation</button>
              <button className="tab-trigger">Settings</button>
            </div>
            <div className="tab-panel">
              <p>
                This is the overview tab content. The tab system supports
                multiple panels with smooth transitions.
              </p>
            </div>
          </div>
        </section>

        <section className="showcase-section">
          <h2>Code Blocks</h2>
          <div
            className="message-code-block"
            key={`code-block-${density}-${theme}`}
          >
            <div className="message-code-wrapper">
              <div className="message-copy-button-wrapper">
                <CopyButton
                  text={`function calculateTheme(mode) {
  const themes = ['liquid-dark', 'liquid-light', 'terminal', 'pastel'];
  return themes.find(t => t.includes(mode)) || themes[0];
}`}
                />
              </div>
              <pre className="message-content-pre">
                <code
                  className="language-javascript"
                  dangerouslySetInnerHTML={{
                    __html: hljs.highlight(
                      `function calculateTheme(mode) {
  const themes = ['liquid-dark', 'liquid-light', 'terminal', 'pastel'];
  return themes.find(t => t.includes(mode)) || themes[0];
}`,
                      { language: "javascript" },
                    ).value,
                  }}
                />
              </pre>
            </div>
            <div className="message-code-header">
              <span className="message-code-lang">javascript</span>
            </div>
          </div>
        </section>

        <section className="showcase-section">
          <h2>Messages</h2>
          <div className="message-container">
            <div className="message-row message-row-user">
              <div className="message message-user">
                <MarkdownMessage content="Hey! Can you help me build a flexible UI system?" />
              </div>
            </div>
            <div className="message-row message-row-assistant">
              <div className="message message-assistant">
                <MarkdownMessage content="Absolutely! I'll help you create a themeable, density-aware UI system that scales from compact powertools to spacious, friendly interfaces." />
              </div>
            </div>
            <div className="message-row message-row-user">
              <div className="message message-user">
                <MarkdownMessage
                  content={`Perfect! Let's start with the basics.
              
I need:
- Multiple themes (dark, light, fun)
- Density controls
- Mobile responsive
- Great chat input`}
                />
              </div>
            </div>
            <div className="message-row message-row-assistant">
              <div className="message message-assistant">
                <MarkdownMessage
                  content={`Got it! I'll build all of those features:

1. **Themes**: Liquid Dark, Liquid Light, Terminal Matrix, and Pastel Dream
2. **Density**: Compact, Normal, and Spacious modes
3. **Mobile**: Fully responsive with proper viewport handling
4. **Chat Input**: Auto-resize, attachments, hints, and character counter

Let me implement these for you!`}
                />
              </div>
            </div>
            <div className="message-row message-row-user">
              <div className="message message-user">
                <MarkdownMessage
                  content={`Here's my current code:

\`\`\`javascript
function calculateTheme(mode) {
  const themes = ['liquid-dark', 'liquid-light'];
  return themes.find(t => t.includes(mode)) || themes[0];
}
\`\`\`

Can you improve it?`}
                />
              </div>
            </div>
            <div className="message-row message-row-assistant">
              <div className="message message-assistant">
                <MarkdownMessage
                  content={`Sure! Here's an improved version with TypeScript:

\`\`\`typescript
interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
  };
  isDark: boolean;
}

const applyTheme = (theme: Theme): void => {
  const root = document.querySelector(':root');
  if (root) {
    root.style.setProperty('--primary', theme.colors.primary);
    // Apply other theme properties
  }
};
\`\`\`

And here's a Python example for the backend:

\`\`\`python
import asyncio
from typing import List, Dict

async def process_messages(messages: List[Dict]) -> None:
    """Process chat messages asynchronously."""
    for message in messages:
        await handle_message(message)
        print(f"Processed: {message['id']}")
\`\`\`

These examples show proper typing and async handling!`}
                />
              </div>
            </div>
            <div className="message-row message-row-assistant">
              <div className="message message-assistant">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="showcase-section">
          <h2>Advanced Chat Input</h2>
          <ChatInput />
        </section>

        <section className="showcase-section">
          <h2>Markdown Rendering</h2>
          <div className="markdown-demo">
            <div className="markdown-content">
              <h1>Heading 1</h1>
              <h2>Heading 2</h2>
              <h3>Heading 3</h3>

              <p>
                This is a paragraph with <strong>bold text</strong>,{" "}
                <em>italic text</em>, and{" "}
                <code className="inline-code">inline code</code>.
              </p>

              <blockquote className="markdown-blockquote">
                <p>
                  This is a blockquote. It can contain multiple paragraphs and
                  other markdown elements.
                </p>
                <p>
                  Like this second paragraph with <strong>formatting</strong>.
                </p>
              </blockquote>

              <ul className="markdown-list">
                <li>Unordered list item 1</li>
                <li>
                  Unordered list item 2
                  <ul>
                    <li>Nested item</li>
                    <li>Another nested item</li>
                  </ul>
                </li>
                <li>Unordered list item 3</li>
              </ul>

              <ol className="markdown-list markdown-list-ordered">
                <li>Ordered list item 1</li>
                <li>Ordered list item 2</li>
                <li>Ordered list item 3</li>
              </ol>

              <div
                className="message-code-block"
                key={`markdown-ts-${density}-${theme}`}
              >
                <div className="message-code-wrapper">
                  <div className="message-copy-button-wrapper">
                    <CopyButton
                      text={`interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
  };
  isDark: boolean;
}

const applyTheme = (theme: Theme): void => {
  const root = document.querySelector(':root');
  if (root) {
    root.style.setProperty('--primary', theme.colors.primary);
    // Apply other theme properties
  }
};`}
                    />
                  </div>
                  <pre className="message-content-pre">
                    <code
                      className="language-typescript"
                      dangerouslySetInnerHTML={{
                        __html: hljs.highlight(
                          `interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
  };
  isDark: boolean;
}

const applyTheme = (theme: Theme): void => {
  const root = document.querySelector(':root');
  if (root) {
    root.style.setProperty('--primary', theme.colors.primary);
    // Apply other theme properties
  }
};`,
                          { language: "typescript" },
                        ).value,
                      }}
                    />
                  </pre>
                </div>
                <div className="message-code-header">
                  <span className="message-code-lang">typescript</span>
                </div>
              </div>

              <div
                className="message-code-block"
                key={`markdown-py-${density}-${theme}`}
              >
                <div className="message-code-wrapper">
                  <div className="message-copy-button-wrapper">
                    <CopyButton
                      text={`import asyncio
from typing import List, Dict

async def process_messages(messages: List[Dict]) -> None:
    """Process chat messages asynchronously."""
    for message in messages:
        await handle_message(message)
        print(f"Processed: {message['id']}")`}
                    />
                  </div>
                  <pre className="message-content-pre">
                    <code
                      className="language-python"
                      dangerouslySetInnerHTML={{
                        __html: hljs.highlight(
                          `import asyncio
from typing import List, Dict

async def process_messages(messages: List[Dict]) -> None:
    """Process chat messages asynchronously."""
    for message in messages:
        await handle_message(message)
        print(f"Processed: {message['id']}")`,
                          { language: "python" },
                        ).value,
                      }}
                    />
                  </pre>
                </div>
                <div className="message-code-header">
                  <span className="message-code-lang">python</span>
                </div>
              </div>

              <table className="markdown-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Themes</td>
                    <td>✅ Complete</td>
                    <td>4 themes available</td>
                  </tr>
                  <tr>
                    <td>Animations</td>
                    <td>✅ Complete</td>
                    <td>Smooth transitions</td>
                  </tr>
                  <tr>
                    <td>Mobile</td>
                    <td>✅ Complete</td>
                    <td>Fully responsive</td>
                  </tr>
                </tbody>
              </table>

              <div className="markdown-alert markdown-alert-info">
                <strong>💡 Note:</strong> This is an informational alert with
                markdown support.
              </div>

              <div className="markdown-alert markdown-alert-warning">
                <strong>⚠️ Warning:</strong> Be careful with this operation.
              </div>

              <div className="markdown-alert markdown-alert-success">
                <strong>✅ Success:</strong> Operation completed successfully!
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
