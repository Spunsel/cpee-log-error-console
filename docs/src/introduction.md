# CPEE Log Error Console

A modern, modular web-based debugging console for the CPEE LLM service.

## Overview

The CPEE Log Error Console is a debugging interface designed to help developers understand and debug LLM-generated CPEE process modifications. It provides visual graph analysis, step-by-step tracking, and cross-sectional task highlighting.

## Features

### Visual Workflow Analysis

- **CPEE Graphs**: Native CPEE WfAdaptor integration for authentic process visualization
- **Mermaid Diagrams**: Rendering of intermediate graph format
- **Multi-Instance Support**: Debug multiple CPEE processes simultaneously

### Step-by-Step Debugging

- **Process Navigation**: Navigate through execution steps with intuitive controls
- **Content Sections**: Organized display of input SVGs, intermediate states, user inputs, and output SVGs
- **Cross-Sectional Highlighting**: Click any task in any view to see it highlighted across all representations

## Quick Start

### Setup

```bash
# Clone the repository
git clone https://github.com/Spunsel/cpee-log-error-console.git
cd cpee-log-error-console

# Start local server (required for ES6 modules)
python -m http.server 8000

# Open in browser
open http://localhost:8000
```

### Usage

1. **Load Process**: Enter a CPEE process number to fetch UUID and load the process
2. **Navigate Steps**: Use next/previous buttons to explore user LLM modifications
3. **View Graphs**: Automatic rendering of CPEE trees and Mermaid diagrams
4. **Debug Issues**: Examine intermediate states and error messages
5. **Cross-Highlight**: Click tasks in any graph to see them highlighted across all views

## Repository

🔗 [GitHub Repository](https://github.com/Spunsel/cpee-log-error-console)

## License

This project is part of a Bachelor's thesis at TUM (Technical University of Munich).

