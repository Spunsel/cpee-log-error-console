/**
 * DemoTour — Interactive guided tour of the CPEE LLM Debugging Console.
 *
 * Step types:
 *   regular       — spotlight + popover with Next button
 *   userClick     — overlay passthrough; user clicks highlighted element to advance
 *   clickReveal   — phase 1: "click X" prompt; phase 2: explanation + Next
 *   waitIndex     — Next is locked until the user navigates to a specific step index
 *   waitEvent     — Next is locked until a named EventBus event fires
 */

import { eventBus as defaultEventBus } from '../../core/EventBus.js';

/* ── Tiny helpers ───────────────────────────────────────────────────────── */

const wait  = ms => new Promise(r => setTimeout(r, ms));

async function until(selectorFn, tries = 10, interval = 200) {
    for (let i = 0; i < tries; i++) {
        const el = typeof selectorFn === 'string'
            ? document.querySelector(selectorFn)
            : selectorFn();
        if (el) return el;
        await wait(interval);
    }
    return null;
}

/* ── Icons ─────────────────────────────────────────────────────────────── */

const ICON_TOUR  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
</svg>`;

const ICON_CLOSE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5">
  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
</svg>`;

/* ── Section id used for Input CPEE view-mode selectors ─────────────────── */
const ICPEE = 'input-cpee';
const vmSel = (btn) => `.view-mode-toggle[data-section-id="${ICPEE}"] .${btn}`;

/* ── Step definitions ───────────────────────────────────────────────────── */
/*
  Fields
  ──────
  target      string | () => Element | null   spotlight target
  title       string                          popover title
  body        string                          HTML body (shown when NOT waiting for click)
  position    'top'|'bottom'|'left'|'right'|'none'
  padding     number                          spotlight inset (px)

  Type-specific fields
  ─────────────────────
  userClick           — user clicks target to advance; overlay is passthrough
  clickReveal         — { clickSel, explainTarget, explainBody }
                        phase-1 shows `body` as a click-prompt
                        phase-2 shows `explainBody` after user clicks `clickSel`
  waitEvent   string  — EventBus event; Next locked until fires
  waitIndex   number  — locked until step:displayed / step:navigated / stepViewer:stepChanged fires with stepIndex===n
*/

const STEPS = [

  /* ─────────────────────────────── LOAD PHASE ─────────────────────────── */
  {
    target: '.load-single-instance-section',
    title: '1 — Instance Loader',
    body: `Enter a CPEE process number or UUID in the input field and click
           <strong>Load</strong> to fetch its modification log.`,
    position: 'bottom', padding: 12,
  },

  {
    target: () => document.querySelector('.advanced-options-header'),
    title: '2 — Advanced Options',
    body: `Click <strong>Advanced Options</strong> to expand the panel and access archived instances.`,
    position: 'bottom', padding: 8,
    userClick: true,
    clickSel: '.advanced-options-header',
  },

  {
    target: '.load-all-instances-section',
    title: '3 — Known Instances',
    body: `Click <strong>Show Known Instances</strong> to load the archived instance list.`,
    position: 'bottom', padding: 8,
    userClick: true,
    clickSel: '#load-all-instances',
  },

  /* 4a — typing step: advances automatically once a match is visible */
  {
    target: () => document.querySelector('.known-instances-filter'),
    title: '4 — Filter Instances',
    body: `Type <code>1124</code> in the filter field.`,
    position: 'bottom', padding: 6,
    passthroughOverlay: true,
    autoAdvance: true,
    onEnter: (advance) => {
      const input = document.querySelector('.known-instances-filter .search-input');
      if (!input) return;
      input.focus();
      input.select();

      let debounce = null;
      const onInput = () => {
        clearTimeout(debounce);
        if (input.value.trim() !== '1124') return;
        debounce = setTimeout(() => {
          input.removeEventListener('input', onInput);
          advance();
        }, 500);
      };
      input.addEventListener('input', onInput);
    },
  },

  /* 4b — click entry step: user clicks the filtered result */
  {
    target: () => {
      const list = document.getElementById('load-all-instances-list');
      if (!list) return null;
      return Array.from(list.querySelectorAll('.instance-number-box'))
        .find(b => b.offsetParent !== null) || null;
    },
    title: '5 — Load Instance',
    body: `Click the <strong>1124</strong> entry to load it.`,
    position: 'bottom', padding: 6,
    passthroughOverlay: true,
    waitEvent: 'instance:loaded',
    autoAdvance: true,
  },

  {
    target: '#instance-tabs',
    title: '6 — Sidebar',
    body: `The sidebar shows a tab for every loaded instance.
           Click the <strong>instance tab</strong> to open it.`,
    position: 'right', padding: 8,
    userClick: true,
    clickSel: () => document.querySelector('#instance-tabs .instance-tab'),
    waitEvent: 'step:displayed',
    autoAdvance: true,
  },

  /* ─────────────────────────────── NAV BAR ────────────────────────────── */
  {
    target: '#theme-selector-wrapper',
    title: '7 — Theme Selector',
    body: `Controls the <strong>CPEE graph rendering theme</strong>:
           <code>preset</code>, <code>id</code>, or <code>presetid</code> —
           changing which labels are shown on graph nodes.`,
    position: 'bottom', padding: 8,
  },

  {
    target: '#metadata-display',
    title: '8 — Instance Metadata',
    body: `Shows the <strong>Change UUID</strong> of the current step — the unique identifier
           that groups all log events for one modification round — and the
           <strong>LLM model</strong> used for that step.`,
    position: 'bottom', padding: 8,
  },

  {
    target: '#scale-display',
    title: '9 — Graph Scaling',
    body: `Adjusts the <strong>zoom level</strong> of all rendered graphs.`,
    position: 'bottom', padding: 8,
  },

  /* ─────────────────────────────── STEP NAV ───────────────────────────── */
  {
    target: '#step-navigation',
    title: '10 — Step Navigation',
    body: `Each step = one user–LLM modification round.
           Use <strong>⏮ ← Prev · Next → ⏭</strong> or the <strong>← →</strong> arrow keys.
           <br><br>Navigate to <strong>Step 2</strong> to continue.`,
    position: 'bottom', padding: 8,
    passthroughOverlay: true,
    waitIndex: 1,
    autoAdvance: true,
  },

  /* ─────────────────────────────── VIEW MODES ─────────────────────────── */
  {
    target: () => document.querySelector(`.view-mode-toggle[data-section-id="${ICPEE}"]`),
    title: '11 — View Modes',
    body: `Every section has <strong>five view modes</strong>:<br><br>
           <strong>Graph</strong> — interactive visual rendering<br>
           <strong>Cleaned</strong> — auto-corrected source code<br>
           <strong>Raw</strong> — unaltered source code<br>
           <strong>Traces</strong> — all execution paths<br>
           <strong>Analysis</strong> — formal soundness, boundedness &amp; reachability checks`,
    position: 'bottom', padding: 6,
  },

  /* Graph */
  {
    target: () => document.querySelector(vmSel('toggle-btn-visual')),
    title: '12 — Graph',
    body: `Click <strong>Graph</strong> to open the interactive visual.`,
    position: 'bottom', padding: 6,
    clickReveal: {
      clickSel: () => document.querySelector(vmSel('toggle-btn-visual')),
      explainTarget: () => document.querySelector('#input-cpee'),
      explainBody:
        `Interactive visual — zoom, pan, and click any node to
         <strong>cross-highlight</strong> it simultaneously across all open graph sections.`,
    },
  },

  /* Cleaned */
  {
    target: () => document.querySelector(vmSel('toggle-btn-raw')),
    title: '13 — Cleaned',
    body: `Click <strong>Cleaned</strong> to see the auto-corrected source.`,
    position: 'bottom', padding: 6,
    clickReveal: {
      clickSel: () => document.querySelector(vmSel('toggle-btn-raw')),
      explainTarget: () => document.querySelector('#input-cpee'),
      explainBody:
        `Source code after <strong>preprocessing auto-corrections</strong>.`,
    },
  },

  /* Raw */
  {
    target: () => document.querySelector(vmSel('toggle-btn-log')),
    title: '14 — Raw',
    body: `Click <strong>Raw</strong> to see the unmodified LLM output.`,
    position: 'bottom', padding: 6,
    clickReveal: {
      clickSel: () => document.querySelector(vmSel('toggle-btn-log')),
      explainTarget: () => document.querySelector('#input-cpee'),
      explainBody:
        `Source code before <strong>preprocessing auto-corrections</strong>.`,
    },
  },

  /* Traces */
  {
    target: () => document.querySelector(vmSel('toggle-btn-traces')),
    title: '15 — Traces',
    body: `Click <strong>Traces</strong> to inspect execution paths.`,
    position: 'bottom', padding: 6,
    clickReveal: {
      clickSel: () => document.querySelector(vmSel('toggle-btn-traces')),
      explainTarget: () => document.querySelector('#input-cpee'),
      explainBody:
        `All execution paths (start → end) through the process.<br>
         Use <strong>▶ autoplay</strong> to walk through them step by step.<br><br>
         Paths are classified as:<br>
         <strong>Matching</strong>&nbsp;·&nbsp;
         <strong>Unique</strong>&nbsp;·&nbsp;
         <strong>Reconciled</strong> (relaxed matching conditions)`,
    },
  },

  /* Analysis */
  {
    target: () => document.querySelector(vmSel('toggle-btn-analysis')),
    title: '16 — Analysis',
    body: `Click <strong>Analysis</strong> to run formal property checks.`,
    position: 'bottom', padding: 6,
    clickReveal: {
      clickSel: () => document.querySelector(vmSel('toggle-btn-analysis')),
      explainTarget: () => document.querySelector('#input-cpee'),
      explainBody:
        `Three checks run on each graph:<br><br>
         <strong>Soundness</strong> — every path reaches the end<br>
         <strong>Boundedness</strong> — no unbounded token accumulation<br>
         <strong>Reachability</strong> — nodes classified as reachable, unreachable, or dead-end<br><br>
         <span class="tour-error-label">Red</span> = problems introduced by the modification.`,
    },
  },

  /* ─────────────────────────────── ERROR ID ───────────────────────────── */
  {
    target: '#step-dropdown-trigger',
    title: '17 — Step Dropdown',
    body: `The <strong>dropdown</strong> lets you jump to any step by timestamp.
           <br><br>Open it and go to <strong>Step 4</strong>.`,
    position: 'bottom', padding: 8,
    passthroughOverlay: true,
    waitIndex: 3,
    autoAdvance: true,
  },

  {
    target: () =>
      document.querySelector('#input-intermediate .mermaid-warning-indicator') ||
      document.querySelector('#input-intermediate'),
    title: '18 — Syntax Error (Preprocessing)',
    body: `<span class="tour-error-label">Syntax Error</span>&nbsp;
           The <strong>warning flag</strong> on Input Mermaid means preprocessing detected
           and auto-corrected a syntax issue. Expand it to see which corrections were applied.`,
    position: 'top', padding: 10,
    thenNavigate: true,
    thenTarget: '#step-dropdown-trigger',
    thenBody: `Use the <strong>step dropdown</strong> to navigate to <strong>Step 5</strong> to continue.`,
    thenPosition: 'bottom',
    waitIndex: 4,
    autoAdvance: true,
  },

  {
    target: () => {
      const boxes = document.querySelectorAll('.comparison-info-box-container');
      return Array.from(boxes).find(c => c.querySelector('.comparison-info-box')) || null;
    },
    title: '19 — Conversion Error',
    body: `<span class="tour-error-label">Conversion Error</span>&nbsp;
           Flags structural differences that emerge from conversion (Mermaid ↔ CPEE).
           Expand it to inspect which traces diverge.`,
    position: 'top', padding: 10,
    thenNavigate: true,
    thenTarget: '#step-dropdown-trigger',
    thenBody: `Use the <strong>step dropdown</strong> to navigate to <strong>Step 6</strong> to continue.`,
    thenPosition: 'bottom',
    waitIndex: 5,
    autoAdvance: true,
  },

  {
    target: () =>
      document.querySelector('#input-intermediate .mermaid-error-indicator') ||
      document.querySelector('#input-intermediate .mermaid-warning-indicator'),
    title: '20 — Syntax Error (Undetected)',
    body: `<span class="tour-error-label">Syntax Error</span>&nbsp;
           This warning was <strong>not caught by preprocessing</strong>.
           Switch to <em>Raw</em> vs <em>Cleaned</em> to see what differs.`,
    position: 'top', padding: 10,
    thenNavigate: true,
    thenTarget: '#step-dropdown-trigger',
    thenBody: `Use the <strong>step dropdown</strong> to navigate to <strong>Step 10</strong> to continue.`,
    thenPosition: 'bottom',
    waitIndex: 9,
    autoAdvance: true,
  },

  {
    target: () => document.querySelector('.view-mode-toggle[data-section-id="output-intermediate"] .toggle-btn-analysis'),
    title: '21 — Output Analysis',
    body: `The <strong>Analysis</strong> button on Output Mermaid is flagged — a mistake was introduced here. Click it to inspect.`,
    position: 'bottom', padding: 6,
    clickReveal: {
      clickSel: () => document.querySelector('.view-mode-toggle[data-section-id="output-intermediate"] .toggle-btn-analysis'),
      explainTarget: () =>
        document.querySelector('#output-intermediate .analysis-content-wrapper') ||
        document.querySelector('#output-intermediate'),
      explainBody:
        `The three checks — <strong>Soundness</strong>, <strong>Boundedness</strong>, and <strong>Reachability</strong> — flag exactly what the modification broke.<br><br>
         <span class="tour-error-label">Red</span> results reveal the <strong>structural errors</strong>. This is how you identify what went wrong.`,
    },
  },

  /* ─────────────────────────────── DONE ───────────────────────────────── */
  {
    target: null,
    title: 'Tour Complete',
    body: `You have seen the three error types:<br><br>
           <span class="tour-error-label">Syntax</span> — warning on Input Mermaid<br>
           <span class="tour-error-label">Conversion</span> — alert box between stages<br>
           <span class="tour-error-label">Structural</span> — red results in Analysis<br><br>
           Now that you are familiar with the console, you may continue with the questionnaire.`,
    position: 'none',
  },
];

/* ── DemoTour ───────────────────────────────────────────────────────────── */

export class DemoTour {
    constructor(eventBus = null) {
        this.eventBus      = eventBus || defaultEventBus;
        this._stepIndex    = 0;
        this._active       = false;
        this._cleanup      = [];

        this._overlay             = null;
        this._spotlight           = null;
        this._popover             = null;
        this._btn                 = null;
        this._resizeObserver      = null;
        this._tourScrolling       = false;
        this._currentSpotlightEl  = null;
        this._currentSpotlightPad = 8;

        this._onResize  = () => this._reposition();
        this._onKeyDown = null;
    }

    /* ── Public ──────────────────────────────────────────────────────────── */

    mountButton(container) {
        if (!container) return;
        const btn = document.createElement('button');
        btn.id        = 'tour-start-btn';
        btn.className = 'btn-icon-transparent';
        btn.title     = 'Start Interactive Tour';
        btn.setAttribute('aria-label', 'Start Interactive Tour');
        btn.innerHTML = ICON_TOUR;
        btn.addEventListener('click', () => this._showConfirm());
        container.appendChild(btn);
        this._btn = btn;
    }

    end() {
        this._active = false;
        this._cleanup.forEach(fn => fn());
        this._cleanup = [];
        window.removeEventListener('resize',  this._onResize);
        window.removeEventListener('scroll',  this._onScroll);
        window.removeEventListener('keydown', this._onKeyDown);
        if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
        this._overlay?.remove();
        this._spotlight?.remove();
        this._popover?.remove();
        this._overlay = this._spotlight = this._popover = null;
        if (this._btn) this._btn.disabled = false;
    }

    /* ── Confirmation ────────────────────────────────────────────────────── */

    _showConfirm() {
        if (this._active) return;
        const bd = document.createElement('div');
        bd.className = 'tour-confirm-backdrop';
        bd.innerHTML = `
          <div class="tour-confirm-dialog">
            <h2>${ICON_TOUR} Interactive Tour</h2>
            <p>
              A step-by-step walkthrough of the console's features,
              including how to identify <strong>syntax</strong>,
              <strong>conversion</strong> errors and <strong>structural</strong> errors.<br><br>
              You will load instance <strong>1124</strong> during the tour.
              You can exit at any time.
            </p>
            <div class="tour-confirm-actions">
              <button class="tour-btn-secondary" id="_tc-cancel">Cancel</button>
              <button class="tour-btn-primary"   id="_tc-start">Start Tour</button>
            </div>
          </div>`;
        document.body.appendChild(bd);
        bd.querySelector('#_tc-cancel').onclick = () => bd.remove();
        bd.querySelector('#_tc-start').onclick  = () => { bd.remove(); this._start(); };
    }

    /* ── Lifecycle ───────────────────────────────────────────────────────── */

    _start() {
        this._active    = true;
        this._stepIndex = 0;
        if (this._btn) this._btn.disabled = true;

        this._overlay   = this._mkEl('div', 'tour-overlay');
        this._spotlight = this._mkEl('div', 'tour-spotlight tour-spotlight--hidden');
        this._popover   = this._mkEl('div', 'tour-popover');
        this._popover.setAttribute('role', 'dialog');

        this._onScroll = () => {
            if (this._tourScrolling) {
                if (this._currentSpotlightEl && this._spotlight) {
                    const r   = this._currentSpotlightEl.getBoundingClientRect();
                    const pad = this._currentSpotlightPad;
                    Object.assign(this._spotlight.style, {
                        top:    `${r.top    - pad}px`,
                        left:   `${r.left   - pad}px`,
                        width:  `${r.width  + pad * 2}px`,
                        height: `${r.height + pad * 2}px`,
                    });
                }
                return;
            }
            this._spotlight?.classList.add('tour-spotlight--hidden');
        };
        this._onKeyDown = (e) => {
            if (!this._active) return;
            if (e.key === 'Escape') { this.end(); return; }
            if (e.key === 'ArrowRight') {
                const btn = this._popover?.querySelector('#_tp-next');
                if (btn && !btn.disabled) btn.click();
            }
        };
        document.body.append(this._overlay, this._spotlight, this._popover);
        window.addEventListener('resize',  this._onResize);
        window.addEventListener('scroll',  this._onScroll,  { passive: true });
        window.addEventListener('keydown', this._onKeyDown);

        /* Skip the load-phase steps if an instance is already in the sidebar */
        const firstStep = document.querySelector('#instance-tabs .instance-tab') ? 5 : 0;
        this._showStep(firstStep);
    }

    async _showStep(index) {
        if (!this._active || index >= STEPS.length) return;
        this._stepIndex = index;
        const step = STEPS[index];
        if      (step.thenNavigate) await this._runThenNavigate(index);
        else if (step.clickReveal)  await this._runClickReveal(index);
        else                        await this._runRegularStep(index);
    }

    /* ── Regular step ────────────────────────────────────────────────────── */

    async _runRegularStep(index) {
        const step   = STEPS[index];
        const isLast = index === STEPS.length - 1;

        const targetEl = this._resolve(step.target);
        if (targetEl) {
            await this._focusElement(targetEl, step.padding ?? 8);
        } else {
            this._spotlight.classList.add('tour-spotlight--hidden');
        }

        if (step.onEnter) {
            await wait(80);
            step.onEnter(() => this._autoAdvance(index));
        }

        this._overlay.style.pointerEvents = (step.userClick || step.passthroughOverlay) ? 'none' : 'all';
        this._spotlight.classList.toggle('tour-spotlight--pulse', !!step.userClick);

        const hasNext    = (!step.userClick || step.waitEvent) && !step.autoAdvance;
        const nextLocked = !!(step.waitEvent || step.waitIndex !== undefined);
        const nextLabel  = hasNext ? (isLast ? 'Done' : 'Next →') : null;
        const nextBtn    = this._renderPopover(step.title, step.body, index, nextLabel, nextLocked);

        await wait(20);
        targetEl ? this._placePopover(targetEl.getBoundingClientRect(), step.position ?? 'bottom')
                 : this._centerPopover();

        if (step.userClick) {
            const clickEl = await until(step.clickSel ?? step.target);
            if (clickEl) {
                const handler = () => {
                    clickEl.removeEventListener('click', handler);
                    if (step.waitEvent) {
                        this._overlay.style.pointerEvents = 'all';
                        this._spotlight.classList.remove('tour-spotlight--pulse');
                        this._waitForEvent(step.waitEvent).then(() =>
                            step.autoAdvance ? this._autoAdvance(index)
                                             : nextBtn && (nextBtn.disabled = false)
                        );
                        if (!step.autoAdvance && nextBtn)
                            nextBtn.onclick = () => { if (!nextBtn.disabled) isLast ? this.end() : this._showStep(index + 1); };
                    } else if (this._active && this._stepIndex === index) {
                        this._showStep(index + 1);
                    }
                };
                clickEl.addEventListener('click', handler);
                this._cleanup.push(() => clickEl.removeEventListener('click', handler));
            }
            return;
        }

        if (step.waitEvent)
            this._waitForEvent(step.waitEvent).then(() =>
                step.autoAdvance ? this._autoAdvance(index)
                                 : nextBtn && (nextBtn.disabled = false)
            );

        if (step.waitIndex !== undefined)
            this._waitForStepIndex(step.waitIndex).then(() =>
                step.autoAdvance ? this._autoAdvance(index, 1000)
                                 : nextBtn && (nextBtn.disabled = false)
            );

        if (nextBtn) nextBtn.onclick = () => isLast ? this.end() : this._showStep(index + 1);
    }

    /* ── clickReveal step (two-phase) ────────────────────────────────────── */

    async _runClickReveal(index) {
        if (!this._active) return;
        const step   = STEPS[index];
        const cr     = step.clickReveal;
        const isLast = index === STEPS.length - 1;

        /* Phase 1: click prompt */
        const targetEl = this._resolve(step.target);
        if (targetEl) await this._focusElement(targetEl, step.padding ?? 6);
        this._spotlight.classList.add('tour-spotlight--pulse');
        this._overlay.style.pointerEvents = 'none';

        this._renderPopover(step.title, step.body, index);
        await wait(20);
        if (targetEl) this._placePopover(targetEl.getBoundingClientRect(), step.position ?? 'bottom');

        await this._waitForClick(cr.clickSel);
        if (!this._active || this._stepIndex !== index) return;

        /* Phase 2: explanation */
        this._spotlight.classList.remove('tour-spotlight--pulse');
        this._overlay.style.pointerEvents = 'all';

        const explainEl = this._resolve(cr.explainTarget);
        if (explainEl) await this._focusElement(explainEl, step.padding ?? 8);

        const nextBtn = this._renderPopover(step.title, cr.explainBody, index, isLast ? 'Done' : 'Next →');
        nextBtn.onclick = () => isLast ? this.end() : this._showStep(index + 1);

        await wait(20);
        if (explainEl)     this._placePopover(explainEl.getBoundingClientRect(), 'top');
        else if (targetEl) this._placePopover(targetEl.getBoundingClientRect(), step.position ?? 'bottom');
    }

    /* ── thenNavigate step (two-phase: explain → spotlight navigation) ───── */

    async _runThenNavigate(index) {
        if (!this._active) return;
        const step   = STEPS[index];
        const isLast = index === STEPS.length - 1;

        /* Phase 1: spotlight error/warning, explanation + Next */
        const targetEl = this._resolve(step.target);
        if (targetEl) {
            await this._focusElement(targetEl, step.padding ?? 8);
        } else {
            this._spotlight.classList.add('tour-spotlight--hidden');
        }
        this._overlay.style.pointerEvents = 'none';

        const nextBtn = this._renderPopover(step.title, step.body, index, 'Next →');
        await wait(20);
        targetEl ? this._placePopover(targetEl.getBoundingClientRect(), step.position ?? 'top')
                 : this._centerPopover();

        await new Promise(resolve => {
            nextBtn.onclick = resolve;
            this._cleanup.push(resolve);
        });
        if (!this._active || this._stepIndex !== index) return;

        /* Phase 2: spotlight the step dropdown, navigation instruction */
        const thenEl = this._resolve(step.thenTarget);
        if (thenEl) {
            await this._focusElement(thenEl, step.padding ?? 8);
            this._spotlight.classList.add('tour-spotlight--pulse');
        }
        this._overlay.style.pointerEvents = 'none';

        this._renderPopover(step.title, step.thenBody, index);
        await wait(20);
        if (thenEl) this._placePopover(thenEl.getBoundingClientRect(), step.thenPosition ?? 'bottom');

        if (step.waitIndex !== undefined) {
            await this._waitForStepIndex(step.waitIndex);
            if (!this._active || this._stepIndex !== index) return;
            if (step.autoAdvance) {
                this._spotlight.classList.remove('tour-spotlight--pulse');
                await this._autoAdvance(index, 1000);
            }
        }
    }

    /* ── Scroll element into the upper viewport ─────────────────────────── */

    async _scrollToElement(el) {
        const r  = el.getBoundingClientRect();
        const vh = window.innerHeight;
        if (r.bottom < 0 || r.top > vh || r.top > vh * 0.45) {
            this._tourScrolling = true;
            if (this._spotlight) this._spotlight.style.transition = 'none';
            window.scrollBy({ top: r.top - vh * 0.25, behavior: 'smooth' });
            await this._waitForScrollEnd();
            this._tourScrolling = false;
            if (this._spotlight) this._spotlight.style.transition = '';
        }
    }

    _waitForScrollEnd() {
        return new Promise(resolve => {
            let timer;
            const done = () => { window.removeEventListener('scroll', onScroll); resolve(); };
            const onScroll = () => { clearTimeout(timer); timer = setTimeout(done, 80); };
            window.addEventListener('scroll', onScroll, { passive: true });
            timer = setTimeout(done, 600);
        });
    }

    /* ── Spotlight ───────────────────────────────────────────────────────── */

    _focusElement(el, pad = 8) {
        this._placeSpotlight(el, pad);
        this._spotlight.classList.remove('tour-spotlight--hidden');
        return this._scrollToElement(el);
    }

    _placeSpotlight(el, pad = 8) {
        this._currentSpotlightEl  = el;
        this._currentSpotlightPad = pad;
        const apply = () => {
            const r = el.getBoundingClientRect();
            Object.assign(this._spotlight.style, {
                top:    `${r.top    - pad}px`,
                left:   `${r.left  - pad}px`,
                width:  `${r.width  + pad * 2}px`,
                height: `${r.height + pad * 2}px`,
            });
        };
        apply();
        if (this._resizeObserver) this._resizeObserver.disconnect();
        this._resizeObserver = new ResizeObserver(() => { if (this._active) apply(); });
        this._resizeObserver.observe(el);
    }

    /* ── Popover ─────────────────────────────────────────────────────────── */

    _renderPopover(title, body, index, nextLabel = null, nextDisabled = false) {
        this._popover.innerHTML = `
          <div class="tour-popover-arrow"></div>
          <div class="tour-popover-inner">
            <div class="tour-popover-header">
              <span class="tour-popover-title">${title}</span>
              <button class="tour-popover-close">${ICON_CLOSE}</button>
            </div>
            <p class="tour-popover-body">${body}</p>
          </div>
          <div class="tour-popover-footer">
            <span class="tour-step-counter">${index + 1} / ${STEPS.length}</span>
            <div class="tour-footer-btns">
              <button class="tour-btn-secondary" id="_tp-skip">Exit</button>
              ${nextLabel ? `<button class="tour-btn-primary" id="_tp-next"${nextDisabled ? ' disabled' : ''}>${nextLabel}</button>` : ''}
            </div>
          </div>`;
        this._popover.querySelector('.tour-popover-close').onclick = () => this.end();
        this._popover.querySelector('#_tp-skip').onclick           = () => this.end();
        return this._popover.querySelector('#_tp-next');
    }

    _placePopover(rect, preferred) {
        const GAP  = 12;
        const popW = this._popover.offsetWidth  || 300;
        const popH = this._popover.offsetHeight || 180;
        const vw   = window.innerWidth;
        const vh   = window.innerHeight;

        const ok = {
            bottom: rect.bottom + GAP + popH <= vh,
            top:    rect.top    - GAP - popH >= 0,
            right:  rect.right  + GAP + popW <= vw,
            left:   rect.left   - GAP - popW >= 0,
        };
        const chosen = [preferred, 'bottom', 'top', 'right', 'left']
            .filter((v, i, a) => a.indexOf(v) === i)
            .find(p => ok[p]) || 'bottom';

        let top, left;
        switch (chosen) {
            case 'bottom': top = rect.bottom + GAP; left = rect.left + rect.width / 2 - popW / 2; break;
            case 'top':    top = rect.top - GAP - popH; left = rect.left + rect.width / 2 - popW / 2; break;
            case 'right':  top = rect.top + rect.height / 2 - popH / 2; left = rect.right + GAP; break;
            default:       top = rect.top + rect.height / 2 - popH / 2; left = rect.left - GAP - popW;
        }
        Object.assign(this._popover.style, {
            top:       `${Math.max(8, Math.min(top,  vh - popH - 8))}px`,
            left:      `${Math.max(8, Math.min(left, vw - popW - 8))}px`,
            transform: '',
        });
        this._popover.setAttribute('data-arrow', chosen);
    }

    _centerPopover() {
        Object.assign(this._popover.style, { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' });
        this._popover.setAttribute('data-arrow', 'none');
    }

    _reposition() {
        if (!this._active) return;
        const step = STEPS[this._stepIndex];
        const el   = this._resolve(step.target);
        if (el) { this._placeSpotlight(el, step.padding ?? 8); this._placePopover(el.getBoundingClientRect(), step.position ?? 'bottom'); }
        else      this._centerPopover();
    }

    /* ── Event / click waiters ───────────────────────────────────────────── */

    _waitForEvent(name) {
        return new Promise(resolve => {
            const h = () => { this.eventBus.off(name, h); resolve(); };
            this.eventBus.on(name, h);
            this._cleanup.push(() => this.eventBus.off(name, h));
        });
    }

    _waitForStepIndex(targetIdx) {
        const EVTS = ['step:displayed', 'step:navigated', 'stepViewer:stepChanged'];
        return new Promise(resolve => {
            const check = ({ stepIndex }) => {
                if (stepIndex !== targetIdx) return;
                EVTS.forEach(e => this.eventBus.off(e, check));
                resolve();
            };
            EVTS.forEach(e => this.eventBus.on(e, check));
            this._cleanup.push(() => EVTS.forEach(e => this.eventBus.off(e, check)));
        });
    }

    _waitForClick(selectorOrFn) {
        return new Promise(resolve => {
            until(selectorOrFn).then(el => {
                if (!el || !this._active) { resolve(); return; }
                const h = () => { el.removeEventListener('click', h); resolve(); };
                el.addEventListener('click', h);
                this._cleanup.push(() => el.removeEventListener('click', h));
            });
        });
    }

    /* ── Utilities ───────────────────────────────────────────────────────── */

    async _autoAdvance(index, delay = 150) {
        await wait(delay);
        if (this._active && this._stepIndex === index)
            index === STEPS.length - 1 ? this.end() : this._showStep(index + 1);
    }

    _resolve(targetish) {
        if (!targetish) return null;
        return typeof targetish === 'function' ? targetish() : document.querySelector(targetish);
    }

    _mkEl(tag, cls) {
        const el = document.createElement(tag);
        el.className = cls;
        return el;
    }
}
