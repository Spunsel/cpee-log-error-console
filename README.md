# CPEE Log Error Console

The fundamental goal of this project is to address the \"black box\" problem inherent in the LLM-driven workflow modification pipeline within the Cloud Process Execution Engine (CPEE), by providing a visual console for transparency, traceability, and systematic debugging capabilities.

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
- **Trace Playback**: Auto-play functionality for trace visualization with highlighting
- **Fallback Support**: Local caching for offline access to logs and UUID mappings
- **Trace Reconciliation**: Validation of traces across graph formats with reconciliation
- **Code Minimap**: Visual navigation aid for large code sections
- **SVG Export**: Export graph visualizations as SVG files

## Architecture

### Project Structure
```
.
├── .eslintrc.json
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── index.html
├── package.json
├── README.md
├── docs/
│   └── ... (documentation files)
├── fallback/
│   ├── cpee-themes/
│   │   ├── base.js
│   │   ├── default
│   │   ├── preset/
│   │   ├── presetaltid/
│   │   └── presetid/
│   ├── logs/
│   │   └── ... (local log files)
│   └── uuid-mapping.json
├── scripts/
│   ├── fetch-logs.ps1
│   ├── fetch-uuids.ps1
│   └── temp/
├── src/
│   ├── app.js
│   ├── assets/
│   │   ├── fonts/
│   │   ├── icons.js
│   │   ├── legacy_style.css
│   │   └── styles/
│   ├── components/
│   │   ├── coordinators/
│   │   │   ├── ContentViewCoordinator.js
│   │   │   ├── ContentVisualizationCoordinator.js
│   │   │   ├── CrossGraphHighlightCoordinator.js
│   │   │   ├── TraceComparisonCoordinator.js
|   |   |   └── TracePlaybackCoordinator.js 
│   │   ├── renderers/
│   │   │   ├── AnalysisContentRenderer.js
│   │   │   ├── CPEEWfAdaptorRenderer.js
│   │   │   ├── LogContentRenderer.js
│   │   │   ├── MermaidRenderer.js
│   │   │   ├── RawContentRenderer.js
│   │   │   └── TraceContentRenderer.js
│   │   ├── ui/
│   │   │   ├── ActionBar.js
│   │   │   ├── BoundednessDisplay.js
│   │   │   ├── BugReportModal.js
│   │   │   ├── CodeMinimap.js
│   │   │   ├── ComparisonInfoBox.js
│   │   │   ├── CopyButton.js
│   │   │   ├── DarkModeToggle.js
│   │   │   ├── DownloadButton.js
│   │   │   ├── IssuesList.js
│   │   │   ├── NodeClassificationList.js
│   │   │   ├── PropertyStatusIndicator.js
│   │   │   ├── ReachabilityDisplay.js
│   │   │   ├── ReachabilityMetrics.js
│   │   │   ├── RecentAdditionsAndFixes.js
│   │   │   ├── ScaleDisplay.js
│   │   │   ├── SCCDisplay.js
│   │   │   ├── SearchBar.js
│   │   │   ├── SectionExpandCollapse.js
│   │   │   ├── Sidebar.js
│   │   │   ├── SoundnessDisplay.js
│   │   │   ├── StepDropdown.js
│   │   │   ├── StepNavigator.js
│   │   │   ├── StepSection.js
│   │   │   ├── ThemeSelector.js
│   │   │   ├── TraceDisplay.js
│   │   │   ├── TraceFilter.js
│   │   │   ├── VerificationStatusCard.js
│   │   │   └── ViewModeToggle.js
│   │   └── views/
│   │       ├── InstanceLoaderViewer.js
│   │       ├── LogViewer.js
│   │       └── StepViewer.js
│   ├── config/
│   │   └── ConfigManager.js
│   ├── core/
│   │   ├── CPEEDebugConsole.js
│   │   ├── DOMRegistry.js
│   │   ├── EventBus.js
│   │   ├── ServiceFactory.js
│   │   └── StateManager.js
│   ├── models/
│   │   ├── CPEEInstance.js
│   │   ├── CPEEStep.js
│   │   ├── CPEETreeRaw.js
│   │   ├── MermaidRaw.js
│   │   ├── NodeIdentifier.js
│   │   ├── Trace.js
│   │   └── UserInputRaw.js
│   ├── services/
│   │   ├── ContentProcessingService.js
│   │   ├── CPEEService.js
│   │   ├── EmailService.js
│   │   ├── EventProcessingService.js
│   │   ├── HighlightingService.js
│   │   ├── InstanceFallbackService.js
│   │   ├── InstanceService.js
│   │   ├── LogFetchService.js
│   │   ├── NodeMappingService.js
│   │   ├── SearchService.js
│   │   ├── StepAssemblyService.js
│   │   ├── SyntaxHighlightingService.js
│   │   ├── TraceCalculationService.js
│   │   └── TraceReconciliationService.js
│   └── utils/
│       ├── content/
│       │   ├── CPEEParser.js
│       │   ├── CPEEWarningHandler.js
│       │   ├── LogParser.js
│       │   ├── MermaidErrorHandler.js
│       │   ├── MermaidParser.js
│       │   └── MermaidWarningHandler.js
│       ├── dom/
│       │   ├── DOMStatusManager.js
│       │   ├── SVGProcessor.js
│       │   └── SVGScaleUtility.js
│       ├── extraction/
│       │   ├── CPEENodeExtractor.js
│       │   ├── MermaidNodeExtractor.js
│       │   └── SVGNodeExtractor.js
│       ├── interaction/
│       │   ├── CPEESVGClickHandler.js
│       │   ├── MermaidSVGClickHandler.js
│       │   └── SVGClickDetector.js
│       ├── similarity/
│       │   └── StringSimilarity.js
│       ├── system/
│       │   ├── JQueryExtensions.js
│       │   ├── LibraryLoader.js
│       │   └── URLManager.js
│       └── trace/
│           ├── CPEETraceCalculator.js
│           ├── MermaidTraceCalculator.js
│           ├── ReachabilityAnalyzer.js
│           ├── SoundnessBoundednessVerifier.js
│           └── TraceComparison.js
├── tests/
│   ├── ARCHITECTURE.md
│   ├── QUICK_START.md
│   ├── README.md
│   ├── setup.js
│   ├── config/
│   │   └── ConfigManager.test.js
│   ├── helpers/
│   │   ├── dom-helpers.js
│   │   ├── mock-factory.js
│   │   ├── mock-helpers.js
│   │   └── test-helpers.js
│   ├── manual/
│   │   ├── cross-view-task-highlighting/
│   │   ├── renders/
│   │   ├── trace-calculation/
│   │   └── viewmode/
│   └── unit/
│       ├── core/
│       └── trace/
└── ... (other directories like node_modules/ not shown)
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
- **InstanceFallbackService**: Local fallback for instance data and logs when remote API is unavailable
- **TraceReconciliationService**: Validation and reconciliation of execution traces between CPEE and Mermaid formats

#### Component Layer
- **UI Components**: Comprehensive interface elements including:
  - Navigation: Action bar, sidebar, step navigator, step dropdown
  - Display: Property status indicators, trace displays, verification cards
  - Analysis: Boundedness, soundness, reachability, SCC displays
  - Interaction: Search bar, copy button, dark mode toggle, theme selector
  - Specialized: Bug report modal, issues list, comparison info boxes, download button
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
  - **TracePlaybackCoordinator**: Trace auto-play and highlighting coordination

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

### Fallback Data Setup (Optional)
To enable offline fallback mode with local data:
- Run `scripts/fetch-uuids.ps1` (PowerShell) to generate local UUID mappings
- Run `scripts/fetch-logs.ps1` (PowerShell) to download local log files into fallback/logs/

### Alternative Setup (Simple HTTP Server)
```bash
# For simple static file serving (without Vite features)
npm run serve
# or
python -m http.server 8000
```

### Usage
1. **Load Process**: Enter CPEE process number or UUID to load an instance
2. **Navigate Steps**: Use next/previous buttons or step dropdown to explore user LLM modifications
3. **View Graphs**: Automatic rendering of CPEE trees and Mermaid diagrams
4. **Analyze Traces**: View execution traces and compare them across different graph formats
5. **Trace Playback**: Use auto-play controls to automatically step through trace execution
6. **Debug Issues**: Examine intermediate states, error messages, and property verifications
7. **Cross-Graph Highlighting**: Click nodes in one view to see them highlighted in other views
8. **Search & Filter**: Use the search bar to find specific content across all sections
9. **Export Visualizations**: Export graph SVGs for documentation or analysis

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
