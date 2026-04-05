# CPEE LLM Debugging Console

A web-based debugging console for the LLM-driven workflow modification pipeline within the [Cloud Process Execution Engine (CPEE)](https://cpee.org). It provides visual transparency, traceability, and systematic debugging capabilities for each step of the LLM process modification cycle.

## Table of Contents

- [Motivation](#motivation)
- [Features](#features)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Architecture](#architecture)
- [Development](#development)
- [Technologies](#technologies)
- [License](#license)

## Motivation

When an LLM modifies a CPEE workflow, the transformation passes through several stages: input CPEE tree, intermediate Mermaid representation, user input, output intermediate, and output CPEE tree. Without tooling, this pipeline is a black box. This console makes every stage inspectable, comparable, and verifiable.

## Features

### Instance Loading and Multi-Instance Support

- Load CPEE instances by **process number** or **UUID**
- **Scan** a range of process numbers to discover available instances
- Load from a **pre-configured list** of known instances
- **Sidebar** for managing and switching between multiple loaded instances
- **Fallback support** with locally cached logs and UUID mappings for offline access

### Step-by-Step Navigation

- Browse through each modification step in an instance's lifecycle
- **Step navigator** with forward, backward, start, and end controls
- **Step dropdown** for direct access to any step
- **Keyboard navigation** with arrow keys
- **Deep linking** via URL parameters for sharing specific steps

### Visual Workflow Rendering

- **CPEE WfAdaptor graphs** rendered natively for process visualization
- **Mermaid diagrams** for the intermediate graph format
- **Scalable SVG** output with zoom controls
- **SVG export** for saving graph visualizations to file

### Five Content View Modes

Each content section supports switching between views:

| Mode | Description |
|------|-------------|
| **Visual** | Rendered SVG graph (CPEE or Mermaid) |
| **Raw** | Preprocessed source content with syntax highlighting |
| **Log** | Untouched original log content |
| **Traces** | Calculated execution traces with filtering |
| **Analysis** | Soundness, boundedness, and reachability verification |

### Cross-Graph Highlighting

- Click a node in any graph to highlight the **corresponding node** in all other views
- Synchronized highlighting across CPEE trees and Mermaid diagrams
- Gateway-aware highlighting that resolves structural differences between formats

### Execution Trace Analysis

- **Trace calculation** for both CPEE and Mermaid graph formats
- **Trace comparison** between input and output pairs
- **Trace filtering** to isolate specific execution paths
- **Trace playback** with auto-play controls and adjustable speed
- **Reconciliation** to validate trace consistency across formats

### Property Verification

- **Soundness** verification (proper completion)
- **Boundedness** verification (no unbounded paths)
- **Reachability** analysis (all nodes reachable from start)
- **Strongly Connected Component (SCC)** detection

### Search and Navigation

- Full-text **search** across all content sections
- **Code minimap** for navigating large content blocks
- **Section expand/collapse** for managing screen space

### Additional Features

- **Dark mode** with persistent preference
- **Syntax highlighting** via Prism.js with theme support
- **Copy to clipboard** for any content section
- **Download** raw content sections
- **Bug reporting** modal with email integration
- **Interactive demo tour** for new users
- **Recent changes** feed from GitHub issues

## Getting Started

### Prerequisites

- [Python 3](https://www.python.org) (for serving the application)
- [Node.js](https://nodejs.org) >= 18.0.0 (optional, for development tooling: tests, linting, Vite dev server)

### Quick Start

```bash
git clone https://github.com/Spunsel/cpee-log-error-console.git
cd cpee-log-error-console
python3 -m http.server 8000
```

The console opens at **http://localhost:8000**.

### Development Setup (Optional)

For hot reload, linting, and testing:

```bash
npm install
npm run dev
```

### Fallback Data (Optional)

To enable offline access with locally cached data:

```bash
# Generate local UUID mappings
./scripts/fetch-uuids.ps1

# Download log files into fallback/logs/
./scripts/fetch-logs.ps1
```

## Usage

1. **Load an instance** &mdash; Enter a CPEE process number or UUID and click *Load Instance*.
2. **Navigate steps** &mdash; Use the step controls or arrow keys to move through modification steps.
3. **Inspect content** &mdash; Each step shows five sections: Input CPEE-Tree, Input Intermediate, User Input, Output Intermediate, and Output CPEE-Tree.
4. **Switch view modes** &mdash; Toggle between Visual, Raw, Log, Traces, and Analysis views per section.
5. **Highlight across graphs** &mdash; Click any node to see it highlighted across all graph views.
6. **Analyze traces** &mdash; View execution traces, compare input/output pairs, or use trace playback.
7. **Verify properties** &mdash; Run soundness, boundedness, and reachability checks from the Analysis view.
8. **Search** &mdash; Use the search bar within Raw or Log views to find content.
9. **Export** &mdash; Download SVGs or copy content from any section.

## Architecture

```
src/
├── app.js                        # Application entry point
├── assets/                       # Icons, fonts, stylesheets
├── config/                       # Centralized configuration
├── core/                         # Application backbone
│   ├── CPEEDebugConsole.js       #   Main controller
│   ├── DOMRegistry.js            #   DOM element management
│   ├── EventBus.js               #   Event-driven messaging
│   ├── ServiceFactory.js         #   Lazy service instantiation
│   └── StateManager.js           #   State and persistence
├── models/                       # Domain models
│   ├── CPEEInstance.js            
│   ├── CPEEStep.js                
│   ├── CPEETreeRaw.js / MermaidRaw.js / UserInputRaw.js
│   ├── NodeIdentifier.js         
│   └── Trace.js                   
├── services/                     # Business logic
│   ├── LogFetchService.js        #   Log retrieval and parsing
│   ├── StepAssemblyService.js    #   Step construction from logs
│   ├── InstanceService.js        #   Multi-instance management
│   ├── NodeMappingService.js     #   Cross-format node mapping
│   ├── TraceCalculationService.js
│   ├── TraceReconciliationService.js
│   ├── HighlightingService.js     
│   ├── SearchService.js           
│   └── ...                        
├── components/
│   ├── coordinators/             # High-level orchestration
│   │   ├── ContentViewCoordinator.js
│   │   ├── ContentVisualizationCoordinator.js
│   │   ├── CrossGraphHighlightCoordinator.js
│   │   ├── TraceComparisonCoordinator.js
│   │   └── TracePlaybackCoordinator.js
│   ├── renderers/                # Content rendering
│   │   ├── CPEEWfAdaptorRenderer.js
│   │   ├── MermaidRenderer.js
│   │   ├── RawContentRenderer.js
│   │   ├── LogContentRenderer.js
│   │   ├── TraceContentRenderer.js
│   │   └── AnalysisContentRenderer.js
│   ├── ui/                       # Reusable UI components
│   └── views/                    # Top-level view containers
│       ├── InstanceLoaderViewer.js
│       ├── StepViewer.js
│       └── LogViewer.js
└── utils/                        # Pure utilities
    ├── content/                  #   Parsers and error handlers
    ├── dom/                      #   SVG processing, DOM helpers
    ├── extraction/               #   Node extraction from graphs
    ├── interaction/              #   Click detection on SVGs
    ├── similarity/               #   String similarity algorithms
    ├── system/                   #   Library loading, URL management
    └── trace/                    #   Trace calculation, comparison,
                                  #   reachability, soundness/boundedness
```

The application follows a layered architecture:

- **Core** manages lifecycle, state, events, and dependency injection.
- **Models** represent domain objects (instances, steps, traces, raw content).
- **Services** contain business logic with no DOM dependencies.
- **Components** handle rendering, UI interaction, and coordination.
- **Utils** provide stateless helper functions.

## Development

The development tooling requires Node.js and npm (`npm install` to set up).

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Lint source code |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting |
| `npm run validate` | Lint + format check + test |
| `npm run docs` | Generate JSDoc documentation |

### Testing

Tests use the Node.js built-in test runner with jsdom for DOM simulation:

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Single file
npm run test:file -- tests/unit/trace/TraceComparison.test.js
```

## Technologies

| Category | Technology |
|----------|-----------|
| Language | JavaScript (ES6+ modules) |
| Build | [Vite](https://vite.dev) |
| Graph rendering | [Mermaid.js](https://mermaid.js.org), CPEE WfAdaptor |
| Syntax highlighting | [Prism.js](https://prismjs.com) |
| Testing | Node.js test runner, [jsdom](https://github.com/jsdom/jsdom), [@testing-library](https://testing-library.com) |
| Linting | ESLint, Prettier |

## License

MIT

## Author

Christian Horne &lt;christian.horne@tum.de&gt;

Part of a Bachelor's thesis at the Technical University of Munich (TUM).
