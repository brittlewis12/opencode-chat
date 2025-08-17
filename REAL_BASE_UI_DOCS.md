# Base UI - Complete Documentation

*Real documentation fetched from https://base-ui.com*

## Table of Contents

1. [Overview](#overview)
   - [Quick Start](#quick-start)
   - [Accessibility](#accessibility)
   - [Releases](#releases)
   - [About](#about)
2. [Handbook](#handbook)
   - [Styling](#styling)
   - [Animation](#animation)
   - [Composition](#composition)
3. [Components](#components)
   - [Accordion](#accordion)
   - [Alert Dialog](#alert-dialog)
   - [Avatar](#avatar)
   - [Checkbox](#checkbox)
   - [Checkbox Group](#checkbox-group)
   - [Collapsible](#collapsible)
   - [Context Menu](#context-menu)
   - [Dialog](#dialog)
   - [Field](#field)
   - [Fieldset](#fieldset)
   - [Form](#form)
   - [Input](#input)
   - [Menu](#menu)
   - [Menubar](#menubar)
   - [Meter](#meter)
   - [Navigation Menu](#navigation-menu)
   - [Number Field](#number-field)
   - [Popover](#popover)
   - [Preview Card](#preview-card)
   - [Progress](#progress)
   - [Radio](#radio)
   - [Scroll Area](#scroll-area)
   - [Select](#select)
   - [Separator](#separator)
   - [Slider](#slider)
   - [Switch](#switch)
   - [Tabs](#tabs)
   - [Toast](#toast)
   - [Toggle](#toggle)
   - [Toggle Group](#toggle-group)
   - [Toolbar](#toolbar)
   - [Tooltip](#tooltip)
4. [Utilities](#utilities)
   - [Direction Provider](#direction-provider)
   - [useRender](#userender)

---

## Overview

### Quick Start

Base UI is an open-source React component library that provides unstyled, accessible components. 

**Installation:**
```bash
npm i @base-ui-components/react
```

**Key Features:**
- Tree-shakeable components
- No bundled CSS
- Supports multiple styling approaches
- Accessibility built-in

**Setup:**
Add `.root` isolation in CSS for portals:
```css
.root {
  isolation: isolate;
}
```

**Example Popover Implementation:**

**Tailwind CSS Approach:**
```tsx
import { Popover } from '@base-ui-components/react/popover';

<Popover.Root>
  <Popover.Trigger className="px-4 py-2 bg-blue-500 text-white rounded">
    Open
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Positioner>
      <Popover.Popup className="bg-white shadow-lg rounded p-4">
        <Popover.Arrow className="fill-white" />
        Content here
      </Popover.Popup>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>
```

**CSS Modules Approach:**
```tsx
import { Popover } from '@base-ui-components/react/popover';
import styles from './popover.module.css';

<Popover.Root>
  <Popover.Trigger className={styles.trigger}>
    Open
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Positioner>
      <Popover.Popup className={styles.popup}>
        <Popover.Arrow className={styles.arrow} />
        Content here
      </Popover.Popup>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>
```

### Accessibility

Base UI provides accessible user experiences out of the box:

**Key Accessibility Features:**
1. **Keyboard Navigation** - Follows WAI-ARIA Authoring Practices with support for arrow keys, alphanumeric keys, Home, End, Enter, and Esc
2. **Focus Management** - Automatic focus management with props like `initialFocus` and `finalFocus`
3. **ARIA Support** - Built-in ARIA attributes and roles
4. **Screen Reader Compatibility** - Tested across multiple screen readers

**Recommended Practices:**
- Use native HTML labels
- Provide accessible names for custom controls
- Style `:focus` and `:focus-visible` pseudo-classes
- Follow WAI-ARIA guidelines for naming and labeling
- Ensure proper color contrast (recommends APCA standard)

### Releases

Base UI is currently in beta (v1.0.0-beta.2) with ongoing improvements:

**Recent Major Changes:**
- Enhanced Select component with `multiple` prop support
- Improved Menu with better submenu handling
- Dialog & Popover support for ShadowRoot containers
- Enhanced Field & Form validation mechanisms
- Added `collisionAvoidance` prop to Tooltip & Popover

### About

Base UI is an open-source React component library focused on accessibility and developer experience.

**Key Principles:**
1. **Headless Components** - Unstyled and CSS-free, compatible with multiple styling solutions
2. **Accessibility** - Adheres to WAI-ARIA design patterns
3. **Composability** - "Component APIs are fully open" for easy customization

**Team:** Notable developers from Radix, Material UI, and Floating UI including Colm Tuite and Vlad Moroz.

**Community:**
- GitHub for contributions
- Discord for support
- X (Twitter) and Bluesky for updates

---

## Handbook

### Styling

Base UI components are completely unstyled, giving you full control over their appearance.

**Styling Approaches:**

**1. CSS Classes**
Components accept `className` prop for static or dynamic styling:
```tsx
<Switch.Root className={`toggle ${checked ? 'checked' : ''}`}>
  <Switch.Thumb />
</Switch.Root>
```

**2. Data Attributes**
Components provide state-based data attributes:
```css
[data-checked] {
  background-color: blue;
}
```

**3. CSS Variables**
Expose dynamic numeric values:
```css
.popover {
  max-height: var(--available-height);
}
```

**Tailwind CSS Example:**
```tsx
<Menu.Root>
  <Menu.Trigger className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Open Menu
  </Menu.Trigger>
  <Menu.Portal>
    <Menu.Positioner>
      <Menu.Popup className="bg-white shadow-lg rounded-md p-1 min-w-48">
        <Menu.Item className="px-3 py-2 hover:bg-gray-100 rounded cursor-pointer">
          Item 1
        </Menu.Item>
      </Menu.Popup>
    </Menu.Positioner>
  </Menu.Portal>
</Menu.Root>
```

**CSS Modules Example:**
```tsx
import styles from './menu.module.css';

<Menu.Root>
  <Menu.Trigger className={styles.trigger}>
    Open Menu
  </Menu.Trigger>
  <Menu.Portal>
    <Menu.Positioner>
      <Menu.Popup className={styles.popup}>
        <Menu.Item className={styles.item}>
          Item 1
        </Menu.Item>
      </Menu.Popup>
    </Menu.Positioner>
  </Menu.Portal>
</Menu.Root>
```

**CSS-in-JS Example:**
```tsx
import styled from '@emotion/styled';

const StyledMenuTrigger = styled(Menu.Trigger)`
  padding: 8px 16px;
  background: blue;
  color: white;
  border-radius: 4px;
`;
```

### Animation

Base UI supports multiple animation techniques:

**1. CSS Transitions**
Use `[data-starting-style]` and `[data-ending-style]` attributes:
```css
[data-starting-style] {
  opacity: 0;
  transform: scale(0.9);
}

[data-ending-style] {
  opacity: 1;
  transform: scale(1);
  transition: opacity 200ms, transform 200ms;
}
```

**2. CSS Animations**
Use `[data-open]` and `[data-closed]` attributes:
```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

[data-open] {
  animation: slideIn 200ms;
}
```

**3. JavaScript Animations**
Compatible with libraries like Motion:
```tsx
import { AnimatePresence, motion } from 'motion/react';

<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Portal>
    <AnimatePresence>
      {open && (
        <Dialog.Popup
          render={
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            />
          }
        >
          Content
        </Dialog.Popup>
      )}
    </AnimatePresence>
  </Dialog.Portal>
</Dialog.Root>
```

### Composition

Base UI components are highly composable using the `render` prop:

**1. Custom Component Rendering:**
```tsx
<Menu.Trigger render={<MyButton size="md" />}>
  Open menu
</Menu.Trigger>
```

**2. Nested Component Composition:**
```tsx
<Dialog.Root>
  <Tooltip.Root>
    <Tooltip.Trigger
      render={
        <Dialog.Trigger
          render={
            <Menu.Trigger render={<MyButton size="md" />}>
              Open menu
            </Menu.Trigger>
          }
        />
      }
    />
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <Tooltip.Popup>Open dialog</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
  <Dialog.Portal>
    <Dialog.Popup>Dialog content</Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

**3. Changing Default Element:**
```tsx
<Menu.Item render={<a href="base-ui.com" />}>
  Add to Library
</Menu.Item>
```

**4. Render Function for Advanced Control:**
```tsx
<Switch.Thumb
  render={(props, state) =>
    <span {...props}>
      {state.checked ? <CheckedIcon /> : <UncheckedIcon />}
    </span>
  }
/>
```

**Requirements for Custom Components:**
- Must forward `ref`
- Must spread all received props on underlying DOM node
- Recommended to use default rendering when possible

---

## Components

### Accordion

**Import:** `@base-ui-components/react/accordion`

The Accordion creates collapsible panels with headings.

**Component Structure:**
```tsx
<Accordion.Root>
  <Accordion.Item>
    <Accordion.Header>
      <Accordion.Trigger>Section 1</Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Panel>
      Content for section 1
    </Accordion.Panel>
  </Accordion.Item>
</Accordion.Root>
```

**Key Props:**
- `openMultiple`: Allow multiple panels open (default: true)
- `disabled`: Disable user interaction
- `value/defaultValue`: Control which panels are open
- `orientation`: Set vertical or horizontal layout

**Key Features:**
- Keyboard navigation
- Accessibility-focused
- Supports controlled and uncontrolled modes
- Flexible rendering options

### Alert Dialog

**Import:** `@base-ui-components/react/alert-dialog`

Alert Dialog requires user response to proceed.

**Component Structure:**
```tsx
<AlertDialog.Root>
  <AlertDialog.Trigger>Delete</AlertDialog.Trigger>
  <AlertDialog.Portal>
    <AlertDialog.Backdrop />
    <AlertDialog.Popup>
      <AlertDialog.Title>Are you sure?</AlertDialog.Title>
      <AlertDialog.Description>
        This action cannot be undone.
      </AlertDialog.Description>
      <AlertDialog.Close>Cancel</AlertDialog.Close>
      <AlertDialog.Close>Delete</AlertDialog.Close>
    </AlertDialog.Popup>
  </AlertDialog.Portal>
</AlertDialog.Root>
```

**Key Props:**
- `open`: Controls dialog visibility
- `onOpenChange`: Handles dialog open/close events
- `initialFocus`: Specifies initial focus element
- `finalFocus`: Specifies element to focus when closing

**Features:**
- Supports nested dialogs
- Customizable through render props
- Accessible keyboard interactions
- Supports controlled and uncontrolled modes

### Avatar

**Import:** `@base-ui-components/react/avatar`

High-quality avatar component for profile pictures.

**Component Structure:**
```tsx
<Avatar.Root>
  <Avatar.Image src="profile.jpg" alt="User" />
  <Avatar.Fallback>JD</Avatar.Fallback>
</Avatar.Root>
```

**Sub-components:**
1. **Root** (`Avatar.Root`) - Displays profile picture, initials, or fallback
2. **Image** (`Avatar.Image`) - Displays the avatar image with loading status
3. **Fallback** (`Avatar.Fallback`) - Shows when image fails to load

### Checkbox

**Import:** `@base-ui-components/react/checkbox`

Customizable checkbox inputs.

**Component Structure:**
```tsx
<Checkbox.Root defaultChecked>
  <Checkbox.Indicator>
    <CheckIcon />
  </Checkbox.Indicator>
</Checkbox.Root>
```

**Key Props:**
- `defaultChecked`: Initial uncontrolled state
- `checked`: Controlled state
- `onCheckedChange`: State change callback
- `disabled`: Disable interaction
- `required`: Form validation

**Sub-components:**
1. **Root** - Renders button and hidden input
2. **Indicator** - Shows checked state with optional animation

### Checkbox Group

**Import:** `@base-ui-components/react/checkbox-group`

Provides shared state for multiple checkboxes.

**Usage Example:**
```tsx
<CheckboxGroup 
  value={selectedValues}
  onValueChange={setSelectedValues}
  allValues={availableValues}
>
  <Checkbox.Root value="option1">
    <Checkbox.Indicator />
    Option 1
  </Checkbox.Root>
  <Checkbox.Root value="option2">
    <Checkbox.Indicator />
    Option 2
  </Checkbox.Root>
</CheckboxGroup>
```

**Key Props:**
- `defaultValue`: Initially checked checkboxes
- `value`: Controlled checkbox values
- `onValueChange`: Callback for checkbox state changes
- `allValues`: All possible checkbox values
- `disabled`: Disable user interaction

**Features:**
- Parent/child checkbox interactions
- Nested checkbox groups
- Form integration
- Indeterminate state support

### Collapsible

**Import:** `@base-ui-components/react/collapsible`

Creates expandable/collapsible panels.

**Component Structure:**
```tsx
<Collapsible.Root>
  <Collapsible.Trigger>Toggle</Collapsible.Trigger>
  <Collapsible.Panel>
    Collapsible content here
  </Collapsible.Panel>
</Collapsible.Root>
```

**Key Props:**
- `defaultOpen`: Initial open state
- `open`: Controlled open state
- `onOpenChange`: Open state change callback
- `disabled`: Disable interaction

**Features:**
- Supports animation and mounting options
- Data attributes for styling states
- CSS variables for height/width
- Configurable animation

### Context Menu

**Import:** `@base-ui-components/react/context-menu`

Creates context menus that appear on right-click.

**Component Structure:**
```tsx
<ContextMenu.Root>
  <ContextMenu.Trigger>Right click here</ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Positioner>
      <ContextMenu.Popup>
        <ContextMenu.Item>Add to Library</ContextMenu.Item>
        <ContextMenu.Item>Add to Playlist</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item>Delete</ContextMenu.Item>
      </ContextMenu.Popup>
    </ContextMenu.Positioner>
  </ContextMenu.Portal>
</ContextMenu.Root>
```

**Features:**
- Appears on right-click or long press
- Supports nested submenus
- Accessible keyboard navigation
- Responsive positioning
- Hover and click interaction options

### Dialog

**Import:** `@base-ui-components/react/dialog`

Modal dialogs that open on top of the page.

**Component Structure:**
```tsx
<Dialog.Root>
  <Dialog.Trigger>Open Dialog</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup>
      <Dialog.Title>Dialog Title</Dialog.Title>
      <Dialog.Description>Dialog description</Dialog.Description>
      <Dialog.Close>Close</Dialog.Close>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

**Key Props:**
- Supports controlled and uncontrolled states
- Configurable modal behavior
- Nested dialog support
- Customizable focus management

**Features:**
- Supports nested dialogs
- Close confirmation dialogs
- Customizable styling with CSS variables
- Flexible rendering and composition

### Field

**Import:** `@base-ui-components/react/field`

Form component providing labeling and validation.

**Component Structure:**
```tsx
<Field.Root>
  <Field.Label>Name</Field.Label>
  <Field.Control required />
  <Field.Description>Enter your full name</Field.Description>
  <Field.Error match="valueMissing">
    Please enter your name
  </Field.Error>
</Field.Root>
```

**Sub-components:**
1. **Root** - Groups field parts, manages state
2. **Label** - Renders accessible label
3. **Control** - Form input control
4. **Description** - Additional field information
5. **Error** - Validation error messages
6. **Validity** - Custom validity state rendering

**Features:**
- Custom validation support
- Validation modes: onBlur (default) and onChange
- Extensive data attributes for styling
- Works with various input types

### Fieldset

**Import:** `@base-ui-components/react/fieldset`

Accessible fieldset component with stylable legend.

**Component Structure:**
```tsx
<Fieldset.Root>
  <Fieldset.Legend>Personal Information</Fieldset.Legend>
  {/* Form fields */}
</Fieldset.Root>
```

**API:**
- **Root** - Groups fieldset legend and associated fields
- **Legend** - Provides accessible label for the fieldset

**Props:**
- `className`: String or function for dynamic classes
- `render`: Option to replace or compose the default element

### Form

**Import:** `@base-ui-components/react/form`

Native form element with consolidated error handling.

**Usage Example:**
```tsx
<Form
  errors={errors}
  onClearErrors={setErrors}
  onSubmit={async (event) => {
    // Form submission logic
  }}
>
  <Field.Root name="fieldName">
    <Field.Label>Field Label</Field.Label>
    <Field.Control />
    <Field.Error />
  </Field.Root>
</Form>
```

**Key Props:**
- `errors`: Object - Error mapping for form fields
- `onClearErrors`: Function - Handler to clear errors
- `className`: String/Function - CSS class or dynamic class generator
- `render`: Element/Function - Custom rendering of form element

**Features:**
- Error state management
- Form submission handling
- Dynamic error tracking
- Integration with validation libraries like Zod

### Input

**Import:** `@base-ui-components/react/input`

High-quality input component that works with Field.

**Usage Example:**
```tsx
<Input
  placeholder="Name"
  defaultValue=""
  onValueChange={(value) => console.log(value)}
/>
```

**Key Props:**
- `defaultValue`: Initial value
- `onValueChange`: Value change callback
- `className`: CSS styling

**Data Attributes:**
- `data-disabled`
- `data-valid`
- `data-invalid`
- `data-dirty`
- `data-touched`
- `data-filled`
- `data-focused`

### Menu

**Import:** `@base-ui-components/react/menu`

Dropdown menu component with keyboard navigation.

**Component Structure:**
```tsx
<Menu.Root>
  <Menu.Trigger>Open Menu</Menu.Trigger>
  <Menu.Portal>
    <Menu.Positioner>
      <Menu.Popup>
        <Menu.Item>Menu Item 1</Menu.Item>
        <Menu.CheckboxItem>
          <Menu.ItemIndicator>✓</Menu.ItemIndicator>
          Checkbox Item
        </Menu.CheckboxItem>
        <Menu.RadioGroup>
          <Menu.RadioItem value="option1">
            <Menu.ItemIndicator>•</Menu.ItemIndicator>
            Radio Option 1
          </Menu.RadioItem>
        </Menu.RadioGroup>
        <Menu.Separator />
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger>Submenu</Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.SubmenuPositioner>
              <Menu.SubmenuPopup>
                <Menu.Item>Submenu Item</Menu.Item>
              </Menu.SubmenuPopup>
            </Menu.SubmenuPositioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      </Menu.Popup>
    </Menu.Positioner>
  </Menu.Portal>
</Menu.Root>
```

**Features:**
- Keyboard navigation
- Multiple interaction modes (click, hover)
- Checkbox and radio items
- Submenu support

### Menubar

**Import:** `@base-ui-components/react/menubar`

Application menu bars with nested menus.

**Component Structure:**
```tsx
<Menubar modal={true} orientation="horizontal">
  <Menu.Root>
    <Menu.Trigger>File</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Item>New</Menu.Item>
          <Menu.Item>Open</Menu.Item>
          <Menu.Separator />
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger>Recent</Menu.SubmenuTrigger>
            {/* Submenu content */}
          </Menu.SubmenuRoot>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</Menubar>
```

**Key Props:**
- `modal`: Controls modal behavior (default: true)
- `disabled`: Disables entire menubar
- `loop`: Enables keyboard focus looping
- `orientation`: Sets menu orientation (default: 'horizontal')

### Meter

**Import:** `@base-ui-components/react/meter`

Graphically displays numeric values within a range.

**Component Structure:**
```tsx
<Meter.Root value={24} min={0} max={100}>
  <Meter.Label>Storage Used</Meter.Label>
  <Meter.Track>
    <Meter.Indicator />
  </Meter.Track>
  <Meter.Value />
</Meter.Root>
```

**Sub-components:**
1. **Root** - Container for meter elements
2. **Label** - Accessible label
3. **Track** - Container for the meter's range
4. **Indicator** - Visual representation of current value
5. **Value** - Displays current numeric value

**Key Props:**
- `value`: Current numeric value
- `min`: Minimum value (default 0)
- `max`: Maximum value (default 100)
- `locale`: Number formatting locale
- `format`: Number formatting options

### Navigation Menu

**Import:** `@base-ui-components/react/navigation-menu`

Interactive website navigation menus.

**Component Structure:**
```tsx
<NavigationMenu.Root>
  <NavigationMenu.List>
    <NavigationMenu.Item>
      <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="/product1">
                  Product 1
                </NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Viewport>
            <NavigationMenu.Arrow />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Item>
  </NavigationMenu.List>
</NavigationMenu.Root>
```

**Features:**
- Horizontal and vertical orientations
- Animated popup and content transitions
- Nested submenu capabilities
- Configurable positioning and collision avoidance
- Accessible navigation with keyboard support

### Number Field

**Import:** `@base-ui-components/react/number-field`

Numeric input component with increment/decrement controls.

**Component Structure:**
```tsx
<NumberField.Root defaultValue={0} step={1}>
  <NumberField.ScrubArea>
    <NumberField.Label>Quantity</NumberField.Label>
  </NumberField.ScrubArea>
  <NumberField.Group>
    <NumberField.Decrement>-</NumberField.Decrement>
    <NumberField.Input />
    <NumberField.Increment>+</NumberField.Increment>
  </NumberField.Group>
</NumberField.Root>
```

**Key Props:**
- `defaultValue`: Initial uncontrolled value
- `value`: Controlled numeric value
- `step`: Increment/decrement amount
- `min`/`max`: Value range limits
- `locale`: Input formatting locale
- `format`: Number formatting options

**Sub-components:**
1. **Root** - Manages overall state
2. **ScrubArea** - Interactive area for value adjustment
3. **Group** - Contains increment/decrement buttons
4. **Input** - Native numeric input element
5. **Increment/Decrement** - Buttons to change value

### Popover

**Import:** `@base-ui-components/react/popover`

Accessible, anchored popup interfaces.

**Component Structure:**
```tsx
<Popover.Root>
  <Popover.Trigger>Open Popover</Popover.Trigger>
  <Popover.Portal>
    <Popover.Positioner>
      <Popover.Popup>
        <Popover.Arrow />
        <Popover.Title>Notification</Popover.Title>
        <Popover.Description>Content here</Popover.Description>
        <Popover.Close>Close</Popover.Close>
      </Popover.Popup>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>
```

**Features:**
- Highly configurable positioning
- Modal and non-modal modes
- Hover and click interactions
- Customizable animations
- Collision avoidance

### Preview Card

**Import:** `@base-ui-components/react/preview-card`

Popup that appears when a link is hovered.

**Component Structure:**
```tsx
<PreviewCard.Root>
  <PreviewCard.Trigger href="/link">
    Hover me
  </PreviewCard.Trigger>
  <PreviewCard.Portal>
    <PreviewCard.Positioner>
      <PreviewCard.Popup>
        <PreviewCard.Arrow />
        Preview content here
      </PreviewCard.Popup>
    </PreviewCard.Positioner>
  </PreviewCard.Portal>
</PreviewCard.Root>
```

**Features:**
- Configurable delay for opening/closing
- Collision avoidance settings
- Customizable positioning
- Event handlers for open/close states

### Progress

**Import:** `@base-ui-components/react/progress`

Displays task completion status.

**Component Structure:**
```tsx
<Progress.Root value={value} min={0} max={100}>
  <Progress.Label>Export data</Progress.Label>
  <Progress.Track>
    <Progress.Indicator />
  </Progress.Track>
  <Progress.Value />
</Progress.Root>
```

**Sub-components:**
1. **Root** - Main container
2. **Label** - Accessible label
3. **Track** - Progress bar container
4. **Indicator** - Visual representation of progress
5. **Value** - Displays current value

**Key Props:**
- `value`: Current progress value
- `min`: Minimum value (default 0)
- `max`: Maximum value (default 100)
- `locale`: Formatting locale
- `format`: Number formatting options

### Radio

**Import:** `@base-ui-components/react/radio`

Stylable radio buttons with group functionality.

**Component Structure:**
```tsx
<RadioGroup name="options" defaultValue="option1">
  <Radio.Root value="option1">
    <Radio.Indicator />
    Option 1
  </Radio.Root>
  <Radio.Root value="option2">
    <Radio.Indicator />
    Option 2
  </Radio.Root>
</RadioGroup>
```

**RadioGroup Props:**
- `name`: Form submission identifier
- `defaultValue`: Initial selected value
- `value`: Controlled component value
- `onValueChange`: Change event handler
- `disabled`: Interaction control

**Radio.Root Props:**
- `value`: Unique identifying value
- `disabled`: Interaction control
- `readOnly`: Prevents selection changes

### Scroll Area

**Import:** `@base-ui-components/react/scroll-area`

Native scroll container with custom scrollbars.

**Component Structure:**
```tsx
<ScrollArea.Root>
  <ScrollArea.Viewport>
    <ScrollArea.Content>
      Long content that needs scrolling...
    </ScrollArea.Content>
  </ScrollArea.Viewport>
  <ScrollArea.Scrollbar orientation="vertical">
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
  <ScrollArea.Scrollbar orientation="horizontal">
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
  <ScrollArea.Corner />
</ScrollArea.Root>
```

**Sub-components:**
1. **Root** - Groups scroll area components
2. **Viewport** - Actual scrollable container
3. **Content** - Container for scroll area content
4. **Scrollbar** - Vertical or horizontal scrollbar
5. **Thumb** - Draggable scrollbar indicator
6. **Corner** - Intersection area for scrollbars

### Select

**Import:** `@base-ui-components/react/select`

Dropdown select component for single and multiple selections.

**Component Structure:**
```tsx
<Select.Root 
  items={[
    { label: 'JavaScript', value: 'js' },
    { label: 'TypeScript', value: 'ts' }
  ]}
  defaultValue="js"
>
  <Select.Trigger>
    <Select.Value />
    <Select.Icon>▼</Select.Icon>
  </Select.Trigger>
  <Select.Portal>
    <Select.Positioner>
      <Select.Popup>
        <Select.Item value="js">JavaScript</Select.Item>
        <Select.Item value="ts">TypeScript</Select.Item>
      </Select.Popup>
    </Select.Positioner>
  </Select.Portal>
</Select.Root>
```

**Key Props:**
- `items`: Define selectable options
- `multiple`: Enable multi-select
- `defaultValue`: Initial selected value
- `onValueChange`: Callback for value changes

**Multiple Selection:**
```tsx
<Select.Root 
  multiple 
  defaultValue={['javascript', 'typescript']}
>
  {/* Select components */}
</Select.Root>
```

### Separator

**Import:** `@base-ui-components/react/separator`

Accessible dividers between elements.

**Usage:**
```tsx
<Separator orientation="horizontal" />
<Separator orientation="vertical" />
```

**Key Props:**
- `orientation`: Controls separator direction (default: horizontal)
- `className`: Custom styling
- `render`: Custom element rendering

### Slider

**Import:** `@base-ui-components/react/slider`

Range input component for selecting values.

**Component Structure:**
```tsx
<Slider.Root defaultValue={[50]} min={0} max={100} step={1}>
  <Slider.Value />
  <Slider.Control>
    <Slider.Track>
      <Slider.Indicator />
    </Slider.Track>
    <Slider.Thumb />
  </Slider.Control>
</Slider.Root>
```

**Key Props:**
- `defaultValue`: Initial uncontrolled value
- `value`: Controlled slider value
- `onValueChange`: Callback for value changes
- `min`: Minimum allowed value (default 0)
- `max`: Maximum allowed value (default 100)
- `step`: Granularity of slider steps (default 1)
- `disabled`: Disable user interaction
- `orientation`: Horizontal or vertical slider

**Range Slider:**
```tsx
<Slider.Root defaultValue={[25, 75]}>
  <Slider.Control>
    <Slider.Track>
      <Slider.Indicator />
    </Slider.Track>
    <Slider.Thumb />
    <Slider.Thumb />
  </Slider.Control>
</Slider.Root>
```

### Switch

**Import:** `@base-ui-components/react/switch`

Toggle control for on/off states.

**Component Structure:**
```tsx
<Switch.Root defaultChecked>
  <Switch.Thumb />
</Switch.Root>
```

**Key Props:**
- `defaultChecked`: Initial state
- `checked`: Controlled state
- `onCheckedChange`: Event handler
- `disabled`: Interaction control
- `readOnly`: Prevents state changes

**Custom Icon Example:**
```tsx
<Switch.Root>
  <Switch.Thumb
    render={(props, state) =>
      <span {...props}>
        {state.checked ? <CheckIcon /> : <XIcon />}
      </span>
    }
  />
</Switch.Root>
```

### Tabs

**Import:** `@base-ui-components/react/tabs`

Interactive tab interfaces.

**Component Structure:**
```tsx
<Tabs.Root defaultValue="tab1">
  <Tabs.List>
    <Tabs.Tab value="tab1">Tab 1</Tabs.Tab>
    <Tabs.Tab value="tab2">Tab 2</Tabs.Tab>
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Panel value="tab1">
    Content for tab 1
  </Tabs.Panel>
  <Tabs.Panel value="tab2">
    Content for tab 2
  </Tabs.Panel>
</Tabs.Root>
```

**Sub-components:**
1. **Root** - Groups tabs and panels
2. **List** - Contains individual tab buttons
3. **Tab** - Interactive tab button
4. **Indicator** - Visual indicator for active tab
5. **Panel** - Content panel for each tab

**Key Props:**
- `defaultValue`: Initial active tab
- `value`: Controlled active tab
- `onValueChange`: Tab change callback
- `orientation`: Horizontal or vertical layout

### Toast

**Import:** `@base-ui-components/react/toast`

Toast notification component.

**Component Structure:**
```tsx
<Toast.Provider>
  <Toast.Portal>
    <Toast.Viewport>
      <Toast.Root>
        <Toast.Title>Success!</Toast.Title>
        <Toast.Description>Your changes have been saved.</Toast.Description>
        <Toast.Action>Undo</Toast.Action>
        <Toast.Close>×</Toast.Close>
      </Toast.Root>
    </Toast.Viewport>
  </Toast.Portal>
</Toast.Provider>
```

**Using Toast Manager:**
```tsx
import { useToastManager } from '@base-ui-components/react/toast';

function App() {
  const manager = useToastManager();

  const showToast = () => {
    manager.add({
      title: 'Success!',
      description: 'Operation completed.',
      timeout: 5000
    });
  };

  return <button onClick={showToast}>Show Toast</button>;
}
```

**Key Methods:**
- `add()`: Create a new toast
- `update()`: Modify an existing toast
- `close()`: Remove a specific toast
- `promise()`: Create promise-based toasts with loading/success/error states

**Configuration Options:**
- Limit number of simultaneous toasts
- Custom timeout
- Swipe directions
- Custom styling

### Toggle

**Import:** `@base-ui-components/react/toggle`

Two-state buttons for on/off functionality.

**Usage:**
```tsx
<Toggle pressed={liked} onPressedChange={setLiked}>
  <HeartIcon />
</Toggle>
```

**Key Props:**
- `value`: Unique identifier
- `pressed`: Current toggle state
- `onPressedChange`: State change callback
- `disabled`: Interaction control
- `render`: Custom rendering function

### Toggle Group

**Import:** `@base-ui-components/react/toggle-group`

Shared state management for toggle buttons.

**Component Structure:**
```tsx
<ToggleGroup 
  value={alignment}
  onValueChange={setAlignment}
  toggleMultiple={false}
>
  <Toggle value="left">
    <AlignLeftIcon />
  </Toggle>
  <Toggle value="center">
    <AlignCenterIcon />
  </Toggle>
  <Toggle value="right">
    <AlignRightIcon />
  </Toggle>
</ToggleGroup>
```

**Key Props:**
- `defaultValue`: Initial toggle states
- `value`: Controlled toggle states
- `onValueChange`: Callback for state changes
- `toggleMultiple`: Allow multiple selections
- `disabled`: Disable user interaction
- `loop`: Enable keyboard focus looping
- `orientation`: Set toggle group direction

### Toolbar

**Import:** `@base-ui-components/react/toolbar`

Groups buttons, controls, and interactive elements.

**Component Structure:**
```tsx
<Toolbar.Root orientation="horizontal">
  <Toolbar.Button>Bold</Toolbar.Button>
  <Toolbar.Button>Italic</Toolbar.Button>
  <Toolbar.Separator />
  <Toolbar.Group>
    <Toolbar.Button>Left</Toolbar.Button>
    <Toolbar.Button>Center</Toolbar.Button>
    <Toolbar.Button>Right</Toolbar.Button>
  </Toolbar.Group>
  <Toolbar.Link href="/help">Help</Toolbar.Link>
</Toolbar.Root>
```

**Sub-components:**
1. **Root** - Container for toolbar items
2. **Button** - Interactive button element
3. **Link** - Hyperlink component
4. **Input** - Input field integration
5. **Group** - Grouping related toolbar items
6. **Separator** - Visual separator between sections

**Features:**
- Horizontal and vertical orientations
- Keyboard navigation with optional looping
- Composable with other Base UI components
- Accessible data attributes for different states

### Tooltip

**Import:** `@base-ui-components/react/tooltip`

Popup hints when an element is hovered or focused.

**Component Structure:**
```tsx
<Tooltip.Provider>
  <Tooltip.Root>
    <Tooltip.Trigger>
      <button>Bold</button>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <Tooltip.Popup>
          Make text bold
          <Tooltip.Arrow />
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
```

**Sub-components:**
1. **Provider** - Manages shared delay settings
2. **Root** - Groups tooltip parts
3. **Trigger** - Element that activates tooltip
4. **Portal** - Moves popup to different DOM location
5. **Positioner** - Handles tooltip positioning
6. **Popup** - Contains tooltip content
7. **Arrow** - Optional directional arrow

**Key Props:**
- `delay`: Time before tooltip opens
- `closeDelay`: Time before tooltip closes
- `disabled`: Disable tooltip functionality
- `hoverable`: Allow cursor to hover over tooltip content

**Accessibility Guidelines:**
- Provide meaningful labels for triggers
- Avoid using tooltips for critical information
- Do not use for "infotips" that only exist to show additional text

---

## Utilities

### Direction Provider

**Import:** `@base-ui-components/react/direction-provider`

Enables Right-to-Left (RTL) behavior for Base UI components.

**Usage:**
```tsx
<DirectionProvider direction="rtl">
  <Slider.Root>
    <Slider.Control>
      <Slider.Track>
        <Slider.Indicator />
      </Slider.Track>
      <Slider.Thumb />
    </Slider.Control>
  </Slider.Root>
</DirectionProvider>
```

**API Props:**
- `direction`: `TextDirection` (default: 'ltr') - Sets reading direction
- `children`: `ReactNode` - Components to apply direction

### useRender

**Import:** `@base-ui-components/react/utils/use-render`

React hook for creating custom components with flexible rendering.

**Purpose:**
- Enables custom components to override default rendered elements
- Supports render prop with function or React element
- Merges props intelligently (event handlers, classNames, styles)
- Supports ref management across components

**Basic Usage:**
```tsx
function Text(props: TextProps) {
  const element = useRender({
    render: props.render || <p />,
    props: mergeProps({ className: styles.Text }, props)
  });
  return element;
}
```

**Advanced Usage with State:**
```tsx
function Counter(props: CounterProps) {
  const [count, setCount] = useState(0);
  const state = { odd: count % 2 === 1 };

  const element = useRender({
    render: props.render || <button />,
    state,
    props: mergeProps(defaultProps, props)
  });

  return element;
}
```

**TypeScript Support:**
- `useRender.ComponentProps`: External component props
- `useRender.ElementProps`: Internal element props

**Migration from Radix UI:**
Replaces `asChild` prop with more flexible `render` prop approach.

---

*This documentation was compiled from the official Base UI documentation at https://base-ui.com*