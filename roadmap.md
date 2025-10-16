# CPEE LLM Error Debugging Console - Bachelor Thesis Project Roadmap

## Project Overview
Create a web-based error debugging console for the CPEE (Cloud Process Execution Engine) LLM service that provides detailed step-by-step analysis of the modeling process instead of just "success/failure" feedback.

## Technical Requirements
- Frontend only: HTML, CSS, JavaScript
- Input: CPEE instance UUID + step number
- Data source: CPEE log files (.xes.yaml format) via https://cpee.org/logs/{uuid}.xes.yaml
- Output: Detailed breakdown of LLM processing steps
- Deployment: GitHub Pages

## Key Log Structure Insights
Based on analysis of the example log (https://cpee.org/logs/6eaae411-7654-40dd-b0c9-154d7c508deb.xes.yaml):

### Event Structure
- Each event separated by `---` in YAML format
- Key field: `cpee:lifecycle:transition: description/exposition` for LLM steps
- Events grouped by `cpee:change_uuid` (each UUID = one modeling step)
- Each step contains exactly 6 exposition events in this order:
  1. **Input CPEE-Tree**: Original XML process definition
  2. **Used LLM**: Model identifier (e.g., "gemini-2.0-flash")
  3. **User Input**: The user's instruction (e.g., "add task A")
  4. **Input Intermediate**: Current process as Mermaid diagram
  5. **Output Intermediate**: Modified Mermaid after LLM processing
  6. **Output CPEE-Tree**: Final XML result

### Error Patterns to Detect
- Malformed Mermaid syntax in Input/Output Intermediate
- Missing exposition events (incomplete steps)
- XML parsing errors in CPEE-Tree sections
- LLM model timeouts or failures
- User input ambiguity issues

## ACCELERATED IMPLEMENTATION PLAN

## Phase 1: MVP Setup & Core Parsing (Week 1-2)

### 1.1 Project Structure Setup (Day 1)
- [ ] Initialize Git repository and create basic structure:
  ```
  cpee-log-error-console/
  ├── index.html          # Main interface
  ├── css/
  │   └── style.css       # All styles
  ├── js/
  │   ├── main.js         # App initialization & URL handling
  │   ├── logParser.js    # YAML parsing & event extraction
  │   ├── stepAnalyzer.js # Step analysis & error detection
  │   └── ui.js           # UI rendering & interactions
  └── README.md
  ```

### 1.2 Core Log Parser Implementation (Days 2-3)
**Priority: HIGH - This is the foundation**
- [ ] Implement YAML parsing for multi-document format (events separated by `---`)
- [ ] Extract events with `cpee:lifecycle:transition: description/exposition`
- [ ] Group events by `cpee:change_uuid` 
- [ ] Parse the 6 exposition event types:
  ```javascript
  // Expected event order per step:
  1. "<!-- Input CPEE-Tree -->" (XML)
  2. "# Used LLM:" (model name)
  3. "# User Input:" (instruction)
  4. "%% Input Intermediate" (Mermaid)
  5. "%% Output Intermediate" (Mermaid)
  6. "<!-- Output CPEE-Tree -->" (XML)
  ```

### 1.3 URL Parameter & Log Fetching (Day 4)
- [ ] Parse URL parameters: `?uuid={uuid}&step={step_number}`
- [ ] Fetch logs from `https://cpee.org/logs/{uuid}.xes.yaml`
- [ ] Handle CORS issues (proxy or error handling)
- [ ] Validate UUID format and log availability

## Phase 2: MVP User Interface (Days 5-7)

### 2.1 Basic HTML Structure (Day 5)
- [ ] Create main layout with sections:
  ```html
  - Header: Instance UUID display, step navigation
  - Sidebar: Step overview/timeline  
  - Main: Detailed step analysis
  - Footer: Error summary
  ```
- [ ] Responsive CSS grid layout
- [ ] Basic styling and typography

### 2.2 Step Display Interface (Day 6)
- [ ] Step navigation (Previous/Next buttons)
- [ ] Step overview cards showing:
  - Step number, timestamp, user input
  - Success/error status indicator
- [ ] Detailed step breakdown with tabs:
  - **Overview**: User input + LLM model
  - **Input**: Current CPEE tree + Mermaid
  - **Output**: Modified Mermaid + final CPEE tree
  - **Diff**: Visual comparison

### 2.3 Error Detection UI (Day 7)
- [ ] Error highlighting in code blocks
- [ ] Error badges and indicators
- [ ] Basic error categorization display

## Phase 3: Enhanced Features & Testing (Days 8-14)

### 3.1 Mermaid Visualization (Days 8-9)
- [ ] Integrate Mermaid.js for diagram rendering
- [ ] Display Input/Output Intermediate diagrams
- [ ] Highlight differences between diagrams
- [ ] Add zoom/pan functionality for complex diagrams

### 3.2 Advanced Error Detection (Days 10-11)
- [ ] Implement specific error patterns:
  ```javascript
  // Error types to detect:
  - Missing exposition events (< 6 events per step)
  - Malformed Mermaid syntax
  - XML parsing errors in CPEE trees
  - Empty or null exposition content
  - Timestamp sequence issues
  ```
- [ ] Error severity classification (Critical/Warning/Info)
- [ ] Suggested fixes for common errors

### 3.3 Performance & UX Improvements (Days 12-13)
- [ ] Lazy loading for large log files
- [ ] Search and filter functionality
- [ ] Export step data as JSON/CSV
- [ ] Keyboard navigation shortcuts

### 3.4 Testing & Bug Fixes (Day 14)
- [ ] Test with multiple CPEE instances
- [ ] Cross-browser compatibility testing
- [ ] Mobile responsiveness testing
- [ ] Error handling for edge cases

## Phase 4: Documentation & Deployment (Days 15-21)

### 4.1 GitHub Setup & Deployment (Days 15-16)
- [ ] Create GitHub repository with proper structure
- [ ] Set up GitHub Pages for hosting
- [ ] Configure custom domain if needed
- [ ] Set up automated deployment from main branch

### 4.2 Documentation (Days 17-18)
- [ ] Create comprehensive README with:
  - Project description and features
  - Usage instructions with examples
  - URL parameter format documentation
  - Known limitations and troubleshooting
- [ ] Add inline code comments and JSDoc
- [ ] Create user guide with screenshots

### 4.3 Final Testing & Polish (Days 19-20)
- [ ] End-to-end testing with real CPEE instances
- [ ] Performance optimization for large logs
- [ ] UI/UX improvements based on testing
- [ ] Accessibility compliance (WCAG basics)

### 4.4 Thesis Preparation (Day 21)
- [ ] Prepare demonstration materials
- [ ] Document technical decisions and challenges
- [ ] Create presentation slides
- [ ] Finalize project deliverables

## Implementation Priority & MVP Features

### Must-Have (Week 1)
1. **Log fetching and parsing** - Core functionality
2. **Basic step navigation** - Essential user interaction  
3. **Step data display** - Show the 6 exposition events clearly
4. **Basic error detection** - Missing events, malformed content

### Should-Have (Week 2)  
5. **Mermaid diagram rendering** - Visual process comparison
6. **Advanced error patterns** - Specific error categorization
7. **Clean, responsive UI** - Professional appearance

### Nice-to-Have (Week 3)
8. **Export functionality** - Data export capabilities
9. **Performance optimizations** - Handle large logs smoothly
10. **Advanced navigation** - Search, filters, keyboard shortcuts

## Technical Implementation Details

### URL Format
```
https://your-github-pages-site.com/?uuid=6eaae411-7654-40dd-b0c9-154d7c508deb&step=1
```

### Log Fetching Strategy
```javascript
// Fetch log from CPEE endpoint
const logUrl = `https://cpee.org/logs/${uuid}.xes.yaml`;
const response = await fetch(logUrl);
const yamlContent = await response.text();
```

### Event Parsing Pattern
```javascript
// Each step group identified by cpee:change_uuid
// Extract 6 exposition events per step:
const stepEvents = events.filter(e => 
  e['cpee:change_uuid'] === stepUuid &&
  e['cpee:lifecycle:transition'] === 'description/exposition'
);
```

### Error Detection Patterns
```javascript
// Common error patterns to implement:
1. Incomplete steps (< 6 exposition events)
2. Malformed Mermaid syntax validation
3. Empty or null cpee:exposition content
4. XML parsing errors in CPEE trees
5. Timestamp sequence anomalies
```

## Success Criteria for MVP (Week 1)

✅ **Core Functionality**
- [ ] Parse YAML logs and extract steps correctly
- [ ] Display all 6 exposition events per step
- [ ] Navigate between steps with URL parameters
- [ ] Show basic error detection (missing events)

✅ **User Experience** 
- [ ] Clear, intuitive interface
- [ ] Responsive design for desktop/mobile
- [ ] Fast loading even with large logs
- [ ] Proper error messages for invalid UUIDs

## Quick Start Commands

```bash
# Initialize repository
git init cpee-log-error-console
cd cpee-log-error-console

# Create basic structure
mkdir css js
touch index.html css/style.css js/main.js js/logParser.js js/stepAnalyzer.js js/ui.js

# Set up GitHub repository
git remote add origin https://github.com/yourusername/cpee-log-error-console.git
git branch -M main
git push -u origin main

# Enable GitHub Pages in repository settings
```

## Development Tips

1. **Start Simple**: Begin with hardcoded example UUID to test parsing
2. **Test Early**: Use the provided example log for initial development  
3. **Iterate Fast**: Get basic functionality working before adding features
4. **Handle CORS**: Be prepared to implement workarounds for cross-origin requests
5. **Mobile First**: Design for mobile devices from the beginning

---

**This accelerated roadmap focuses on rapid MVP development while maintaining academic rigor for your bachelor thesis. The 3-week timeline is aggressive but achievable with focused daily progress.**
