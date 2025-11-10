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
├── app.js                   # Application entry point
├── core/                    # Core application logic
│   ├── CPEEDebugConsole.js
│   ├── DOMRegistry.js
│   ├── EventBus.js
│   ├── ServiceFactory.js
│   └── StateManager.js
├── config/                  # Configuration management
│   └── ConfigManager.js
├── models/                  # Data models
│   ├── CPEEInstance.js
│   ├── CPEEStep.js
│   ├── CPEETreeRaw.js
│   ├── MermaidRaw.js
│   ├── TaskIdentifier.js
│   └── UserInputRaw.js
├── services/                # Business logic services
│   ├── CPEEService.js
│   ├── EventProcessingService.js
│   ├── HighlightingService.js
│   ├── InstanceService.js
│   ├── LogFetchService.js
│   ├── SearchService.js
│   ├── StepAssemblyService.js
│   ├── TaskMappingService.js
│   └── TraceCalculationService.js
├── components/              # UI components organized by responsibility
│   ├── ui/                 # Pure UI components
│   │   ├── ActionBar.js
│   │   ├── CopyButton.js
│   │   ├── SearchBar.js
│   │   ├── Sidebar.js
│   │   ├── StepDropdown.js
│   │   ├── StepNavigator.js
│   │   └── ViewModeToggle.js
│   ├── views/              # Main view components
│   │   ├── InstanceLoaderViewer.js
│   │   ├── LogViewer.js
│   │   └── StepViewer.js
│   ├── renderers/          # Graph rendering components
│   │   ├── CPEEWfAdaptorRenderer.js
│   │   ├── MermaidRenderer.js
│   │   └── RawContentRenderer.js
│   └── coordinators/       # Content coordination
│       ├── ContentVisualizationCoordinator.js
│       ├── HighlightCoordinator.js
│       ├── RawContentCoordinator.js
│       └── ViewModeCoordinator.js
├── utils/                   # Helper utilities organized by domain
│   ├── content/            # Content processing utilities
│   │   ├── CPEEParser.js
│   │   ├── LogParser.js
│   │   └── MermaidParser.js
│   ├── dom/                # DOM manipulation utilities
│   │   ├── DOMStatusManager.js
│   │   ├── DOMUtils.js
│   │   └── SVGProcessor.js
│   ├── extraction/         # Task extraction utilities
│   │   ├── CPEETaskExtractor.js
│   │   ├── MermaidTaskExtractor.js
│   │   └── SVGTaskExtractor.js
│   ├── interaction/        # User interaction handlers
│   │   ├── CPEESVGClickHandler.js
│   │   ├── MermaidSVGClickHandler.js
│   │   └── SVGClickDetector.js
│   ├── mapping/            # Task mapping utilities
│   │   └── TaskMapper.js
│   └── system/             # System-level utilities
│       ├── JQueryExtensions.js
│       ├── LibraryLoader.js
│       └── URLManager.js
├── libs/                    # External libraries
│   └── cpee-layout/        # CPEE WfAdaptor & themes
│       ├── themes/
│       ├── wfadaptor.css
│       └── wfadaptor.js
└── assets/                  # Static resources
    ├── icons.js
    └── style.css
```

### Core Architecture

#### Core Layer
- **CPEEDebugConsole**: Main application controller coordinating all components
- **DOMRegistry**: Centralized DOM element management and manipulation
- **EventBus**: Event-driven communication system for component coordination
- **ServiceFactory**: Factory pattern for service instantiation and dependency injection
- **StateManager**: Application state management and persistence

#### Models Layer
- **CPEEStep & CPEEInstance**: Object-oriented representation of CPEE instance and user modification step
- **Raw Content Models**: Specialized models for different content types (CPEETreeRaw, MermaidRaw, UserInputRaw)
- **TaskIdentifier**: Model for identifying and mapping tasks across different views and formats

#### Service Layer  
- **LogFetchService**: YAML log fetching and parsing with CORS handling and proxy rotation
- **EventProcessingService**: Event filtering, grouping, and processing operations
- **StepAssemblyService**: Orchestrates step creation from log events
- **TaskMappingService**: Task extraction and cross-format task mapping
- **TraceCalculationService**: Execution trace calculation for graph sections
- **InstanceService**: Multi-instance management and navigation state
- **CPEEService**: CPEE server communication and UUID resolution
- **HighlightingService**: Cross-view task highlighting and visual coordination
- **SearchService**: Content search and filtering functionality

#### Component Layer
- **UI Components**: Pure interface elements (action bar, search bar, sidebar navigation, step controls, copy button, view mode toggle)
- **Views**: Main view components (instance loader, log viewing, step navigation)
- **Renderers**: Graph rendering components (CPEE WfAdaptor, Mermaid.js integration, raw content display)
- **Coordinators**: Content coordination and section management (visualization, highlighting, raw content, view mode)

#### Utility Layer
- **Content Processing**: CPEE, log, and Mermaid parsing utilities
- **DOM Utilities**: DOM manipulation, status management, and SVG processing
- **Task Extraction**: Specialized extractors for CPEE, Mermaid, and SVG task identification
- **User Interaction**: Click handlers and interaction detection for different graph types
- **Task Mapping**: Cross-view task mapping and coordination utilities
- **System Utilities**: Library loading, jQuery extensions, and URL management

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
