# CPEE Log Error Console

A sophisticated debugging interface for CPEE (Cloud Process Execution Engine) that provides visual workflow analysis, step-by-step execution tracking, and intelligent graph rendering.

## 🚀 Features

### 📊 **Visual Workflow Analysis**
- **Authentic CPEE Graphs**: Native CPEE WfAdaptor integration for accurate process visualization
- **Mermaid Diagrams**: Interactive flowchart rendering for intermediate workflow states
- **Multi-Instance Support**: Debug multiple CPEE processes simultaneously
- **Responsive Design**: Horizontal scrolling and adaptive layouts for complex workflows

### 🔍 **Step-by-Step Debugging**
- **Process Navigation**: Navigate through execution steps with next/previous controls
- **Content Sections**: Organized display of input trees, intermediate states, user inputs, and output trees
- **Real-time Rendering**: Dynamic graph generation from CPEE XML and Mermaid syntax
- **Error Handling**: Graceful fallbacks with detailed error messages and raw content display

### 🎨 **Modern Interface**
- **Clean Design**: Minimalist interface focused on workflow visualization
- **Loading States**: Visual feedback during graph rendering and data processing
- **Custom Styling**: Consistent white backgrounds and black borders for all graph elements
- **URL Routing**: Direct linking to specific instances and steps

## 🏗️ Architecture

### **Project Structure**
```
src/
├── core/                 # Core application logic
│   └── CPEEDebugConsole.js
├── modules/              # Business logic classes
│   ├── CPEEStep.js      
│   └── CPEEInstance.js  
├── services/             # Data management services
│   ├── LogService.js    
│   ├── InstanceService.js
│   └── CPEEService.js   
├── components/           # UI components and renderers
│   ├── Sidebar.js       
│   ├── StepViewer.js    
│   ├── CPEEWfAdaptorRenderer.js
│   └── MermaidRenderer.js
├── parsers/              # Data parsing utilities
│   └── YAMLParser.js    
├── utils/                # Helper utilities
│   └── DOMUtils.js      
└── assets/               # Styles and static resources
    └── style.css        
```

### **Key Components**

#### **CPEEStep & CPEEInstance** (`/modules/`)
Object-oriented representation of CPEE processes with navigation, content management, and step tracking capabilities.

#### **Graph Renderers** (`/components/`)
- **CPEEWfAdaptorRenderer**: Authentic CPEE graph visualization using the official WfAdaptor library
- **MermaidRenderer**: Mermaid.js integration for flowchart diagrams with custom theming

#### **Service Layer** (`/services/`)
- **LogService**: YAML/text log parsing and step extraction
- **InstanceService**: Multi-instance management and navigation
- **CPEEService**: CPEE server communication utilities

## 🚀 Quick Start

### **1. Setup**
```bash
# Clone the repository
git clone <repository-url>
cd cpee-log-error-console

**Start local server** (required for ES6 modules)
run: python -m http.server 8000
# Open in browser
open index.html
```

### **2. Usage**
1. **Load Process**: Enter CPEE process number or paste log data
2. **Navigate Steps**: Use next/previous buttons to explore execution
3. **View Graphs**: Automatic rendering of CPEE trees and Mermaid diagrams
4. **Debug Issues**: Examine intermediate states and error messages

### **3. Testing**
- **CPEE Graphs**: Open `test_cpee_graph_from_xml.html` to test CPEE visualization
- **Mermaid Graphs**: Open `test_mermaid_graph_from_raw.html` to test Mermaid rendering

## 🔧 Configuration

### **Graph Rendering Options**
Customize graph appearance in `MermaidRenderer.js`:
```javascript
// Font and spacing
fontSize: 11,
flowchart: {
    padding: 15,
    nodeSpacing: 25,
    rankSpacing: 35
}

// Colors and theme
themeVariables: {
    primaryColor: '#ffffff',      // Node backgrounds
    primaryBorderColor: '#000000', // Node borders
    // ... additional styling options
}
```

### **CPEE Integration**
Configure CPEE server connection in `CPEEService.js`:
```javascript
// Server settings
const CPEE_BASE_URL = 'your-cpee-server-url';
const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    // ... authentication headers
};
```

## 📝 Data Formats

### **Supported Log Formats**
- **YAML**: Structured CPEE execution logs
- **Plain Text**: Simple step-by-step process logs
- **XML**: Direct CPEE process definitions

### **Graph Types**
- **CPEE Trees**: Native CPEE workflow visualization
- **Mermaid Flowcharts**: Intermediate state diagrams
- **Custom Formats**: Extensible parser system

## 🧪 Development

### **Running Tests**
```bash
# Test CPEE graph rendering
open test_cpee_graph_from_xml.html

# Test Mermaid graph rendering  
open test_mermaid_graph_from_raw.html

# View in development
open index.html
```

### **Adding Features**
1. **New Renderers**: Extend `components/` with additional graph types
2. **Data Parsers**: Add parsers in `parsers/` for new log formats
3. **UI Components**: Create reusable components in `components/`

### **Debugging**
- Open browser DevTools for console logs and network requests
- Use `?uuid=<process-id>&step=<step-number>` URL parameters for direct navigation
- Check graph container elements for rendering issues

## 🤝 Contributing

### **Code Style**
- Use modern ES6+ JavaScript features
- Follow existing naming conventions
- Add JSDoc comments for public methods
- Test changes with provided test files

### **Pull Requests**
1. Fork the repository
2. Create feature branch
3. Test thoroughly with sample data
4. Submit PR with clear description

## 📄 License

This project is part of a Bachelor's thesis at TUM (Technical University of Munich).

## 🔗 Dependencies

- **Mermaid.js**: Diagram and flowchart rendering
- **CPEE WfAdaptor**: Authentic CPEE graph visualization  
- **jQuery**: DOM manipulation and utilities
- **Bootstrap**: UI styling and components
