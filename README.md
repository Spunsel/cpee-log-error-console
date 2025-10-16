# CPEE LLM Error Debugging Console

A web-based debugging console for the CPEE (Cloud Process Execution Engine) LLM service that provides detailed step-by-step analysis of the modeling process.

## 🎯 Purpose

This tool transforms the current "black box" LLM service in CPEE that only returns "success/failure" into a transparent, step-by-step debugging interface. It helps users understand exactly what happens during each LLM processing step and identify where errors occur.

## 🚀 Features

- **Step-by-Step Analysis**: Break down LLM processing into 6 detailed steps per modification
- **Real-Time Log Parsing**: Fetch and parse logs directly from CPEE endpoints
- **Error Detection**: Identify common issues like malformed Mermaid syntax, missing events, XML errors
- **Visual Process Comparison**: Compare before/after process states
- **URL-Based Navigation**: Direct links to specific instances and steps
- **Responsive Design**: Works on desktop and mobile devices

## 📋 How It Works

The console analyzes CPEE log files that contain exposition events. Each modeling step consists of exactly 6 events:

1. **Input CPEE-Tree**: Original XML process definition
2. **Used LLM**: Model identifier (e.g., "gemini-2.0-flash")  
3. **User Input**: The user's instruction (e.g., "add task A")
4. **Input Intermediate**: Current process as Mermaid diagram
5. **Output Intermediate**: Modified Mermaid after LLM processing
6. **Output CPEE-Tree**: Final XML result

## 🔗 Usage

### Direct Link Access
```
https://your-console-url.com/?uuid=6eaae411-7654-40dd-b0c9-154d7c508deb&step=1
```

### Manual Input
1. Open the console in your browser
2. Enter a CPEE instance UUID
3. Navigate through steps using Previous/Next buttons
4. Analyze each step using the tabbed interface

## 🛠 Technical Details

### Log Data Source
- Fetches logs from: `https://cpee.org/logs/{uuid}.xes.yaml`
- Parses YAML multi-document format (events separated by `---`)
- Extracts events with `cpee:lifecycle:transition: description/exposition`

### Error Detection
- Missing exposition events (< 6 events per step)
- Malformed Mermaid syntax validation  
- XML parsing errors in CPEE trees
- Empty or null exposition content
- Timestamp sequence anomalies

### Browser Support
- Modern browsers with ES6+ support
- Responsive design for mobile devices
- No backend dependencies (client-side only)

## 📁 Project Structure

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

## 🔧 Development

### Prerequisites
- No build tools required
- Works with any web server or GitHub Pages

### Local Development
1. Clone this repository
2. Serve files using any web server:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js
   npx serve .
   
   # PHP
   php -S localhost:8000
   ```
3. Open `http://localhost:8000` in your browser

### Testing with Example Data
Use the example UUID for testing: `6eaae411-7654-40dd-b0c9-154d7c508deb`

## ⚠ Known Limitations

- **CORS Restrictions**: May not work in all browsers due to cross-origin policy
- **Log Availability**: Requires public access to CPEE log endpoints  
- **Mermaid Rendering**: Visual diagram rendering planned for future version
- **Large Files**: Performance may degrade with very large log files

## 🎓 Academic Context

This project was developed as part of a Bachelor's Thesis at TUM (Technical University of Munich) to improve the debugging capabilities of the CPEE LLM service.

## 📄 License

This project is developed for academic purposes. Please respect the CPEE service terms of use when accessing log data.

---

**Need help?** Check the browser console for detailed error messages and ensure the CPEE instance UUID is valid and publicly accessible.
