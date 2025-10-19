# CPEE Log Error Console - Architecture

## 🏗️ System Overview

The CPEE Log Error Console is a modular debugging interface for CPEE (Cloud Process Execution Engine) workflows. It provides step-by-step navigation with multiple graph rendering engines for visual workflow analysis.

## 📁 Project Structure

```
cpee-log-error-console/
├── index.html                          # Application entry point
├── src/
│   ├── app.js                         # Application bootstrap
│   ├── core/                          # Core application logic
│   │   ├── CPEEDebugConsole.js       # Main application controller
│   │   └── DOMRegistry.js            # DOM element management
│   ├── config/                        # Configuration management
│   │   ├── api.js                    # API endpoints & CORS config
│   │   └── constants.js              # UI-specific constants
│   ├── modules/                       # Business logic classes  
│   │   ├── CPEEStep.js               # Step representation
│   │   └── CPEEInstance.js           # Process instance management
│   ├── services/                      # Data management layer
│   │   ├── LogService.js             # Log parsing & processing
│   │   ├── InstanceService.js        # Multi-instance management
│   │   └── CPEEService.js            # CPEE server communication
│   ├── components/                    # UI components & renderers
│   │   ├── Sidebar.js                # Instance navigation
│   │   ├── StepViewer.js             # Main content display
│   │   ├── LogViewer.js              # Raw log viewer
│   │   ├── CPEEWfAdaptorRenderer.js  # CPEE graph renderer
│   │   └── MermaidRenderer.js        # Mermaid diagram renderer
│   ├── utils/                         # Helper utilities
│   │   ├── DOMUtils.js               # DOM manipulation
│   │   ├── URLUtils.js               # URL processing
│   │   └── YAMLParser.js             # YAML log parser
│   ├── libs/                          # External libraries
│   │   └── cpee/                     # CPEE WfAdaptor & themes
│   └── assets/
│       └── style.css                 # Application styles
└── test_*.html                        # Component tests
```

## 🧩 Architecture Layers

### **Core Layer** (`/core/`)
- **CPEEDebugConsole**: Main application controller, coordinates all components
- **DOMRegistry**: Centralized DOM element management with dependency injection

### **Configuration Layer** (`/config/`)
- **api.js**: Centralized API endpoints, CORS proxies, and network configuration
- **constants.js**: UI-specific constants (timeouts, display limits)

### **Service Layer** (`/services/`)
- **LogService**: YAML log parsing, step extraction, CORS-enabled fetching
- **InstanceService**: Multi-instance storage, navigation state management
- **CPEEService**: CPEE server communication, UUID resolution

### **Component Layer** (`/components/`)
- **Sidebar**: Instance tabs and navigation
- **StepViewer**: Main content display, graph renderer coordination
- **LogViewer**: Raw log content display with download functionality
- **Renderers**: Isolated graph rendering (CPEE WfAdaptor, Mermaid.js)

### **Module Layer** (`/modules/`)
- **CPEEInstance**: Process instance with steps and navigation
- **CPEEStep**: Individual execution step with content sections

### **Utility Layer** (`/utils/`)
- **YAMLParser**: Multi-document YAML parsing for CPEE logs
- **DOMUtils**: Safe DOM manipulation helpers
- **URLUtils**: URL parameter processing

## 🔄 Key Data Flows

### **Instance Loading**
```
Input (UUID/Process#) → CPEEService → LogService → YAMLParser 
→ CPEEStep objects → CPEEInstance → InstanceService → Sidebar
```

### **Step Navigation**
```
User Action → InstanceService → StepViewer → Content Renderers
├── CPEE XML → CPEEWfAdaptorRenderer
├── Mermaid Code → MermaidRenderer  
└── Plain Text → Direct Display
```

### **Configuration Management**
```
api.js exports → Services import → Centralized API/CORS handling
├── buildLogUrl(), buildGraphUrl() helper functions
└── CORS_CONFIG.PROXIES with fallback support
```

## 🎨 Design Patterns

- **Observer**: Component communication via callbacks
- **Strategy**: Multiple rendering engines for different content types  
- **Factory**: Service layer creates and manages object instances
- **Dependency Injection**: DOMRegistry provides DOM elements to components

## 🔧 Component Isolation

### **Graph Renderers**
- Unique DOM IDs prevent conflicts
- Isolated CSS scoping  
- Independent library loading
- Proper cleanup on navigation

### **Configuration Management**
- Single source of truth for API endpoints
- Centralized CORS proxy configuration
- Environment-agnostic URL building functions
- Consistent error handling across services

## 📊 Performance Features

- **Lazy Loading**: Renderers initialize on-demand
- **Memory Management**: Proper cleanup on navigation
- **Height Preservation**: Prevents layout thrashing
- **CORS Fallback**: Multiple proxy services for reliability

## 🔒 Security

- HTML escaping for user content
- Input sanitization for Mermaid diagrams
- No `eval()` usage
- Trusted CDN library loading

---

**Architecture Benefits:**
- Clear separation of concerns
- Centralized configuration management  
- Component isolation prevents conflicts
- Extensible renderer system
- Comprehensive error handling