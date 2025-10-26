#!/usr/bin/env node
/**
 * Generate a visual graph from dependencies.json
 * Outputs both a .dot file (for Graphviz) and an interactive HTML viewer
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Read dependencies
const depsPath = path.join(projectRoot, 'docs', 'dependencies.json');
const dependencies = JSON.parse(fs.readFileSync(depsPath, 'utf-8'));

// Generate DOT format
function generateDOT(deps) {
    const nodes = Object.keys(deps);
    const edges = [];
    
    // Extract edges
    for (const [source, targets] of Object.entries(deps)) {
        if (targets && targets.length > 0) {
            for (const target of targets) {
                edges.push([source, target]);
            }
        }
    }
    
    // Generate DOT syntax
    let dot = 'digraph Dependencies {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box, style=rounded];\n';
    dot += '  edge [arrowsize=0.8];\n\n';
    
    // Add nodes grouped by directories
    const groups = {};
    for (const node of nodes) {
        const parts = node.split('/');
        if (parts.length > 1) {
            const group = parts[0];
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(node);
        } else {
            if (!groups['root']) {
                groups['root'] = [];
            }
            groups['root'].push(node);
        }
    }
    
    // Create subgraph clusters
    for (const [group, groupNodes] of Object.entries(groups)) {
        dot += `  subgraph cluster_${group} {\n`;
        dot += `    label="${group}";\n`;
        dot += `    style=filled;\n`;
        dot += `    fillcolor=lightgrey;\n`;
        for (const node of groupNodes) {
            const label = node.split('/').pop().replace('.js', '');
            dot += `    "${node}" [label="${label}"];\n`;
        }
        dot += `  }\n\n`;
    }
    
    // Add edges
    dot += '\n  // Dependencies\n';
    for (const [source, target] of edges) {
        dot += `  "${source}" -> "${target}";\n`;
    }
    
    dot += '}\n';
    return dot;
}

// Generate HTML viewer with interactive d3 visualization
function generateHTMLViewer(deps) {
    const nodes = Object.keys(deps);
    const edges = [];
    
    // Prepare data for visualization
    const nodeMap = {};
    nodes.forEach((node, i) => {
        const parts = node.split('/');
        const group = parts.length > 1 ? parts[0] : 'root';
        const name = node.split('/').pop().replace('.js', '');
        nodeMap[node] = {
            id: i,
            name: name,
            fullPath: node,
            group: group
        };
    });
    
    for (const [source, targets] of Object.entries(deps)) {
        if (targets && targets.length > 0) {
            for (const target of targets) {
                if (nodeMap[source] && nodeMap[target]) {
                    edges.push({
                        source: nodeMap[source].id,
                        target: nodeMap[target].id
                    });
                }
            }
        }
    }
    
    const nodesData = Object.values(nodeMap);
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dependency Graph - CPEE Log Error Console</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
        }
        .header {
            background: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            margin: 0;
            color: #333;
            font-size: 24px;
        }
        .stats {
            margin-top: 10px;
            color: #666;
            font-size: 14px;
        }
        #graph {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .node {
            cursor: pointer;
        }
        .node:hover {
            stroke: #000;
            stroke-width: 3px;
        }
        .node circle {
            fill: #4CAF50;
            stroke: #fff;
            stroke-width: 2px;
        }
        .link {
            fill: none;
            stroke: #999;
            stroke-opacity: 0.6;
            stroke-width: 1.5px;
        }
        .link:hover {
            stroke: #333;
            stroke-width: 2px;
        }
        .tooltip {
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .legend {
            background: white;
            padding: 15px;
            margin: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .legend-item {
            display: inline-block;
            margin: 5px 10px;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Dependency Graph - CPEE Log Error Console</h1>
        <div class="stats">
            📦 ${nodesData.length} modules | 🔗 ${edges.length} dependencies
        </div>
    </div>
    
    <svg id="graph" width="100%" height="800"></svg>
    
    <script>
        const data = {
            nodes: ${JSON.stringify(nodesData)},
            links: ${JSON.stringify(edges)}
        };
        
        const svg = d3.select("#graph");
        const width = svg.node().getBoundingClientRect().width;
        const height = 800;
        
        svg.attr("width", width).attr("height", height);
        
        // Create simulation
        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(30));
        
        // Create tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip");
        
        // Add arrows
        svg.append("defs").selectAll("marker")
            .data(["end"])
            .enter().append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 25)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#999");
        
        // Create links
        const link = svg.append("g")
            .selectAll("line")
            .data(data.links)
            .enter().append("line")
            .attr("class", "link")
            .attr("marker-end", "url(#arrowhead)")
            .on("mouseover", function(event, d) {
                const sourceName = data.nodes[d.source].fullPath;
                const targetName = data.nodes[d.target].fullPath;
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);
                tooltip.html(
                    "<div><strong>From:</strong> " + sourceName + "</div>" +
                    "<div><strong>To:</strong> " + targetName + "</div>"
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
        
        // Create nodes
        const node = svg.append("g")
            .selectAll("g")
            .data(data.nodes)
            .enter().append("g")
            .attr("class", "node")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));
        
        node.append("circle")
            .attr("r", 10);
        
        node.append("text")
            .text(d => d.name)
            .attr("x", 15)
            .attr("y", 4)
            .attr("font-size", "12px")
            .attr("fill", "#333");
        
        // Add interaction
        node.on("mouseover", function(event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);
            tooltip.html(
                "<div><strong>" + d.name + "</strong></div>" +
                "<div>" + d.fullPath + "</div>" +
                "<div style='margin-top: 5px; color: #999;'>Group: " + d.group + "</div>"
            )
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
            d3.select(this).select("circle")
                .attr("r", 15);
        })
        .on("mouseout", function(event, d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
            d3.select(this).select("circle")
                .attr("r", 10);
        });
        
        // Update positions
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            
            node.attr("transform", d => "translate(" + d.x + "," + d.y + ")");
        });
        
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
    </script>
</body>
</html>`;
    
    return html;
}

// Generate outputs
const dotContent = generateDOT(dependencies);
const htmlContent = generateHTMLViewer(dependencies);

// Write files
fs.writeFileSync(path.join(projectRoot, 'docs', 'architecture-graph.dot'), dotContent);
fs.writeFileSync(path.join(projectRoot, 'docs', 'architecture-graph.html'), htmlContent);

console.log('✅ Generated graph files:');
console.log('   📄 docs/architecture-graph.dot');
console.log('   🌐 docs/architecture-graph.html');
console.log('\n💡 Open docs/architecture-graph.html in your browser to view the interactive graph!');

