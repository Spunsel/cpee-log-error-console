# CPEE LLM Error Debugging Console - Project Roadmap

## Project Overview
This bachelor thesis project creates a web-based error debugging console for the CPEE (Cloud Process Execution Engine) LLM service. The console provides detailed step-by-step analysis of the LLM's modeling process with a modular architecture and plans for interactive visualizations.

## Technical Requirements
- **Frontend Only**: HTML, CSS, JavaScript ES6 Modules (no backend required)
- **Architecture**: Modular ES6 structure with separation of concerns
- **Deployment**: GitHub Pages
- **Input**: UUID of CPEE instance with step navigation
- **Data Source**: CPEE log files (.xes.yaml format) from `https://cpee.org/logs/{uuid}.xes.yaml`

## Current Architecture Overview

### 🏗️ **Modular Structure**
```
src/
├── core/           # Application controller and coordination
├── services/       # Business logic and data management  
├── components/     # UI components with specific responsibilities
├── parsers/        # Data transformation and processing
├── utils/          # Shared utilities and helpers
└── assets/         # CSS and static resources
```

### 🔄 **Data Flow**
```
URL Parameters → Core Controller → Services → Parsers → Components → UI
     ↑                                                            ↓
     └── URL Updates ← Callbacks ← User Events ← Event Listeners ←
```

## Phase 1: Foundation (Completed ✅)

### 1.1 Project Setup ✅
- [x] Initialize Git repository
- [x] Create modular project structure with ES6 modules
- [x] Set up HTML, CSS, JavaScript files
- [x] Create comprehensive documentation (README.md, README_ARCHITECTURE.md)

### 1.2 Modular Architecture ✅
- [x] **Core Layer**: Main application controller (CPEEDebugConsole.js)
- [x] **Service Layer**: Business logic (LogService.js, InstanceService.js)
- [x] **Component Layer**: UI components (Sidebar.js, StepViewer.js, LogViewer.js)
- [x] **Parser Layer**: Data transformation (YAMLParser.js)
- [x] **Utility Layer**: Helper functions (URLUtils.js, DOMUtils.js)

### 1.3 UI Framework ✅
- [x] Responsive layout with sidebar and main content area
- [x] Professional styling with CSS variables
- [x] Instance tab management in sidebar
- [x] Step navigation controls with Previous/Next buttons
- [x] Raw log viewer with CORS fallback options

### 1.4 Core Data Handling ✅
- [x] Advanced YAML parser for CPEE .xes.yaml files
- [x] URL parameter parsing and state management
- [x] Multiple CORS proxy handling for log file access
- [x] Robust error handling and user feedback
- [x] Step-based log parsing with chronological sorting

## Phase 2: Core Functionality (Completed ✅)

### 2.1 Log Parser Implementation ✅
- [x] Advanced multi-document YAML parser
- [x] Extract exposition events (`cpee:lifecycle:transition: description/exposition`)
- [x] Group events by `cpee:change_uuid` (representing steps)
- [x] Content extraction for all 5 required components
- [x] Chronological step ordering by timestamp

### 2.2 Step Analysis Engine ✅
- [x] Step sequence identification and chronological ordering
- [x] Complete step-specific content extraction
- [x] Instance data management and caching
- [x] Step navigation with state preservation

### 2.3 Content Extraction ✅
- [x] **Input CPEE-Tree**: XML process definition extraction
- [x] **User Input**: Natural language prompt extraction
- [x] **Output CPEE-Tree**: Modified XML process definition extraction
- [x] **Input/Output Intermediate**: Mermaid format diagram extraction
- [x] **LLM Information**: Model and metadata extraction

### 2.4 Navigation System ✅
- [x] URL-based navigation with state persistence
- [x] Step-by-step navigation with Previous/Next controls
- [x] Multi-instance management with sidebar tabs
- [x] Instance loading workflow (load → tab creation → click to view)
- [x] Navigation state management and URL updates

## Phase 3: Visualization & Interactive Components (Next Phase 🔄)

### 3.1 Graph Visualization Implementation 🔄
**Current State**: All 5 content types display as **raw text**
**Target**: Transform into **interactive visualizations**

- [ ] **CPEE Tree Visualizer**: Interactive XML tree renderer with collapsible nodes
  - Input CPEE-Tree → Interactive tree view with syntax highlighting
  - Output CPEE-Tree → Interactive tree with diff highlighting vs input
  - Node expansion/collapse for complex trees
  - Search within XML structure

- [ ] **Mermaid Diagram Integration**: Live rendering of flowchart/sequence diagrams
  - Input Intermediate → Rendered Mermaid flowchart
  - Output Intermediate → Rendered Mermaid with change highlighting
  - Interactive diagram navigation (zoom, pan)
  - Node click details and properties

- [ ] **Process Flow Visualization**: Interactive process flow representation
  - Complete step timeline with visual progress
  - Step-to-step transformation visualization
  - Error indicators in flow diagram

- [ ] **Diff Visualization**: Visual comparison between input/output
  - Side-by-side XML tree comparison
  - Mermaid diagram diff highlighting
  - Change summary and statistics

### 3.2 Interactive Components 🔄
Replace current **raw text display** with **graphical representations**:

1. **Input CPEE-Tree Section**:
   - Current: Raw XML text
   - Target: Interactive collapsible tree view with syntax highlighting

2. **Input Intermediate Section**:
   - Current: Raw Mermaid syntax text
   - Target: Rendered interactive Mermaid diagram

3. **User Input Section**:
   - Current: Plain text
   - Target: Syntax-highlighted formatted display with intent parsing

4. **Output Intermediate Section**:
   - Current: Raw Mermaid syntax text
   - Target: Rendered Mermaid with change highlighting vs input

5. **Output CPEE-Tree Section**:
   - Current: Raw XML text
   - Target: Interactive tree with diff highlighting showing changes from input

### 3.3 Visualization Libraries Integration 🔄
- [ ] **Mermaid.js**: For flowchart/sequence diagram rendering
- [ ] **D3.js or similar**: For custom XML tree visualization
- [ ] **Monaco Editor**: For syntax highlighting of code sections
- [ ] **Diff libraries**: For visual change comparison
- [ ] **Pan/Zoom libraries**: For navigation within complex diagrams

### 3.4 Enhanced User Experience 🔄
- [ ] **Synchronized Views**: Link interactions between different visualizations
- [ ] **Export Visualizations**: Download diagrams as PNG/SVG
- [ ] **Full-Screen Mode**: Expand visualizations for detailed analysis
- [ ] **Search Within Visuals**: Find specific elements in diagrams
- [ ] **Visual Comparison Mode**: Side-by-side step comparison

## Phase 4: Error Detection and Analysis (Future 🔄)

### 4.1 Automated Error Detection 🔄
- [ ] **Error Pattern Recognition**: Automated error detection in step transitions
- [ ] **Error Categorization**: Classification of different error types
- [ ] **Visual Error Indicators**: Highlight problematic areas in visualizations
- [ ] **Error Impact Analysis**: Show downstream effects of errors
- [ ] **Suggestion System**: Provide fixing recommendations

### 4.2 Advanced Analytics 🔄
- [ ] **Success Rate Tracking**: Statistics across multiple instances
- [ ] **Performance Metrics**: LLM processing times and efficiency
- [ ] **Pattern Analysis**: Common user request patterns
- [ ] **Error Trends**: Identify recurring error patterns

## Phase 5: Performance & Polish (Future 🔄)

### 5.1 Performance Optimization 🔄
- [ ] **Lazy Loading**: Load step content and visualizations on demand
- [ ] **Caching Strategy**: Cache rendered visualizations in browser storage
- [ ] **Memory Management**: Efficient handling of complex visualizations
- [ ] **Progressive Rendering**: Show basic content while complex visuals load

### 5.2 User Experience Enhancements 🔄
- [ ] **Loading States**: Skeleton screens for visualization loading
- [ ] **Keyboard Shortcuts**: Navigate steps and interact with visuals
- [ ] **Mobile Optimization**: Touch-friendly visualization controls
- [ ] **Accessibility**: Screen reader support for visual content
- [ ] **Theme Customization**: Dark/light mode for all visualizations

## Implementation Priority

### 🔥 **High Priority (Next Phase)**
1. **Mermaid Integration**: Replace raw Mermaid text with rendered diagrams
2. **XML Tree Viewer**: Interactive CPEE tree visualization
3. **Basic Diff Highlighting**: Show changes between input/output

### 📊 **Medium Priority**
4. **Advanced Interactions**: Zoom, pan, search within visualizations
5. **Export Functionality**: Download visualizations and reports
6. **Error Detection**: Visual indicators for problematic steps

### 🎨 **Low Priority**
7. **Advanced Analytics**: Performance metrics and trend analysis
8. **Mobile Optimization**: Touch-friendly visualization controls
9. **Theme Customization**: Visual theme options

## Technical Achievements So Far

### ✅ **Architecture Accomplishments**
- **Modular Design**: Clean ES6 module structure with separation of concerns
- **State Management**: Proper URL synchronization and instance management
- **Error Handling**: Robust CORS proxy strategy with user fallbacks
- **Performance**: Efficient parsing for real-world CPEE logs

### ✅ **User Experience Accomplishments**  
- **Multi-Instance Support**: Load and switch between multiple CPEE instances
- **Intuitive Navigation**: Step-by-step browsing with visual feedback
- **Professional UI**: Clean, responsive design with proper styling
- **Real-World Ready**: Handles actual CPEE log files successfully

## Bachelor Thesis Integration

### 📚 **Academic Value**
- **Modern Architecture**: Demonstrates professional JavaScript development patterns
- **Research Component**: Analysis of LLM process modeling workflows
- **Technical Innovation**: Novel approach to debugging complex AI processes

### 🔬 **Research Opportunities**
- **Visualization Effectiveness**: Study of different visual representations for debugging
- **Error Pattern Analysis**: Research into common LLM modeling failures  
- **User Experience**: Evaluation of debugging workflow efficiency

### 💼 **Professional Quality**
- **Production Ready**: Deployable code suitable for real-world use
- **Maintainable**: Well-documented modular architecture
- **Scalable**: Designed to handle complex multi-step processes

---

## Next Steps Summary

1. **✅ Current**: Raw text display of all 5 content types working perfectly
2. **🎯 Next**: Implement Mermaid.js integration for diagram rendering
3. **📊 Future**: Add interactive XML tree visualization  
4. **🚀 Goal**: Transform from text-based to fully visual debugging experience

The foundation is solid and complete. The next phase focuses on transforming the raw text content into rich, interactive visualizations that will significantly enhance the debugging experience for CPEE users.