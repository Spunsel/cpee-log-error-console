# CPEE LLM Debugging Console

A web-based debugging console for the LLM-driven workflow modification pipeline within the [Cloud Process Execution Engine (CPEE)](https://cpee.org). It provides visual transparency, traceability, and systematic debugging capabilities for each step of the LLM process modification cycle.

## Table of Contents

- [Motivation](#motivation)
- [Features](#features)
- [Getting Started](#getting-started)
- [CORS Proxy](#cors-proxy)
- [Usage](#usage)
- [Architecture](#architecture)
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

- **Soundness** verification (option to complete, proper completion, no dead transitions)
- **Boundedness** verification (no unbounded paths)
- **Reachability** analysis (all nodes reachable from start and from end)

### Search and Navigation

- Full-text **search** across all code sections
- **Code minimap** for navigating large code blocks
- **Section expand/collapse** for managing screen space

### Additional Features

- **Dark mode** with persistent preference
- **Syntax highlighting** via Prism.js with theme support
- **Copy to clipboard** for any content section
- **Download** raw content sections
- **Interactive demo tour** for new users

## Getting Started

### Prerequisites

- [Python 3](https://www.python.org) (for serving the application)

### Quick Start

```bash
git clone https://github.com/Spunsel/cpee-log-error-console.git
cd cpee-log-error-console
python3 -m http.server 8000
```

The console opens at **http://localhost:8000**.

### Fallback Data (Optional)

The app can resolve **process numbers → UUIDs** and load **gzip-compressed logs** from local files when the CPEE API is slow or unavailable. That data lives under **`fallback/`**:

- `fallback/uuid-mapping.json` — JSON map of process number (string key) to UUID
- `fallback/logs/` — one gzip file per cached instance: `{uuid}.xes.yaml.gz`. The app decompresses these in the browser via `DecompressionStream`.

To refresh or build this cache from the flow engine, run the bundled PowerShell script from the **repository root**. It merges new mappings with any existing `uuid-mapping.json`, downloads logs, and saves them as gzip into `fallback/logs/`:

```powershell
powershell -File scripts/fetch-and-update.ps1
```

To compress existing uncompressed logs (one-time migration or cleanup):

```powershell
powershell -File scripts/compress-fallback-logs.ps1
```

Edit the `$processNumbers` array at the top of `scripts/fetch-and-update.ps1` if you only need a subset of instances.

## CORS Proxy

Browsers cannot call `cpee.org` directly (CORS). For live log fetching and instance scanning, the console routes requests through a small **serverless proxy** hosted on [Vercel](https://vercel.com) — a free cloud platform that runs the `api/proxy.js` function and adds the required CORS headers.

**You do not need to set anything up.** The app is preconfigured in `src/config/ConfigManager.js` to use `https://cpee-cors-proxy.vercel.app`. Clone the repo and run it; live CPEE requests work out of the box.

If you only use **known instances** from the preloaded list, the bundled **fallback logs** are enough.


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

## Technologies

| Category | Technology |
|----------|-----------|
| Language | JavaScript (ES6+ modules) |
| Serving | Static files — Python `http.server` locally, [GitHub Pages](https://pages.github.com) in production |
| Graph rendering | [Mermaid.js](https://mermaid.js.org), CPEE WfAdaptor |
| Syntax highlighting | [Prism.js](https://prismjs.com) |
| Testing | Node.js test runner, [jsdom](https://github.com/jsdom/jsdom), [@testing-library](https://testing-library.com) |
| Linting | ESLint, Prettier |

## Author

Christian Horne &lt;christian.horne@tum.de&gt;

Part of a Bachelor's thesis at the Technical University of Munich (TUM).
