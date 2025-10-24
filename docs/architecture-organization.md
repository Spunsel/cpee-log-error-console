# Architecture Organization Guide

## Directory Structure Rationale

This document explains the correct placement of different types of files in the project architecture.

---

## Component Layers

### `src/components/managers/` - High-Level Coordinators

**Purpose:** Classes that coordinate between multiple components, manage application-level state, and orchestrate complex interactions.

**Characteristics:**
- Manages multiple other components
- Coordinates state across layers
- Handles application-level logic
- Often has dependencies on multiple modules

**Files:**
- ✅ `ContentSectionManager.js` - Coordinates content rendering across multiple sections and renderers
- ✅ `ViewModeManager.js` - Coordinates view mode state between ViewModeToggle, CPEEInstance, and localStorage
- 🔮 Future: `HoverManager.js` (Phase 23) - Will coordinate cross-element highlighting

**Example:**
```javascript
// ViewModeManager coordinates multiple layers
ViewModeToggle (UI) ←→ ViewModeManager ←→ CPEEInstance (Data)
                              ↓
                        localStorage (Persistence)
```

---

### `src/components/ui/` - UI Components

**Purpose:** User interface components that handle display and user interaction.

**Characteristics:**
- Direct user interaction
- Render UI elements
- Fire events/callbacks
- Minimal business logic

**Files:**
- `ViewModeToggle.js` - Toggle buttons for switching view modes
- `Sidebar.js` - Instance tabs sidebar
- `StepNavigator.js` - Step navigation controls

---

### `src/components/renderers/` - Content Renderers

**Purpose:** Components that render specific types of content (graphs, diagrams, etc.).

**Characteristics:**
- Specialized rendering logic
- Transform data into visual output
- Often integrate external libraries

**Files:**
- `CPEEWfAdaptorRenderer.js` - CPEE graph visualization
- `MermaidRenderer.js` - Mermaid diagram rendering

---

### `src/components/features/` - Feature Modules

**Purpose:** Complete feature implementations combining multiple concerns.

**Characteristics:**
- Self-contained functionality
- May use multiple utilities and services
- Higher-level than individual components

**Files:**
- `LogViewer.js` - Log viewing functionality
- `StepViewer.js` - Step detail viewing

---

## Utility Layers

### `src/utils/dom/` - DOM Utilities

**Purpose:** Low-level helpers for DOM manipulation and management.

**Characteristics:**
- Simple, focused utilities
- Minimal dependencies
- Reusable across components
- No application-level state

**Files:**
- ✅ `DOMElementManager.js` - Helper for creating/managing DOM elements
- ✅ `DOMRegistry.js` - Element ID registry
- ✅ `DOMUtils.js` - DOM manipulation utilities
- ✅ `StatusManager.js` - Loading/error state utilities

**Why NOT ViewModeManager?**
ViewModeManager coordinates multiple components and manages application state. It's not a simple utility—it's a coordinator, so it belongs in `components/managers/`.

---

### `src/utils/parsers/` - Data Parsers

**Purpose:** Parse and transform data formats.

**Files:**
- `XMLProcessor.js` - XML parsing
- `YAMLParser.js` - YAML parsing

---

### `src/utils/integrations/` - Third-Party Integrations

**Purpose:** Wrappers and utilities for external libraries.

**Files:**
- `cpee/` - CPEE-specific utilities
- `mermaid/` - Mermaid-specific utilities

---

### `src/utils/system/` - System Utilities

**Purpose:** System-level helpers.

**Files:**
- `LibraryLoader.js` - Dynamic library loading
- `URLUtils.js` - URL manipulation

---

## Decision Tree

**Where should my class go?**

```
Does it coordinate multiple components?
├─ Yes → components/managers/
└─ No ↓

Does it render UI elements?
├─ Yes → components/ui/
└─ No ↓

Does it render specific content (graphs, diagrams)?
├─ Yes → components/renderers/
└─ No ↓

Is it a complete feature?
├─ Yes → components/features/
└─ No ↓

Is it a low-level DOM helper?
├─ Yes → utils/dom/
└─ No ↓

Does it parse data?
├─ Yes → utils/parsers/
└─ No ↓

Does it wrap external libraries?
├─ Yes → utils/integrations/
└─ No ↓

System-level utility?
└─ Yes → utils/system/
```

---

## Examples

### ✅ Correctly Placed

```javascript
// components/managers/ViewModeManager.js
// Coordinates: ViewModeToggle + CPEEInstance + localStorage
export class ViewModeManager {
    constructor(instanceService) { ... }
    setMode(sectionId, mode) {
        // Updates instance
        // Saves to storage
        // Fires callbacks
    }
}
```

```javascript
// utils/dom/DOMElementManager.js
// Simple utility: creates DOM elements
export class DOMElementManager {
    createElement(tag, props) {
        const el = document.createElement(tag);
        // ... set properties
        return el;
    }
}
```

### ❌ Incorrectly Placed

```javascript
// ❌ ViewModeManager in utils/dom/
// This is a coordinator, not a simple utility!
// Should be in components/managers/
```

---

## Summary

**Components** = Application-level, coordinate multiple pieces
**Utils** = Low-level, reusable, focused helpers

**Managers** coordinate, **Utilities** assist.

---

## References

- Phase 21.1: ViewModeToggle (UI Component)
- Phase 21.2: ViewModeManager (Manager)
- ContentSectionManager: Existing manager example
- DOMElementManager: Utility example

**Last Updated:** October 23, 2025

