# CPEE Debug Console - Modular Architecture

## 📁 **Project Structure**

```
cpee-log-error-console/
├── src/                          # Source code (modular)
│   ├── core/                     # Core application logic
│   │   └── CPEEDebugConsole.js  # Main application controller
│   ├── services/                 # Business logic services
│   │   ├── LogService.js        # Log fetching and processing
│   │   └── InstanceService.js   # Instance data management
│   ├── components/               # UI components
│   │   ├── Sidebar.js           # Instance tabs sidebar
│   │   ├── StepViewer.js        # Step content display
│   │   └── LogViewer.js         # Raw log display
│   ├── parsers/                  # Data parsing logic
│   │   └── YAMLParser.js        # YAML parsing for CPEE logs
│   ├── utils/                    # Utility functions
│   │   ├── URLUtils.js          # URL parameter handling
│   │   └── DOMUtils.js          # DOM manipulation helpers
│   └── app.js                   # Application entry point
├── js/                          # Legacy files (deprecated)
├── css/                         # Stylesheets
├── index.html                   # Main HTML file
└── README_ARCHITECTURE.md       # This file
```

## 🏗️ **Architecture Overview**

### **Layered Architecture**

1. **Core Layer** (`src/core/`)
   - Main application controller
   - Coordinates all components and services
   - Handles application lifecycle

2. **Service Layer** (`src/services/`)
   - Business logic and data management
   - API communication (log fetching)
   - State management (instances, steps)

3. **Component Layer** (`src/components/`)
   - UI components with specific responsibilities
   - Event handling and user interactions
   - Visual state management

4. **Parser Layer** (`src/parsers/`)
   - Data transformation logic
   - YAML parsing specifically for CPEE logs
   - Content extraction and processing

5. **Utility Layer** (`src/utils/`)
   - Shared helper functions
   - Common utilities (DOM, URL handling)
   - Cross-cutting concerns

## 🔄 **Data Flow**

```
URL Parameters → Core Controller → Services → Parsers → Components → UI
     ↑                                                              ↓
     └── URL Updates ← Event Callbacks ← User Interactions ← Event Listeners
```

## 📦 **Module Responsibilities**

### **Core/CPEEDebugConsole.js**
- Main application orchestrator
- Component coordination
- Application state management
- URL parameter handling

### **Services/LogService.js**
- CORS proxy management
- YAML log fetching
- Step parsing and content extraction
- Event filtering by type

### **Services/InstanceService.js**
- Instance data storage and retrieval
- Step navigation logic
- Current state tracking
- Navigation state management

### **Components/Sidebar.js**
- Instance tab management
- Tab selection handling
- Visual state updates
- Instance selection callbacks

### **Components/StepViewer.js**
- Step content display
- Navigation controls
- Content section updates
- Step change callbacks

### **Components/LogViewer.js**
- Raw log display
- CORS fallback handling
- Log content formatting
- Loading and error states

### **Parsers/YAMLParser.js**
- Multi-document YAML parsing
- CPEE-specific parsing logic
- Value type conversion
- Error handling

### **Utils/URLUtils.js**
- URL parameter parsing
- URL state updates
- History management
- Parameter validation

### **Utils/DOMUtils.js**
- Safe DOM element access
- CSS class management
- Content updates
- HTML escaping

## 🚀 **Usage**

The application is now initialized through ES6 modules:

```html
<script type="module" src="src/app.js"></script>
```

The main controller is accessible globally:

```javascript
// Access the application instance
console.log(window.app.getCurrentState());

// Navigate programmatically
window.app.goToStep(2);

// Reset application
window.app.reset();
```