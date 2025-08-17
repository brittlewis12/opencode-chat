import React, { useState } from "react";
import { Switch } from "@base-ui-components/react/switch";
import { Tabs } from "@base-ui-components/react/tabs";
import { Dialog } from "@base-ui-components/react/dialog";
import { Checkbox } from "@base-ui-components/react/checkbox";
import { Radio } from "@base-ui-components/react/radio";

type Theme = "liquid-dark" | "liquid-light" | "terminal" | "pastel";
type Density = "compact" | "normal" | "spacious";

export default function Playground() {
  const [theme, setTheme] = useState<Theme>("liquid-dark");
  const [density, setDensity] = useState<Density>("normal");
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div className={`playground theme-${theme} density-${density}`}>
      <div className="playground-header">
        <div className="header-left">
          <button
            onClick={() => (window.location.href = "/")}
            className="btn btn-ghost"
          >
            ← Back to Chat
          </button>
          <h1>OpenCode UI Playground</h1>
        </div>
        <div className="controls">
          <div className="control-group">
            <label>Theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="theme-select"
            >
              <option value="liquid-dark">Liquid Dark</option>
              <option value="liquid-light">Liquid Light</option>
              <option value="terminal">Terminal Matrix</option>
              <option value="pastel">Pastel Dream</option>
            </select>
          </div>
          <div className="control-group">
            <label>Density</label>
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value as Density)}
              className="density-select"
            >
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="spacious">Spacious</option>
            </select>
          </div>
        </div>
      </div>

      <div className="showcase-grid">
        {/* Buttons Section */}
        <section className="showcase-section">
          <h2>Buttons</h2>
          <div className="component-grid">
            <button className="btn btn-primary">Primary Action</button>
            <button className="btn btn-secondary">Secondary</button>
            <button className="btn btn-ghost">Ghost Button</button>
            <button className="btn btn-danger">Danger</button>
            <button className="btn btn-glass">Glass Effect</button>
          </div>
        </section>

        {/* Input Fields Section */}
        <section className="showcase-section">
          <h2>Input Fields</h2>
          <div className="component-grid">
            <div className="field">
              <label className="field-label">Username</label>
              <input
                type="text"
                placeholder="Enter username..."
                className="field-input"
              />
            </div>
            <div className="field">
              <label className="field-label">Email</label>
              <input
                type="email"
                placeholder="user@example.com"
                className="field-input"
              />
            </div>
            <div className="field">
              <label className="field-label">Message</label>
              <textarea
                rows={3}
                placeholder="Type your message..."
                className="field-textarea"
              />
            </div>
          </div>
        </section>

        {/* Cards Section */}
        <section className="showcase-section">
          <h2>Cards</h2>
          <div className="component-grid">
            <div className="card card-default">
              <h3>Default Card</h3>
              <p>Standard card with subtle border and shadow.</p>
            </div>
            <div className="card card-glass">
              <h3>Glass Card</h3>
              <p>Translucent glass morphism effect with backdrop blur.</p>
            </div>
            <div className="card card-elevated">
              <h3>Elevated Card</h3>
              <p>Higher elevation with stronger shadow.</p>
            </div>
          </div>
        </section>

        {/* Switches & Checkboxes */}
        <section className="showcase-section">
          <h2>Toggles & Selections</h2>
          <div className="component-grid">
            <div className="toggle-group">
              <Switch.Root className="switch">
                <Switch.Thumb className="switch-thumb" />
              </Switch.Root>
              <label>Enable notifications</label>
            </div>
            <div className="toggle-group">
              <Checkbox.Root className="checkbox">
                <Checkbox.Indicator className="checkbox-indicator">
                  ✓
                </Checkbox.Indicator>
              </Checkbox.Root>
              <label>Accept terms</label>
            </div>
            <div className="toggle-group">
              <div className="radio-group">
                <Radio.Root name="options" value="1" className="radio">
                  <Radio.Indicator className="radio-indicator" />
                  <label>Option 1</label>
                </Radio.Root>
                <Radio.Root name="options" value="2" className="radio">
                  <Radio.Indicator className="radio-indicator" />
                  <label>Option 2</label>
                </Radio.Root>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs Section */}
        <section className="showcase-section">
          <h2>Tabs</h2>
          <Tabs.Root defaultValue="1" className="tabs">
            <Tabs.List className="tabs-list">
              <Tabs.Trigger value="1" className="tab-trigger">
                Overview
              </Tabs.Trigger>
              <Tabs.Trigger value="2" className="tab-trigger">
                Features
              </Tabs.Trigger>
              <Tabs.Trigger value="3" className="tab-trigger">
                Settings
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Panel value="1" className="tab-panel">
              <p>Overview content with glass morphism background.</p>
            </Tabs.Panel>
            <Tabs.Panel value="2" className="tab-panel">
              <p>Features panel showing the liquid glass effect.</p>
            </Tabs.Panel>
            <Tabs.Panel value="3" className="tab-panel">
              <p>Settings panel with adaptive density.</p>
            </Tabs.Panel>
          </Tabs.Root>
        </section>

        {/* Dialog Example */}
        <section className="showcase-section">
          <h2>Dialogs & Overlays</h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowDialog(true)}
          >
            Open Dialog
          </button>

          <Dialog.Root open={showDialog} onOpenChange={setShowDialog}>
            <Dialog.Backdrop className="dialog-backdrop" />
            <Dialog.Popup className="dialog-popup">
              <Dialog.Title className="dialog-title">
                Liquid Glass Dialog
              </Dialog.Title>
              <Dialog.Description className="dialog-description">
                This dialog demonstrates the glass morphism effect with
                chromatic aberration touches.
              </Dialog.Description>
              <div className="dialog-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowDialog(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowDialog(false)}
                >
                  Confirm
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Root>
        </section>

        {/* Code Block Example */}
        <section className="showcase-section">
          <h2>Code Blocks</h2>
          <div className="code-block">
            <div className="code-header">
              <span className="code-lang">typescript</span>
              <button className="code-copy">Copy</button>
            </div>
            <pre className="code-content">
              {`interface LiquidGlass {
  blur: number;
  chromaticAberration: boolean;
  refraction: 'subtle' | 'medium' | 'strong';
  opacity: number;
}`}
            </pre>
          </div>
        </section>

        {/* Message Bubbles */}
        <section className="showcase-section">
          <h2>Message Bubbles</h2>
          <div className="message-container">
            <div className="message message-user">
              <div className="message-content">
                How does the liquid glass effect work?
              </div>
            </div>
            <div className="message message-assistant">
              <div className="message-content">
                The liquid glass effect uses backdrop-filter blur, subtle
                chromatic aberration on edges, and layered translucency to
                create a refractive appearance.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
