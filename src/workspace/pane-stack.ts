import { WorkspaceLeaf } from "obsidian";
import type FootPrintsPlugin from "../main";
import { itemEl, visibleLeaf } from "../types";
import { paneIndexOf, rootPanes } from "./panes";

const STACK_CLASS = "fp-stack";
const STACKING_CLASS = "fp-stacking";
const PANE_CLASS = "fp-pane";
const LAST_CLASS = "fp-last";
const STACKED_CLASS = "fp-stacked";
const SPINE_CLASS = "fp-spine";
const CSS_VARS = ["--fp-pane-width", "--fp-spine-width", "--fp-count"];
const PANE_VARS = ["--fp-index"];

/** A pane collapses into a spine once less than this share of it is visible. */
const COLLAPSE_RATIO = 0.3;

interface PaneInfo {
	el: HTMLElement;
	leaf: WorkspaceLeaf | null;
}

/**
 * Lays out the main area's panes as a horizontally scrolling row of fixed-width
 * columns. Panes scrolled past either edge stick there as narrow spines.
 */
export class PaneStack {
	private rootEl: HTMLElement | null = null;
	private panes: PaneInfo[] = [];
	private frame: number | null = null;

	constructor(private plugin: FootPrintsPlugin) {}

	load(): void {
		const { workspace } = this.plugin.app;
		const refresh = () => this.refresh();
		this.plugin.registerEvent(workspace.on("layout-change", refresh));
		this.plugin.registerEvent(workspace.on("file-open", refresh));
		this.plugin.registerEvent(this.plugin.app.vault.on("rename", refresh));
		this.plugin.registerEvent(
			workspace.on("active-leaf-change", (leaf) => {
				this.refresh();
				if (leaf) window.requestAnimationFrame(() => this.reveal(leaf));
			}),
		);
		// Scroll events don't bubble, so listen in the capture phase.
		this.plugin.registerDomEvent(
			document,
			"scroll",
			(evt) => {
				if (evt.target === this.rootEl) this.scheduleStackingUpdate();
			},
			{ capture: true, passive: true },
		);
		this.plugin.registerDomEvent(window, "resize", () => this.scheduleStackingUpdate());
		this.plugin.register(() => this.teardown());
		workspace.onLayoutReady(refresh);
	}

	/** Re-sync DOM classes, sizes and spines with the current workspace layout. */
	refresh(): void {
		if (!this.plugin.isActive()) {
			this.teardown();
			return;
		}
		const { workspace } = this.plugin.app;
		const rootEl = itemEl(workspace.rootSplit);
		if (!rootEl) return;
		if (this.rootEl && this.rootEl !== rootEl) this.teardown();
		this.rootEl = rootEl;

		const { paneWidth, spineWidth, stackPanes } = this.plugin.settings;
		const items = rootPanes(workspace);
		this.panes = items.flatMap((item) => {
			const el = itemEl(item);
			return el ? [{ el, leaf: visibleLeaf(item) }] : [];
		});

		rootEl.addClass(STACK_CLASS);
		rootEl.toggleClass(STACKING_CLASS, stackPanes);
		rootEl.style.setProperty("--fp-pane-width", `${paneWidth}px`);
		rootEl.style.setProperty("--fp-spine-width", `${spineWidth}px`);
		rootEl.style.setProperty("--fp-count", String(this.panes.length));

		const current = new Set(this.panes.map((p) => p.el));
		rootEl.querySelectorAll<HTMLElement>(`:scope > .${PANE_CLASS}`).forEach((el) => {
			if (!current.has(el)) cleanPane(el);
		});

		this.panes.forEach((pane, i) => {
			pane.el.addClass(PANE_CLASS);
			pane.el.toggleClass(LAST_CLASS, i === this.panes.length - 1);
			pane.el.style.setProperty("--fp-index", String(i));
			this.syncSpine(pane);
		});

		this.scheduleStackingUpdate();
	}

	/** Scroll so the pane containing `leaf` is fully visible. */
	reveal(leaf: WorkspaceLeaf): void {
		const rootEl = this.rootEl;
		if (!rootEl || !this.plugin.isActive()) return;
		const index = paneIndexOf(this.plugin.app.workspace, leaf);
		const pane = this.panes[index];
		if (!pane) return;

		const sw = this.plugin.settings.stackPanes ? this.plugin.settings.spineWidth : 0;
		const count = this.panes.length;
		const start = this.naturalLeft(index);
		const width = pane.el.offsetWidth;
		const view = rootEl.clientWidth;
		const scroll = rootEl.scrollLeft;

		let target = scroll;
		if (start - scroll < index * sw) {
			target = start - index * sw;
		} else if (start + width - scroll > view - (count - 1 - index) * sw) {
			target = start + width - view + (count - 1 - index) * sw;
		}
		if (Math.abs(target - scroll) > 1) rootEl.scrollTo({ left: target, behavior: "smooth" });
	}

	private syncSpine(pane: PaneInfo): void {
		let spine = pane.el.querySelector<HTMLElement>(`:scope > .${SPINE_CLASS}`);
		if (!spine) {
			spine = pane.el.createDiv({ cls: SPINE_CLASS });
			spine.addEventListener("click", (evt) => {
				evt.stopPropagation();
				const leaf = this.panes.find((p) => p.el === pane.el)?.leaf;
				if (leaf) this.plugin.app.workspace.setActiveLeaf(leaf, { focus: true });
			});
		}
		const title = pane.leaf?.getDisplayText() ?? "";
		if (spine.getText() !== title) spine.setText(title);
		spine.setAttr("aria-label", title);
	}

	/** Left edge of a pane if nothing were sticky (sum of preceding widths). */
	private naturalLeft(index: number): number {
		let left = 0;
		for (let i = 0; i < index; i++) left += this.panes[i]?.el.offsetWidth ?? 0;
		return left;
	}

	private scheduleStackingUpdate(): void {
		if (this.frame !== null) return;
		this.frame = window.requestAnimationFrame(() => {
			this.frame = null;
			this.updateStacking();
		});
	}

	/** Mark panes that are mostly covered so their spine (title strip) shows. */
	private updateStacking(): void {
		const rootEl = this.rootEl;
		if (!rootEl) return;
		const { stackPanes, spineWidth: sw } = this.plugin.settings;
		const count = this.panes.length;
		const scroll = rootEl.scrollLeft;
		const view = rootEl.clientWidth;

		// Where each pane actually appears, accounting for sticky clamping.
		const lefts: number[] = [];
		let natural = 0;
		for (let i = 0; i < count; i++) {
			const raw = natural - scroll;
			const min = i * sw;
			const max = view - (count - i) * sw;
			lefts.push(stackPanes ? Math.max(min, Math.min(raw, max)) : raw);
			natural += this.panes[i]?.el.offsetWidth ?? 0;
		}

		this.panes.forEach((pane, i) => {
			const width = pane.el.offsetWidth;
			const left = lefts[i] ?? 0;
			const right = Math.min(lefts[i + 1] ?? view, left + width, view);
			const visible = right - Math.max(left, 0);
			pane.el.toggleClass(STACKED_CLASS, stackPanes && count > 1 && visible < width * COLLAPSE_RATIO);
		});
	}

	private teardown(): void {
		if (this.frame !== null) {
			window.cancelAnimationFrame(this.frame);
			this.frame = null;
		}
		const rootEl = this.rootEl;
		if (!rootEl) return;
		rootEl.removeClass(STACK_CLASS, STACKING_CLASS);
		CSS_VARS.forEach((v) => rootEl.style.removeProperty(v));
		rootEl.querySelectorAll<HTMLElement>(`:scope > .${PANE_CLASS}`).forEach(cleanPane);
		this.rootEl = null;
		this.panes = [];
	}
}

function cleanPane(el: HTMLElement): void {
	el.removeClass(PANE_CLASS, LAST_CLASS, STACKED_CLASS);
	PANE_VARS.forEach((v) => el.style.removeProperty(v));
	el.querySelectorAll(`:scope > .${SPINE_CLASS}`).forEach((s) => s.remove());
}
