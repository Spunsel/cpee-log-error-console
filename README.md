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
├── core/                    # Core application logic
│   ├── CPEEDebugConsole.js
│   ├── DOMRegistry.js
│   └── JQueryExtensions.js
├── config/                  # Configuration management
│   ├── MermaidConfig.js
│   └── ServiceConfig.js
├── models/                  # Data models
│   ├── CPEEInstance.js
│   ├── CPEEStep.js
│   ├── CPEETreeRaw.js
│   ├── MermaidRaw.js
│   └── UserInputRaw.js
├── services/                # Business logic services
│   ├── CPEEService.js
│   ├── InstanceService.js
│   ├── LogService.js
│   ├── MermaidValidationService.js
│   └── SVGProcessingService.js
├── components/              # UI components organized by responsibility
│   ├── ui/                 # Pure UI components
│   │   ├── CopyButton.js
│   │   ├── Sidebar.js
│   │   ├── StepNavigator.js
│   │   └── ViewModeToggle.js
│   ├── views/              # Main view components
│   │   ├── LogViewer.js
│   │   └── StepViewer.js
│   ├── renderers/          # Graph rendering components
│   │   ├── CPEEWfAdaptorRenderer.js
│   │   ├── MermaidRenderer.js
│   │   └── RawContentRenderer.js
│   └── coordinators/       # Content coordination
│       ├── ContentSectionManager.js
│       ├── RawContentViewManager.js
│       └── ViewModeManager.js
├── utils/                   # Helper utilities organized by domain
│   ├── content/            # Content processing utilities
│   │   ├── ContentCleaner.js
│   │   ├── XMLParser.js
│   │   └── YAMLParser.js
│   ├── dom/                # DOM manipulation utilities
│   │   ├── DOMUtils.js
│   │   └── StatusManager.js
│   └── system/             # System-level utilities
│       └── LibraryLoader.js
├── libs/                    # External libraries
│   └── cpee/               # CPEE WfAdaptor & themes
│       ├── css/
│       ├── themes/
│       └── wfadaptor.js
└── assets/                  # Static resources
    ├── icons.js
    └── style.css
```

### Core Architecture

#### Core Layer
- **CPEEDebugConsole**: Main application controller coordinating all components
- **DOMRegistry**: Centralized DOM element management and manipulation
- **JQueryExtensions**: jQuery integration utilities for CPEE system

#### Models Layer
- **CPEEStep & CPEEInstance**: Object-oriented representation of CPEE instance and user modification step
- **Raw Content Models**: Specialized models for different content types (CPEETreeRaw, MermaidRaw, UserInputRaw)

#### Service Layer  
- **LogService**: YAML/text log parsing and step extraction with CORS handling
- **InstanceService**: Multi-instance management and navigation state
- **CPEEService**: CPEE server communication and UUID resolution
- **MermaidValidationService**: Mermaid diagram validation and preprocessing
- **SVGProcessingService**: SVG element processing and jQuery integration

#### Component Layer
- **UI Components**: Pure interface elements (sidebar navigation, step controls, copy button, view mode toggle)
- **Views**: Main view components (log viewing, step navigation)
- **Renderers**: Graph rendering components (CPEE WfAdaptor, Mermaid.js integration, raw content display)
- **Coordinators**: Content coordination and section management

#### Utility Layer
- **Content Processing**: XML/YAML parsing and content cleaning utilities
- **DOM Utilities**: DOM manipulation and status management
- **System Utilities**: Library loading and system-level functions

### Technologies Used
- **Frontend**: JavaScript (ES6+), HTML5, CSS3
- **Graph Rendering**: Mermaid.js, CPEE WfAdaptor
- **Data Processing**: Custom YAML/XML parsers with content cleaning
- **DOM Management**: Centralized DOM registry pattern
- **Architecture**: Component-based design with clear separation of concerns

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
