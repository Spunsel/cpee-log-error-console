# Architecture Overview

The CPEE Log Error Console follows a modular, component-based architecture with clear separation of concerns.

## Project Structure

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
│   ├── HighlightingService.js
│   ├── InstanceService.js
│   ├── LogService.js
│   └── SearchService.js
├── components/              # UI components organized by responsibility
│   ├── ui/                 # Pure UI components
│   ├── views/              # Main view components
│   ├── renderers/          # Graph rendering components
│   └── coordinators/       # Content coordination
├── utils/                   # Helper utilities organized by domain
│   ├── content/            # Content processing utilities
│   ├── dom/                # DOM manipulation utilities
│   ├── extraction/         # Task extraction utilities
│   ├── interaction/        # User interaction handlers
│   ├── mapping/            # Task mapping utilities
│   └── system/             # System-level utilities
└── assets/                  # Static resources
```

## Architecture Layers

### Core Layer

- **CPEEDebugConsole**: Main application controller coordinating all components
- **DOMRegistry**: Centralized DOM element management and manipulation
- **EventBus**: Event-driven communication system for component coordination
- **ServiceFactory**: Factory pattern for service instantiation and dependency injection
- **StateManager**: Application state management and persistence

### Models Layer

- **CPEEStep & CPEEInstance**: Object-oriented representation of CPEE instance and user modification step
- **Raw Content Models**: Specialized models for different content types (CPEETreeRaw, MermaidRaw, UserInputRaw)
- **TaskIdentifier**: Model for identifying and mapping tasks across different views and formats

### Service Layer

- **LogService**: YAML/text log parsing and step extraction with CORS handling
- **InstanceService**: Multi-instance management and navigation state
- **CPEEService**: CPEE server communication and UUID resolution
- **HighlightingService**: Cross-view task highlighting and visual coordination
- **SearchService**: Content search and filtering functionality

### Component Layer

- **UI Components**: Pure interface elements (action bar, search bar, sidebar navigation, step controls)
- **Views**: Main view components (instance loader, log viewing, step navigation)
- **Renderers**: Graph rendering components (CPEE WfAdaptor, Mermaid.js integration, raw content display)
- **Coordinators**: Content coordination and section management (visualization, highlighting, raw content, view mode)

### Utility Layer

- **Content Processing**: CPEE, log, and Mermaid parsing utilities
- **DOM Utilities**: DOM manipulation, status management, and SVG processing
- **Task Extraction**: Specialized extractors for CPEE, Mermaid, and SVG task identification
- **User Interaction**: Click handlers and interaction detection for different graph types
- **Task Mapping**: Cross-view task mapping and coordination utilities
- **System Utilities**: Library loading, jQuery extensions, and URL management

## Technologies Used

- **Frontend**: JavaScript (ES6+), HTML5, CSS3
- **Graph Rendering**: Mermaid.js, CPEE WfAdaptor
- **Data Processing**: Custom YAML/XML parsers with content cleaning
- **DOM Management**: Centralized DOM registry pattern
- **Architecture**: Component-based design with clear separation of concerns

