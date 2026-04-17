/**
 * ExportSVGButton Component
 * Provides SVG export/download functionality for graph visualizations.
 *
 * Strategy: call getComputedStyle() on every element of the LIVE SVG before
 * cloning it.  This freezes the exact visual state the browser is currently
 * rendering — CSS variables are already resolved, inheritance is flattened,
 * and theme-specific colours are captured automatically.  No hand-crafted CSS
 * is embedded, so there is no risk of overriding inline attributes set by the
 * renderer (e.g. the namespaced marker-end URLs written by namespaceSVGIds).
 */

import { ICONS } from '../../assets/icons.js';

// SVG presentation properties worth freezing.
// display/visibility are included so hidden elements stay hidden in the export.
const FREEZE_PROPS = [
    'fill', 'fill-opacity', 'fill-rule',
    'stroke', 'stroke-width', 'stroke-opacity',
    'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
    'marker-end', 'marker-start', 'marker-mid',
    'opacity', 'display', 'visibility',
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
    'text-anchor', 'dominant-baseline', 'alignment-baseline',
    'paint-order',
];

export class ExportSVGButton {
    constructor(domRegistry = null, options = {}) {
        this.domRegistry = domRegistry;

        this.options = {
            showIcon: options.showIcon !== false,
            showText: options.showText !== false,
            successDuration: options.successDuration || 1000,
            onExportSuccess: options.onExportSuccess || null,
            onExportError: options.onExportError || null,
            ...options
        };

        this.element = null;
        this.originalContent = null;
        this.isExporting = false;
        this.graphContainer = null;
        this.filename = null;

        // Stable reference so removeEventListener actually works in destroy()
        this._onClick = () => this.exportSVG();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    createButton(graphContainer, filename, buttonText = 'Export SVG') {
        this.graphContainer = graphContainer;
        this.filename = filename;
        this.originalContent = buttonText;

        const button = document.createElement('button');
        button.className = 'export-svg-btn';
        button.type = 'button';
        button.title = 'Export SVG';

        const content = document.createElement('span');
        content.className = 'export-svg-btn-content';

        if (this.options.showIcon) {
            const iconWrapper = document.createElement('span');
            iconWrapper.className = 'export-svg-icon-wrapper';
            iconWrapper.innerHTML = ICONS.DOWNLOAD;
            content.appendChild(iconWrapper);
        }

        if (this.options.showText) {
            const text = document.createElement('span');
            text.className = 'export-svg-text';
            text.textContent = buttonText;
            content.appendChild(text);
        }

        button.appendChild(content);
        button.addEventListener('click', this._onClick);
        this.element = button;
        return button;
    }

    setGraphContainer(container) { this.graphContainer = container; }
    setFilename(filename)        { this.filename = filename; }

    setEnabled(enabled) {
        if (this.element) {
            this.element.disabled = !enabled;
            this.element.classList.toggle('disabled', !enabled);
        }
    }

    destroy() {
        if (this.element) {
            this.element.removeEventListener('click', this._onClick);
            this.element = null;
        }
        this.graphContainer = null;
        this.filename = null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core export
    // ─────────────────────────────────────────────────────────────────────────

    exportSVG() {
        if (this.isExporting || !this.graphContainer) return false;
        this.isExporting = true;

        try {
            const liveSvg = this.findGraphSVG();
            if (!liveSvg) throw new Error('No graph SVG found in container');

            const isCPEE   = this._isCPEESvg(liveSvg);
            const isMermaid = !isCPEE && this._isMermaidSvg(liveSvg);

            // ── 1. Read dimensions from the live element (before any mutation) ──
            const dims = this._getExportDimensions(liveSvg);

            // ── 2. Freeze computed styles from the live element tree ─────────
            //    We do this BEFORE cloning so getComputedStyle() has a real layout
            //    context.  The result is an array parallel to querySelectorAll('*').
            const frozenStyles = this._collectComputedStyles(liveSvg);

            // ── 3. Deep clone ────────────────────────────────────────────────
            const clone = liveSvg.cloneNode(true);

            // ── 4. Apply frozen styles onto clone ────────────────────────────
            this._applyFrozenStyles(clone, frozenStyles);

            // ── 5. Set mandatory SVG root attributes ─────────────────────────
            clone.setAttribute('xmlns',        'http://www.w3.org/2000/svg');
            clone.setAttribute('xmlns:xlink',  'http://www.w3.org/1999/xlink');
            clone.setAttribute('width',        String(dims.width));
            clone.setAttribute('height',       String(dims.height));
            clone.setAttribute('viewBox',      dims.viewBox);
            // Remove inline width/height that might conflict with the attributes
            clone.style.removeProperty('width');
            clone.style.removeProperty('height');

            // ── 6. Remove runtime-only elements ─────────────────────────────
            if (isCPEE)    this._cleanupCPEEElements(clone);

            // ── 7. Background rectangle (behind all content) ─────────────────
            this._ensureBackground(clone, dims);

            // ── 8. Minimal font hint (browser fonts not embedded in SVG) ─────
            this._embedFontHint(clone, isCPEE || isMermaid);

            // ── 9. Serialize ─────────────────────────────────────────────────
            const serializer = new XMLSerializer();
            const svgString  = '<?xml version="1.0" encoding="UTF-8"?>\n'
                             + serializer.serializeToString(clone);

            // ── 10. Trigger download ──────────────────────────────────────────
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url  = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href     = url;
            link.download = `${this.filename}.svg`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 200);

            this._showSuccess();
            if (this.options.onExportSuccess) this.options.onExportSuccess(this.filename, svgString);
            return true;

        } catch (err) {
            console.error('[ExportSVGButton] Export failed:', err);
            this._showError(err.message);
            if (this.options.onExportError) this.options.onExportError(err);
            return false;
        } finally {
            this.isExporting = false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Computed-style capture & application
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Walk the live SVG tree and collect the computed value of every property
     * in FREEZE_PROPS for each element.  Returns a parallel array.
     *
     * Must be called on the LIVE element (in the document) so that
     * getComputedStyle() has a valid layout context.
     */
    _collectComputedStyles(liveSvg) {
        const elements = [liveSvg, ...liveSvg.querySelectorAll('*')];
        return elements.map(el => {
            if (!(el instanceof Element)) return null;
            const cs = window.getComputedStyle(el);
            const props = {};
            for (const prop of FREEZE_PROPS) {
                const val = cs.getPropertyValue(prop);
                if (val !== null && val !== '') {
                    props[prop] = this._normalizeStyleValue(prop, val);
                }
            }
            return props;
        });
    }

    /**
     * Apply the parallel frozen-style array onto the cloned SVG tree.
     */
    _applyFrozenStyles(clonedSvg, frozenStyles) {
        const elements = [clonedSvg, ...clonedSvg.querySelectorAll('*')];
        for (let i = 0; i < Math.min(elements.length, frozenStyles.length); i++) {
            const frozen = frozenStyles[i];
            const el     = elements[i];
            if (!frozen || !(el instanceof Element)) continue;

            const decls = Object.entries(frozen)
                .map(([p, v]) => `${p}:${v}`)
                .join(';');

            if (decls) el.setAttribute('style', decls);
        }
    }

    /**
     * Normalise a raw computed style value for use in a standalone SVG.
     *
     * The main transformation needed: browsers return absolute URLs for
     * url() references, e.g.
     *   url("https://localhost/app/#input-cpee-1234-arrow")
     * We strip the origin+path so only the fragment remains:
     *   url(#input-cpee-1234-arrow)
     */
    _normalizeStyleValue(prop, value) {
        if (value.includes('url(')) {
            // Match url("https://...#fragment") or url(https://...#fragment)
            return value.replace(
                /url\(\s*["']?[^"')]*#([^"')]+)["']?\s*\)/g,
                'url(#$1)'
            );
        }
        return value;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SVG location
    // ─────────────────────────────────────────────────────────────────────────

    findGraphSVG() {
        if (!this.graphContainer) return null;

        // CPEE graphs: CPEEWfAdaptorRenderer always assigns id="graphcanvas-<id>"
        const cpeeSvg = this.graphContainer.querySelector('svg[id^="graphcanvas-"]');
        if (cpeeSvg) return cpeeSvg;

        // Mermaid graphs: rendered with data-processed or inside .mermaid
        const mermaidSvg = this.graphContainer.querySelector('svg[data-processed]')
                        || this.graphContainer.querySelector('.mermaid svg')
                        || this.graphContainer.querySelector('svg.mermaid');
        if (mermaidSvg) return mermaidSvg;

        // Generic fallback: largest rendered SVG, excluding tiny icons
        let best = null, bestArea = 0;
        for (const svg of this.graphContainer.querySelectorAll('svg')) {
            const r = svg.getBoundingClientRect();
            const a = r.width * r.height;
            if (r.width > 50 && r.height > 50 && a > bestArea) { bestArea = a; best = svg; }
        }
        return best || this.graphContainer.querySelector('svg');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dimensions
    // ─────────────────────────────────────────────────────────────────────────

    _getExportDimensions(svgElement) {
        // 1. Explicit viewBox already set on the element
        const vb = svgElement.getAttribute('viewBox');
        if (vb) {
            const parts = vb.trim().split(/[\s,]+/).map(Number);
            if (parts.length === 4 && parts.every(n => !isNaN(n)) && parts[2] > 0 && parts[3] > 0) {
                return { width: parts[2], height: parts[3], viewBox: vb };
            }
        }

        // 2. getBBox() gives the tight bounding box of the drawn content
        try {
            const bbox = svgElement.getBBox();
            if (bbox && bbox.width > 0 && bbox.height > 0) {
                const pad = 12;
                const x = bbox.x - pad, y = bbox.y - pad;
                const w = bbox.width + pad * 2, h = bbox.height + pad * 2;
                return { width: w, height: h, viewBox: `${x} ${y} ${w} ${h}` };
            }
        } catch (_) { /* not in layout */ }

        // 3. Rendered bounding rect
        const r = svgElement.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
            return { width: r.width, height: r.height, viewBox: `0 0 ${r.width} ${r.height}` };
        }

        // 4. Fallback
        const w = parseFloat(svgElement.getAttribute('width'))  || 800;
        const h = parseFloat(svgElement.getAttribute('height')) || 600;
        return { width: w, height: h, viewBox: `0 0 ${w} ${h}` };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Detection
    // ─────────────────────────────────────────────────────────────────────────

    _isCPEESvg(svg) {
        return (svg.id && svg.id.startsWith('graphcanvas-'))
            || svg.querySelector('.colorstyle, .stand, .execstyle') !== null;
    }

    _isMermaidSvg(svg) {
        return svg.hasAttribute('data-processed')
            || svg.classList.contains('mermaid')
            || svg.querySelector('.node, .edgePath, .flowchart-link') !== null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Post-clone processing
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Add a filled background rectangle as the very first child of the SVG,
     * sized to match the viewBox.  Uses the current --surface-color token.
     */
    _ensureBackground(clonedSvg, dims) {
        const bg = getComputedStyle(document.documentElement)
            .getPropertyValue('--surface-color').trim() || '#ffffff';

        const [x, y, w, h] = dims.viewBox.trim().split(/[\s,]+/).map(Number);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x',      x);
        rect.setAttribute('y',      y);
        rect.setAttribute('width',  w);
        rect.setAttribute('height', h);
        rect.setAttribute('fill',   bg);
        rect.setAttribute('style',  `fill:${bg};stroke:none;`);

        clonedSvg.insertBefore(rect, clonedSvg.firstChild);
    }

    /**
     * Remove runtime-only CPEE elements that have no meaning in a static export.
     */
    _cleanupCPEEElements(svgClone) {
        for (const sel of [
            'rect.tile', '.tile',
            'text.super', 'text.duration',
            '.hoverstyle', '.markstyle'
        ]) {
            svgClone.querySelectorAll(sel).forEach(el => el.remove());
        }
    }

    /**
     * Embed a minimal <style> block that declares the font stack used in the
     * app.  This cannot be captured by getComputedStyle (font files are not
     * embedded), but it ensures the correct font *name* is in the file so
     * viewers that have the font installed will use it.
     */
    _embedFontHint(clonedSvg, hasText) {
        if (!hasText) return;
        const font = "'Adwaita Sans', 'Segoe UI', system-ui, sans-serif";

        let defs = clonedSvg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            clonedSvg.insertBefore(defs, clonedSvg.firstChild);
        }
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.setAttribute('type', 'text/css');
        style.textContent = `text, tspan { font-family: ${font}; }`;
        defs.insertBefore(style, defs.firstChild);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UI feedback
    // ─────────────────────────────────────────────────────────────────────────

    _showSuccess() {
        if (!this.element) return;
        this.element.classList.add('export-svg-success');
        const icon = this.element.querySelector('.export-svg-icon-wrapper');
        const text = this.element.querySelector('.export-svg-text');
        if (icon) icon.innerHTML = ICONS.CHECK;
        if (text) text.textContent = 'Exported';

        setTimeout(() => {
            if (!this.element) return;
            this.element.classList.remove('export-svg-success');
            if (icon) icon.innerHTML = ICONS.DOWNLOAD;
            if (text) text.textContent = this.originalContent;
        }, this.options.successDuration);
    }

    _showError(message = 'Export failed') {
        if (!this.element) return;
        console.error('[ExportSVGButton]', message);
        this.element.classList.add('export-svg-error');
        const text = this.element.querySelector('.export-svg-text');
        if (text) { text.textContent = '✗ Failed'; text.title = message; }

        setTimeout(() => {
            if (!this.element) return;
            this.element.classList.remove('export-svg-error');
            if (text) { text.textContent = this.originalContent; text.title = ''; }
        }, this.options.successDuration);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Static helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate a download filename (without extension).
     * Format: <processNumber>_Step<stepNumber>_<Cpee|Mermaid>_<I|O>
     */
    static generateFilename(instanceNumber, stepNumber, sectionId) {
        const io   = sectionId.startsWith('output') ? 'O' : 'I';
        const type = sectionId.includes('cpee') ? 'Cpee' : 'Mermaid';
        return `${instanceNumber}_Step${stepNumber}_${type}_${io}`;
    }
}
