# CPEE LLM Error Debugging Console

A modern, modular web-based debugging console for the CPEE (Cloud Process Execution Engine) LLM service that provides detailed step-by-step analysis of the modeling process.

## 🎯 Purpose

This tool transforms the current "black box" LLM service in CPEE from simple "success/failure" feedback into a transparent, step-by-step debugging interface. It helps users understand exactly what happens during each LLM processing step and identify where errors occur.

## ✨ Key Features

- **🔍 Step-by-Step Analysis**: Break down LLM processing into 6 detailed components per modeling step
- **📡 Real-Time Log Parsing**: Fetch and parse logs directly from CPEE endpoints with robust CORS handling
- **🗂️ Multi-Instance Management**: Load and switch between multiple CPEE instances via sidebar tabs
- **🧭 Smart Navigation**: Previous/Next step navigation with URL state persistence
- **📋 Raw Log Viewer**: Toggle view of complete log content with fallback options
- **⚡ Modern Architecture**: Modular ES6 structure with clean separation of concerns
- **📱 Responsive Design**: Professional UI that works on desktop and mobile devices
- **🔗 URL-Based Navigation**: Direct links to specific instances and steps for easy sharing

## 📋 How It Works

The console analyzes CPEE log files (`.xes.yaml` format) that contain exposition events. Each modeling step consists of exactly 6 events grouped by `cpee:change_uuid`:

1. **Input CPEE-Tree**: Original XML process definition
2. **Used LLM**: Model identifier (e.g., "gemini-2.0-flash")  
3. **User Input**: The user's instruction (e.g., "add task A")
4. **Input Intermediate**: Current process as Mermaid diagram syntax
5. **Output Intermediate**: Modified Mermaid after LLM processing
6. **Output CPEE-Tree**: Final XML result after transformation

Steps are automatically sorted chronologically and displayed with complete content extraction.

## 🚀 Usage

### Getting Started
1. **Load Instance**: Enter a CPEE instance UUID and click "Load Instance"
2. **Select Instance**: Click on the instance tab in the left sidebar to view its content
3. **Navigate Steps**: Use Previous/Next buttons to move through chronological steps
4. **View Raw Logs**: Click "View Log" to see the complete YAML log file
5. **Multiple Instances**: Load multiple UUIDs and switch between them seamlessly

### Example UUID for Testing
```
6eaae411-7654-40dd-b0c9-154d7c508deb
```

### URL Navigation
Share specific instances and steps using URL parameters:
```
https://your-site.com/?uuid=6eaae411-7654-40dd-b0c9-154d7c508deb&step=1
```

## 🏗️ Architecture

### Modular ES6 Structure
The application uses a modern, modular architecture with clear separation of concerns:

- **Core Layer**: Application controller and coordination
- **Service Layer**: Business logic and data management  
- **Component Layer**: UI components with specific responsibilities
- **Parser Layer**: Data transformation and processing
- **Utility Layer**: Shared utilities and helpers

### Technical Stack
- **Frontend**: HTML5, CSS3, JavaScript ES6 Modules
- **Architecture**: Modular component-based design
- **Parsing**: Custom YAML parser for CPEE log format
- **State Management**: URL-synchronized application state
- **CORS Handling**: Multi-proxy strategy with fallback options
- **No Dependencies**: Pure JavaScript, no external frameworks

## 📁 Project Structure

```
cpee-log-error-console/
├── index.html                    # Main interface
├── src/                          # Source code (ES6 modules)
│   ├── core/
│   │   └── CPEEDebugConsole.js   # Main application controller
│   ├── services/
│   │   ├── LogService.js         # Log fetching and processing
│   │   └── InstanceService.js    # Instance data management
│   ├── components/
│   │   ├── Sidebar.js            # Instance tabs sidebar
│   │   ├── StepViewer.js         # Step content display
│   │   └── LogViewer.js          # Raw log viewer
│   ├── parsers/
│   │   └── YAMLParser.js         # YAML parsing logic
│   ├── utils/
│   │   ├── URLUtils.js           # URL parameter handling
│   │   └── DOMUtils.js           # DOM utilities
│   ├── assets/
│   │   └── style.css             # All styles
│   └── app.js                    # Application entry point
├── js_legacy/                    # Backup of old monolithic code
├── README.md                     # This file
├── README_ARCHITECTURE.md        # Detailed architecture documentation
└── roadmap.md                    # Project roadmap and future plans
```

### Log Data Source
- **Endpoint**: `https://cpee.org/logs/{uuid}.xes.yaml`
- **Format**: Multi-document YAML (events separated by `---`)
- **Key Events**: `cpee:lifecycle:transition: description/exposition`
- **Grouping**: Events grouped by `cpee:change_uuid` (representing modeling steps)
- **Ordering**: Steps sorted chronologically by timestamp

## 🔧 Development

### Prerequisites
- **Modern Browser**: ES6 modules support required
- **Local Server**: Required for ES6 module loading (CORS policy)
- **No Build Tools**: Pure JavaScript, no compilation needed

### Local Development Setup
1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/cpee-log-error-console.git
   cd cpee-log-error-console
   ```

2. **Start local server** (required for ES6 modules):
   ```bash
   # Python 3 (recommended)
   python -m http.server 8000
   
   # Node.js alternative
   npx serve .
   
   # PHP alternative  
   php -S localhost:8000
   ```

3. **Open in browser**:
   ```
   http://localhost:8000
   ```

### Browser Requirements
- **ES6 Modules**: Chrome 61+, Firefox 60+, Safari 10.1+, Edge 79+
- **ES6 Features**: Arrow functions, classes, destructuring, async/await
- **No IE Support**: Internet Explorer not supported

### Development Workflow
1. **Module Development**: Edit files in `src/` directory
2. **Hot Reload**: Refresh browser to see changes (no build step)
3. **Debugging**: Use browser dev tools with ES6 module debugging
4. **Testing**: Use example UUID `6eaae411-7654-40dd-b0c9-154d7c508deb`

### Adding New Features
1. Identify appropriate module layer (core/services/components/utils)
2. Create new module file in correct directory
3. Import and integrate in main controller
4. Update components as needed

See `README_ARCHITECTURE.md` for detailed development guidelines.

## 🎯 Current Status & Future Plans

### ✅ **Implemented Features**
- Complete modular architecture with ES6 modules
- Multi-instance management with sidebar navigation
- Step-by-step content extraction and display (raw text format)
- Robust YAML parsing for complex CPEE log structures  
- URL state management and deep linking
- Responsive design with professional styling
- Multi-proxy CORS handling with fallback options

### 🔄 **Planned Enhancements**
- **Interactive Visualizations**: Transform raw text into graphical representations
  - XML tree viewer for CPEE process definitions
  - Rendered Mermaid diagrams for process flows
  - Visual diff highlighting between input/output
- **Error Detection**: Automated analysis and visual indicators
- **Enhanced Navigation**: Search, filters, and advanced comparison tools
- **Performance Optimization**: Lazy loading and caching for large datasets

See `roadmap.md` for detailed future plans.

## ⚠️ Current Limitations

- **Content Display**: Currently shows raw text (visualizations planned for next phase)
- **CORS Dependencies**: Relies on proxy services for cross-origin requests
- **ES6 Requirement**: Requires modern browser with module support
- **Server Requirement**: Cannot run directly from file system (needs local server)

## 🎓 Academic Context

This project is developed as part of a **Bachelor's Thesis at TUM** (Technical University of Munich) focusing on:
- **Modern Web Architecture**: Demonstrating professional JavaScript development practices
- **LLM Process Analysis**: Novel approach to debugging AI-driven process modeling
- **User Experience Research**: Improving debugging workflows for complex systems

## 📚 Documentation

- **README_ARCHITECTURE.md**: Detailed technical architecture documentation
- **roadmap.md**: Project timeline and future enhancement plans
- **JSDoc Comments**: Inline code documentation throughout modules

## 🤝 Contributing

This is an academic project, but feedback and suggestions are welcome:
1. Check existing issues and documentation
2. Follow the modular architecture patterns
3. Ensure ES6 compatibility
4. Add appropriate documentation

## 📄 License

Developed for academic purposes. Please respect CPEE service terms when accessing log data.

---

## 🆘 Troubleshooting

### Common Issues

**"Module not found" errors**:
- Ensure you're running a local server (not opening file:// directly)
- Check that all files exist in the `src/` directory structure

**"CORS policy" errors**:
- This is expected - the app will try multiple proxy services automatically
- Use the manual log input fallback if all proxies fail

**"No steps found" message**:  
- Verify the UUID exists and has exposition events
- Check browser console for detailed parsing errors

**Need help?** Check the browser console for detailed error messages and ensure the CPEE instance UUID is valid and publicly accessible.
