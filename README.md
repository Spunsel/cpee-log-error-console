# CPEE Log Error Console

The fundamental goal of this project is to address the "black box" problem inherent in the LLM-driven workflow modification pipeline within the Cloud Process Execution Engine (CPEE), by providing a visual console for transparency, traceability, and systematic debugging capabilities.

## Features

### Visual Workflow Analysis
- **CPEE Graphs**: Native CPEE WfAdaptor integration for process visualization
- **Mermaid Diagrams**: Rendering of intermediate graph format with error handling
- **Multi-Instance Support**: Debug multiple CPEE processes simultaneously
- **Trace Analysis**: Execution trace calculation and comparison across different graph formats
- **Property Verification**: Soundness, boundedness, reachability, and SCC analysis

### Step-by-Step Debugging
- **Process Navigation**: Navigate through execution steps with step controls
- **Content Sections**: Organized display of input CPEE trees, intermediate states, user inputs, and output CPEE trees
- **Analysis Views**: Comprehensive analysis content rendering with trace comparisons
- **Log Viewing**: Raw log content viewing with syntax highlighting

### Advanced Features
- **Cross-Graph Highlighting**: Synchronized highlighting across CPEE and Mermaid views
- **Node Mapping**: Intelligent mapping of nodes/tasks across different formats
- **Dark Mode**: Theme support with dark/light mode toggle
- **Bug Reporting**: Integrated bug reporting system
- **Search & Filter**: Content search and filtering functionality

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
│   ├── NodeIdentifier.js    # Standardized node/task representation
│   ├── Trace.js             # Execution trace model
│   └── UserInputRaw.js
├── services/                # Business logic services
│   ├── ContentProcessingService.js
│   ├── CPEEService.js
│   ├── EmailService.js
│   ├── EventProcessingService.js
│   ├── HighlightingService.js
│   ├── InstanceService.js
│   ├── LogFetchService.js
│   ├── NodeMappingService.js
│   ├── SearchService.js
│   ├── StepAssemblyService.js
│   ├── SyntaxHighlightingService.js
│   └── TraceCalculationService.js
├── components/              # UI components organized by responsibility
│   ├── ui/                 # Pure UI components
│   │   ├── ActionBar.js
│   │   ├── BoundednessDisplay.js
│   │   ├── BugReportModal.js
│   │   ├── ComparisonInfoBox.js
│   │   ├── CopyButton.js
│   │   ├── DarkModeToggle.js
│   │   ├── HideTitleButton.js
│   │   ├── IssuesList.js
│   │   ├── NodeClassificationList.js
│   │   ├── PropertyStatusIndicator.js
│   │   ├── ReachabilityDisplay.js
│   │   ├── ReachabilityMetrics.js
│   │   ├── RecentAdditionsAndFixes.js
│   │   ├── ScaleDisplay.js
│   │   ├── SCCDisplay.js
│   │   ├── SearchBar.js
│   │   ├── SectionExpandCollapse.js
│   │   ├── Sidebar.js
│   │   ├── SoundnessDisplay.js
│   │   ├── StepDropdown.js
│   │   ├── StepNavigator.js
│   │   ├── StepSection.js
│   │   ├── ThemeSelector.js
│   │   ├── TraceDisplay.js
│   │   ├── VerificationStatusCard.js
│   │   └── ViewModeToggle.js
│   ├── views/              # Main view components
│   │   ├── InstanceLoaderViewer.js
│   │   ├── LogViewer.js
│   │   └── StepViewer.js
│   ├── renderers/          # Graph rendering components
│   │   ├── AnalysisContentRenderer.js
│   │   ├── CPEEWfAdaptorRenderer.js
│   │   ├── LogContentRenderer.js
│   │   ├── MermaidRenderer.js
│   │   ├── RawContentRenderer.js
│   │   └── TraceContentRenderer.js
│   └── coordinators/       # Content coordination
│       ├── ContentViewCoordinator.js
│       ├── ContentVisualizationCoordinator.js
│       ├── CrossGraphHighlightCoordinator.js
│       └── TraceComparisonCoordinator.js
├── utils/                   # Helper utilities organized by domain
│   ├── content/            # Content processing utilities
│   │   ├── CPEEParser.js
│   │   ├── LogParser.js
│   │   ├── MermaidErrorHandler.js
│   │   ├── MermaidParser.js
│   │   └── MermaidWarningHandler.js
│   ├── dom/                # DOM manipulation utilities
│   │   ├── DOMStatusManager.js
│   │   ├── DOMUtils.js
│   │   └── SVGProcessor.js
│   ├── extraction/         # Node/task extraction utilities
│   │   ├── CPEETaskExtractor.js
│   │   ├── MermaidTaskExtractor.js
│   │   └── SVGTaskExtractor.js
│   ├── interaction/        # User interaction handlers
│   │   ├── CPEESVGClickHandler.js
│   │   ├── MermaidSVGClickHandler.js
│   │   └── SVGClickDetector.js
│   ├── similarity/         # Similarity calculation utilities
│   │   └── StringSimilarity.js
│   ├── system/             # System-level utilities
│   │   ├── JQueryExtensions.js
│   │   ├── LibraryLoader.js
│   │   └── URLManager.js
│   └── trace/              # Trace calculation utilities
│       ├── CPEETraceCalculator.js
│       ├── MermaidTraceCalculator.js
│       ├── ReachabilityAnalyzer.js
│       ├── SoundnessBoundednessVerifier.js
│       └── TraceComparison.js
├── libs/                    # External libraries
│   └── cpee-layout/        # CPEE WfAdaptor & themes
│       └── themes/
└── assets/                  # Static resources
    ├── fonts/              # Custom fonts
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
- **NodeIdentifier**: Standardized model for identifying and mapping nodes/tasks across different views and formats (replaces TaskIdentifier)
- **Trace**: Model representing execution traces with path information and metadata

#### Service Layer  
- **LogFetchService**: YAML log fetching and parsing with CORS handling and proxy rotation
- **EventProcessingService**: Event filtering, grouping, and processing operations
- **StepAssemblyService**: Orchestrates step creation from log events
- **NodeMappingService**: Node/task extraction and cross-format mapping (replaces TaskMappingService)
- **TraceCalculationService**: Execution trace calculation for graph sections
- **InstanceService**: Multi-instance management and navigation state
- **CPEEService**: CPEE server communication and UUID resolution
- **HighlightingService**: Cross-view node highlighting and visual coordination
- **SearchService**: Content search and filtering functionality
- **ContentProcessingService**: Centralized content processing orchestration
- **SyntaxHighlightingService**: Syntax highlighting for code content (Prism.js integration)
- **EmailService**: Email functionality for bug reporting

#### Component Layer
- **UI Components**: Comprehensive interface elements including:
  - Navigation: Action bar, sidebar, step navigator, step dropdown
  - Display: Property status indicators, trace displays, verification cards
  - Analysis: Boundedness, soundness, reachability, SCC displays
  - Interaction: Search bar, copy button, dark mode toggle, theme selector
  - Specialized: Bug report modal, issues list, comparison info boxes
- **Views**: Main view components (instance loader, log viewing, step navigation)
- **Renderers**: Graph rendering components:
  - **CPEEWfAdaptorRenderer**: CPEE WfAdaptor integration
  - **MermaidRenderer**: Mermaid.js integration
  - **RawContentRenderer**: Raw content display with syntax highlighting
  - **AnalysisContentRenderer**: Comprehensive analysis content rendering
  - **LogContentRenderer**: Log content rendering
  - **TraceContentRenderer**: Trace visualization
- **Coordinators**: Content coordination and section management:
  - **ContentVisualizationCoordinator**: Main visualization coordination
  - **ContentViewCoordinator**: View mode coordination
  - **CrossGraphHighlightCoordinator**: Cross-graph highlighting synchronization
  - **TraceComparisonCoordinator**: Trace comparison coordination

#### Utility Layer
- **Content Processing**: CPEE, log, and Mermaid parsing utilities with error/warning handling
- **DOM Utilities**: DOM manipulation, status management, and SVG processing
- **Node Extraction**: Specialized extractors for CPEE, Mermaid, and SVG node identification
- **User Interaction**: Click handlers and interaction detection for different graph types
- **Trace Utilities**: Trace calculation, comparison, reachability analysis, and property verification
- **Similarity Utilities**: String similarity calculation for node matching
- **System Utilities**: Library loading, jQuery extensions, and URL management

### Technologies Used
- **Frontend**: JavaScript (ES6+), HTML5, CSS3
- **Build Tool**: Vite for development and production builds
- **Graph Rendering**: Mermaid.js, CPEE WfAdaptor
- **Syntax Highlighting**: Prism.js with theme support
- **Data Processing**: Custom YAML/XML parsers with content cleaning
- **DOM Management**: Centralized DOM registry pattern
- **Testing**: Node.js test runner with jsdom for DOM testing
- **Architecture**: Component-based design with clear separation of concerns

## Quick Start

### Setup
```bash
# Clone the repository
git clone https://github.com/Spunsel/cpee-log-error-console.git
cd cpee-log-error-console

# Install dependencies
npm install

# Start development server (Vite)
npm run dev

# The application will be available at http://localhost:8000
```

### Alternative Setup (Simple HTTP Server)
```bash
# For simple static file serving (without Vite features)
npm run serve
# or
python -m http.server 8000
```

### Usage
1. **Load Process**: Enter CPEE process number, fetch UUID, and load process
2. **Navigate Steps**: Use next/previous buttons or step dropdown to explore user LLM modifications
3. **View Graphs**: Automatic rendering of CPEE trees and Mermaid diagrams
4. **Analyze Traces**: View execution traces and compare them across different graph formats
5. **Debug Issues**: Examine intermediate states, error messages, and property verifications
6. **Cross-Graph Highlighting**: Click nodes in one view to see them highlighted in other views
7. **Search & Filter**: Use the search bar to find specific content across all sections

### Development Commands
```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check code formatting
npm run format:check

# Validate (lint + format + test)
npm run validate
```

## Dependencies

### Runtime Dependencies
- **Mermaid.js**: Diagram and flowchart rendering
- **CPEE WfAdaptor**: Authentic CPEE graph visualization  
- **Prism.js**: Syntax highlighting for code content
- **jQuery**: DOM manipulation and utilities (legacy, being modernized)

### Development Dependencies
- **Vite**: Build tool and development server
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **jsdom**: DOM implementation for testing
- **@testing-library/dom**: DOM testing utilities
- **@testing-library/user-event**: User interaction testing
- **jsdoc**: API documentation generation

## License

This project is part of a Bachelor's thesis at TUM (Technical University of Munich).

## Author

Christian Horne <christian.horne@tum.de>

