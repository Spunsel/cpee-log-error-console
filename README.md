# CPEE Log Error Console

A debugging interface for LLM  CPEE extension with visual graph analysis and step-by-step tracking

## Features

### Visual Workflow Analysis
- **CPEE Graphs**: Native CPEE WfAdaptor integration for process visualization
- **Mermaid Diagrams**: Rendering of intermediate graph format
- **Multi-Instance Support**: Possible to debug multiple CPEE processes simultaneously

### Step-by-Step Debugging
- **Process Navigation**: Navigate through execution steps with step controls
- **Content Sections**: Organized display of input svgs, intermediate states, user inputs, and output svgs

## Architecture

### Project Structure
```
src/
├── core/                 # Core application logic
│   ├── CPEEDebugConsole.js
│   └── DOMRegistry.js
├── modules/              # Business logic classes
│   ├── CPEEStep.js      
│   └── CPEEInstance.js  
├── services/             # Data management services
│   ├── LogService.js    
│   ├── InstanceService.js
│   └── CPEEService.js   
├── components/           # UI components organized by responsibility
│   ├── ui/              # Pure UI components
│   │   ├── Sidebar.js
│   │   └── StepNavigator.js
│   ├── renderers/       # Graph rendering components
│   │   ├── CPEEWfAdaptorRenderer.js
│   │   └── MermaidRenderer.js
│   ├── features/        # Feature-specific components
│   │   ├── LogViewer.js
│   │   └── StepViewer.js
│   └── managers/        # Content coordination
│       └── ContentSectionManager.js
├── utils/               # Helper utilities organized by domain
│   ├── dom/            # DOM manipulation
│   │   ├── DOMUtils.js
│   │   ├── DOMElementManager.js
│   │   └── StatusManager.js
│   ├── parsers/        # Data parsing
│   │   ├── XMLProcessor.js
│   │   └── YAMLParser.js
│   ├── integrations/   # Third-party integrations
│   │   ├── cpee/      # CPEE-specific utilities
│   │   └── mermaid/   # Mermaid-specific utilities
│   └── system/        # System-level utilities
│       ├── LibraryLoader.js
│       └── URLUtils.js
├── config/              # Configuration management
│   ├── api.js
│   └── constants.js
├── libs/                # External libraries
│   └── cpee/           # CPEE WfAdaptor & themes
└── assets/             # Static resources
    └── style.css        
```

### Core Architecture

#### Modules Layer
- **CPEEStep & CPEEInstance**: Object-oriented representation of CPEE instance and user modification step

#### Service Layer  
- **LogService**: YAML/text log parsing and step extraction with CORS handling
- **InstanceService**: Multi-instance management and navigation state
- **CPEEService**: CPEE server communication and UUID resolution

#### Component Layer
- **UI Components**: Pure interface elements (sidebar navigation, step controls)
- **Renderers**: Isolated graph rendering (CPEE WfAdaptor, Mermaid.js integration)
- **Features**: Complete functionality modules (log viewing, step navigation)
- **Managers**: Content coordination and section management

#### Utility Layer
- **Domain-organized**: Utilities grouped by responsibility (DOM, parsing, integrations, system)

### Technologies Used
- **Frontend**: JavaScript (ES6+), HTML5, CSS3
- **Graph Rendering**: Mermaid.js, CPEE WfAdaptor
- **Data Processing**: Custom YAML/XML parsers

## Quick Start

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd cpee-log-error-console

# Start local server (required for ES6 modules)
python -m http.server 8000

# Open in browser
open http://localhost:8000
```

### Usage
1. **Load Process**: Enter CPEE process number fetchUUID and load process
2. **Navigate Steps**: Use next/previous buttons to explore user llm modifications
3. **View Graphs**: Automatic rendering of CPEE trees and Mermaid diagrams
4. **Debug Issues**: Examine intermediate states and error messages

## License

This project is part of a Bachelor's thesis at TUM (Technical University of Munich).

## Dependencies

- **Mermaid.js**: Diagram and flowchart rendering
- **CPEE WfAdaptor**: Authentic CPEE graph visualization  
- **jQuery**: DOM manipulation and utilities (legacy, being modernized)
- **Custom CSS**: No external UI frameworks
