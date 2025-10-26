# Scripts Directory

This directory contains utility scripts for the CPEE Log Error Console project.

## Available Scripts

### `generate-graph.js`

Generates a visual dependency graph from the `dependencies.json` file.

**Outputs:**
- `docs/architecture-graph.dot` - Graphviz DOT format file (can be rendered with Graphviz)
- `docs/architecture-graph.html` - Interactive HTML visualization using D3.js

**Usage:**
```bash
npm run arch:graph
```

Or to generate both the JSON and the graph in one go:
```bash
npm run arch:full
```

## Graph Formats

### DOT Format
The `.dot` file can be used with Graphviz to create static images:
```bash
# If Graphviz is installed
dot -Tsvg docs/architecture-graph.dot -o docs/architecture-graph.svg
dot -Tpng docs/architecture-graph.dot -o docs/architecture-graph.png
```

### HTML Interactive Viewer
The `.html` file provides an interactive, drag-and-drop graph visualization that runs in any modern browser. It includes:
- Force-directed layout with physics simulation
- Zoom and pan interactions
- Hover tooltips showing full module paths
- Color-coded groups by directory
- Click and drag to reposition nodes

Simply open `docs/architecture-graph.html` in your browser to explore the dependencies!

