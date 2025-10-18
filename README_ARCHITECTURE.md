# CPEE Log Error Console - Architecture

## 🏗️ System Overview

The CPEE Log Error Console is built using a modular, object-oriented architecture that separates concerns into distinct layers. The system provides visual debugging capabilities for CPEE (Cloud Process Execution Engine) workflows through multiple graph rendering engines and a comprehensive step-by-step navigation interface.

## 📁 Project Structure

```
cpee-log-error-console/
├── index.html                          # Main application entry point
├── src/
│   ├── core/                          # Core application logic
│   │   └── CPEEDebugConsole.js       # Main application controller
│   ├── modules/                       # Business logic classes  
│   │   ├── CPEEStep.js               # Individual step representation
│   │   └── CPEEInstance.js           # Process instance management
│   ├── services/                      # Data management layer
│   │   ├── LogService.js             # Log parsing and processing
│   │   ├── InstanceService.js        # Multi-instance management
│   │   └── CPEEService.js            # CPEE server communication
│   ├── components/                    # UI components and renderers
│   │   ├── Sidebar.js                # Instance navigation sidebar
│   │   ├── StepViewer.js             # Main content display
│   │   ├── CPEEWfAdaptorRenderer.js  # CPEE graph renderer
│   │   └── MermaidRenderer.js        # Mermaid diagram renderer
│   ├── parsers/                       # Data parsing utilities
│   │   └── YAMLParser.js             # YAML log file parser
│   ├── utils/                         # Helper utilities
│   │   └── DOMUtils.js               # DOM manipulation helpers
│   └── assets/                        # Static resources
│       └── style.css                 # Application styles
├── test_cpee_graph_from_xml.html     # CPEE graph testing
├── test_mermaid_graph_from_raw.html  # Mermaid graph testing
├── README.md                          # Project documentation
├── README_ARCHITECTURE.md            # This file
└── roadmap.md                         # Development roadmap
```

## 🧩 Core Architecture Layers

### **1. Core Layer (`/core/`)**

#### **CPEEDebugConsole.js**
The main application controller that orchestrates all system components.

**Key Responsibilities:**
- Application initialization and lifecycle management
- Component coordination and event handling
- URL parameter processing and routing
- Global state management

**Dependencies:**
- All service layer components
- All UI components
- Module classes

### **2. Module Layer (`/modules/`)**

#### **CPEEStep.js**
Represents a single execution step in a CPEE process.

**Properties:**
- `stepNumber`: Sequential step identifier
- `changeUuid`: Unique change identifier
- `timestamp`: Step execution timestamp
- `content`: Step content (inputCpeeTree, inputIntermediate, userInput, outputIntermediate, outputCpeeTree)

**Methods:**
- `getDisplayName()`: Human-readable step name
- `getContent(section)`: Retrieve specific content section
- `hasContent(section)`: Check if section has content
- `getFormattedTimestamp()`: Formatted time display
- `getSummary()`: Step summary information

#### **CPEEInstance.js**
Manages a complete CPEE process instance with multiple steps.

**Properties:**
- `uuid`: Unique process identifier
- `processNumber`: Human-readable process number
- `steps`: Array of CPEEStep objects
- `currentStepIndex`: Currently active step
- `loadedTimestamp`: Instance load time

**Methods:**
- `nextStep()`, `previousStep()`: Navigation
- `goToStep(index)`: Direct navigation
- `getCurrentStep()`: Current step access
- `getNavigationInfo()`: Navigation state
- `findStepByChangeUuid()`: Step lookup

### **3. Service Layer (`/services/`)**

#### **LogService.js**
Handles log data parsing and step extraction.

**Key Features:**
- YAML and plain text log parsing
- Step content extraction and cleaning
- Content validation and normalization
- Error handling for malformed data

#### **InstanceService.js**
Manages multiple CPEE instances and navigation state.

**Key Features:**
- Multi-instance storage and retrieval
- Navigation state management
- Instance lifecycle management
- Current instance/step tracking

#### **CPEEService.js**
Handles communication with CPEE servers.

**Key Features:**
- HTTP request management
- Process data fetching
- Server endpoint configuration
- Authentication handling

### **4. Component Layer (`/components/`)**

#### **Sidebar.js**
Instance selection and navigation interface.

**Features:**
- Instance list display
- Active instance highlighting
- Instance selection callbacks
- Responsive design

#### **StepViewer.js**
Main content display component with graph rendering coordination.

**Key Features:**
- Step content section management
- Graph renderer coordination
- Loading state management
- Height preservation during navigation
- Content cleaning and validation

#### **CPEEWfAdaptorRenderer.js**
Authentic CPEE graph visualization using the official WfAdaptor library.

**Features:**
- Isolated renderer instances with unique DOM IDs
- SVG graph generation from CPEE XML
- Event handling isolation
- Height and width management
- Error handling with fallback content

#### **MermaidRenderer.js**
Mermaid.js integration for flowchart diagram rendering.

**Features:**
- Dynamic Mermaid.js library loading
- Custom theme configuration (white backgrounds, black borders)
- Code cleaning and validation
- Responsive SVG sizing
- Multiple diagram type support

## 🔄 Data Flow Architecture

### **1. Initialization Flow**
```
CPEEDebugConsole.init()
├── Initialize services (LogService, InstanceService, CPEEService)  
├── Initialize components (Sidebar, StepViewer)
├── Setup graph renderers (CPEEWfAdaptorRenderer, MermaidRenderer)
├── Process URL parameters
└── Load initial instance (if specified)
```

### **2. Instance Loading Flow**
```
User Input → CPEEService.fetchProcess()
├── LogService.parseLog()
├── Create CPEEStep objects
├── Create CPEEInstance object
├── InstanceService.addInstance()
└── Display in Sidebar
```

### **3. Step Navigation Flow**
```
User Navigation → InstanceService.goToStep()
├── Update CPEEInstance.currentStepIndex
├── StepViewer.displayStep()
├── Render CPEE graphs (Input/Output trees)
├── Render Mermaid graphs (Intermediate content)
└── Update navigation controls
```

### **4. Graph Rendering Flow**
```
StepViewer.displayStep()
├── Extract content sections
├── CPEEWfAdaptorRenderer.renderGraph() (for CPEE XML)
│   ├── Generate unique DOM IDs
│   ├── Initialize WfAdaptor
│   ├── Render SVG graph
│   └── Apply styling and isolation
└── MermaidRenderer.renderGraph() (for Mermaid content)
    ├── Clean and validate Mermaid code
    ├── Load Mermaid.js library
    ├── Render SVG diagram
    └── Apply custom theming
```

## 🎨 Design Patterns

### **1. Observer Pattern**
Components communicate through callback registration:
- Sidebar registers instance selection callbacks
- StepViewer registers navigation callbacks
- Renderers register completion callbacks

### **2. Strategy Pattern**
Multiple rendering strategies for different content types:
- CPEEWfAdaptorRenderer for CPEE XML
- MermaidRenderer for Mermaid diagrams
- Fallback text rendering for unsupported content

### **3. Factory Pattern**
Step and instance creation through service layer:
- LogService creates CPEEStep objects
- InstanceService manages instance lifecycle

### **4. Singleton Pattern**
Service instances maintain single state:
- InstanceService maintains global instance state
- CPEEDebugConsole coordinates system-wide state

## 🔧 Component Isolation

### **Graph Renderer Isolation**
Each graph renderer operates in isolation to prevent conflicts:

1. **Unique DOM IDs**: All elements use timestamp-based unique identifiers
2. **Event Isolation**: jQuery event handlers are scoped to specific containers
3. **CSS Isolation**: Styles target specific ID patterns
4. **Memory Management**: Renderers clean up on reset

### **Content Processing Pipeline**
```
Raw Log Data
├── YAMLParser.parse() → Structured data
├── LogService.extractSteps() → Step objects
├── Content cleaning and validation
└── Section-specific rendering
```

## 📊 Performance Considerations

### **Lazy Loading**
- Graph renderers initialize only when needed
- Mermaid.js loads dynamically from CDN
- SVG generation happens on-demand

### **Memory Management**
- DOM elements cleaned up on navigation
- Event listeners properly removed
- Renderer instances reused when possible

### **Rendering Optimization**
- Height preservation prevents layout thrashing
- Unique IDs prevent DOM conflicts
- Asynchronous rendering with loading states

## 🔒 Security Features

### **Input Sanitization**
- HTML escaping for user content
- Mermaid code validation and cleaning
- URL parameter sanitization

### **Content Security**
- No eval() usage
- Safe DOM manipulation
- External library loading from trusted CDNs

## 🧪 Testing Architecture

### **Component Testing**
- `test_cpee_graph_from_xml.html`: CPEE renderer testing
- `test_mermaid_graph_from_raw.html`: Mermaid renderer testing
- Isolated testing environments for each renderer

### **Integration Testing**
- End-to-end workflow testing through main interface
- Multi-instance testing capabilities
- Cross-browser compatibility validation

## 🚀 Extensibility

### **Adding New Renderers**
1. Create renderer class in `/components/`
2. Implement standard interface (initialize, renderGraph, resetContainer)
3. Register in StepViewer content sections
4. Add CSS styling for isolation

### **Supporting New Log Formats**
1. Create parser in `/parsers/`
2. Extend LogService with new format detection
3. Add content extraction logic
4. Update validation rules

### **Extending Data Models**
1. Add properties to CPEEStep or CPEEInstance
2. Update serialization methods (toObject, fromObject)
3. Extend service layer methods
4. Update UI components as needed

---

This architecture provides a solid foundation for debugging CPEE workflows while maintaining separation of concerns, component isolation, and extensibility for future enhancements.