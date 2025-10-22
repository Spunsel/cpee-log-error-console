# Migration Guide

This document provides guidance for migrating from legacy/deprecated methods that have been removed from the codebase.

## Overview

As part of code cleanup and refactoring efforts, several legacy methods and backward compatibility code have been removed to:
- Reduce code bloat
- Improve maintainability
- Clarify the API surface
- Follow Single Responsibility Principle

## Breaking Changes

### StepViewer.js - Removed Deprecated Delegation Methods

**Affected Version:** v2.0.0+

The following deprecated methods have been removed from `StepViewer`. These methods were simple delegation wrappers that added unnecessary complexity.

#### Navigation Methods

**REMOVED:**
```javascript
// ❌ Old (removed)
stepViewer.setupStepNavigation();
stepViewer.updateStepNavigation(navInfo);
stepViewer.previousStep();
stepViewer.nextStep();
stepViewer.goToStart();
stepViewer.goToEnd();
stepViewer.applyDisabledStyling(button, isDisabled);
```

**MIGRATION:**
```javascript
// ✅ New (use navigator directly)
stepViewer.getNavigator().setupNavigation();
stepViewer.getNavigator().updateNavigation(navInfo);
stepViewer.getNavigator().previousStep();
stepViewer.getNavigator().nextStep();
stepViewer.getNavigator().goToStart();
stepViewer.getNavigator().goToEnd();
stepViewer.getNavigator().applyDisabledStyling(button, isDisabled);
```

#### Content Management Methods

**REMOVED:**
```javascript
// ❌ Old (removed)
stepViewer.updateInputCpeeSection(cpeeXml);
stepViewer.updateOutputCpeeSection(cpeeXml);
stepViewer.updateInputIntermediateSection(content);
stepViewer.updateOutputIntermediateSection(content);
stepViewer.updateUserInputSection(content);
stepViewer.preserveHeightDuringTransition(element);
```

**MIGRATION:**
```javascript
// ✅ New (use content manager directly)
stepViewer.getContentManager().updateInputCpeeSection(cpeeXml);
stepViewer.getContentManager().updateOutputCpeeSection(cpeeXml);
stepViewer.getContentManager().updateInputIntermediateSection(content);
stepViewer.getContentManager().updateOutputIntermediateSection(content);
stepViewer.getContentManager().updateUserInputSection(content);
stepViewer.getContentManager().preserveHeightDuringTransition(element);
```

#### Legacy Renderer Properties

**REMOVED:**
```javascript
// ❌ Old (removed)
stepViewer.inputGraphRenderer
stepViewer.outputGraphRenderer
stepViewer.inputMermaidRenderer
stepViewer.outputMermaidRenderer
stepViewer.currentGraphContainer
```

**MIGRATION:**
```javascript
// ✅ New (use getRenderers() method)
const renderers = stepViewer.getRenderers();
renderers.inputGraphRenderer
renderers.outputGraphRenderer
renderers.inputMermaidRenderer
renderers.outputMermaidRenderer
```

### Comment Updates - No Breaking Changes

The following changes only affect documentation/comments and do not break functionality:

#### DOM Access Fallback Comments

**Changed:** Misleading "backward compatibility" comments updated to clarify these are intentional features, not legacy code.

**Files Affected:**
- `src/utils/dom/DOMRegistry.js` - `getElementSafe()` method
- `src/utils/dom/DOMElementManager.js` - `getElement()` method
- `src/components/features/LogViewer.js` - `getElement()` method
- `src/core/CPEEDebugConsole.js` - `getElement()` method
- `src/components/features/StepViewer.js` - `getElement()` method
- `src/components/ui/Sidebar.js` - Removed commented-out legacy code
- `src/components/renderers/CPEEWfAdaptorRenderer.js` - `showStatus()` fallback
- `src/components/ui/StepNavigator.js` - Alternative key registration

**No Action Required:** These are documentation improvements only.

## Migration Examples

### Example 1: Full StepViewer Migration

**Before:**
```javascript
// ❌ Old code
const stepViewer = new StepViewer(instanceService, domRegistry);

// Navigate through steps
await stepViewer.nextStep();
await stepViewer.previousStep();

// Update content
await stepViewer.updateInputCpeeSection(xml);
await stepViewer.updateOutputIntermediateSection(mermaid);

// Access renderers
if (stepViewer.inputGraphRenderer) {
    console.log('Renderer ready');
}
```

**After:**
```javascript
// ✅ New code
const stepViewer = new StepViewer(instanceService, domRegistry);

// Navigate through steps using navigator
await stepViewer.getNavigator().nextStep();
await stepViewer.getNavigator().previousStep();

// Update content using content manager
await stepViewer.getContentManager().updateInputCpeeSection(xml);
await stepViewer.getContentManager().updateOutputIntermediateSection(mermaid);

// Access renderers via method
const renderers = stepViewer.getRenderers();
if (renderers.inputGraphRenderer) {
    console.log('Renderer ready');
}
```

### Example 2: Navigation Setup

**Before:**
```javascript
// ❌ Old code
stepViewer.setupStepNavigation();
stepViewer.updateStepNavigation(navInfo);
```

**After:**
```javascript
// ✅ New code
const navigator = stepViewer.getNavigator();
navigator.setupNavigation();
navigator.updateNavigation(navInfo);

// Or in one line
stepViewer.getNavigator().setupNavigation();
stepViewer.getNavigator().updateNavigation(navInfo);
```

### Example 3: Content Updates

**Before:**
```javascript
// ❌ Old code
const cleanup = stepViewer.preserveHeightDuringTransition(element);
await stepViewer.updateInputCpeeSection(xmlContent);
cleanup();
```

**After:**
```javascript
// ✅ New code
const contentManager = stepViewer.getContentManager();
const cleanup = contentManager.preserveHeightDuringTransition(element);
await contentManager.updateInputCpeeSection(xmlContent);
cleanup();
```

## Benefits of Migration

1. **Clearer Architecture:** Direct access to specialized components makes the code structure more obvious
2. **Better Separation of Concerns:** Navigation and content management are clearly separated
3. **Improved Maintainability:** Less delegation means easier debugging and modification
4. **Reduced Complexity:** Fewer methods on StepViewer makes the API surface cleaner
5. **Future-Proof:** Direct component access allows for more flexibility in future updates

## Troubleshooting

### Issue: `TypeError: stepViewer.nextStep is not a function`

**Cause:** Using removed delegation method

**Solution:** Use navigator component directly
```javascript
// Change this:
stepViewer.nextStep();
// To this:
stepViewer.getNavigator().nextStep();
```

### Issue: `TypeError: Cannot read property 'inputGraphRenderer' of undefined`

**Cause:** Accessing removed renderer properties directly

**Solution:** Use getRenderers() method
```javascript
// Change this:
const renderer = stepViewer.inputGraphRenderer;
// To this:
const renderers = stepViewer.getRenderers();
const renderer = renderers.inputGraphRenderer;
```

### Issue: Code works but produces warnings about fallback ID lookup

**Cause:** Element key not registered in DOMRegistry

**Solution:** Register the element key properly
```javascript
domRegistry.register('myElement', 'my-element-id');
```

## Timeline

- **v1.x:** Legacy methods marked as `@deprecated`
- **v2.0:** Legacy methods removed, migration guide created
- **Future:** Continued cleanup and optimization

## Need Help?

If you encounter issues during migration:
1. Check this guide for common solutions
2. Review the component documentation in source files
3. Look at updated examples in the test files
4. Check the git history for migration examples

## Related Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - Understanding the component structure
- [API Reference](docs/API.md) - Complete API documentation
- [Refactoring Notes](docs/REFACTORING.md) - Details on why changes were made

---

**Last Updated:** 2025-10-22
**Applies to Version:** 2.0.0+

