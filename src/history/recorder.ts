import { TFile, WorkspaceLeaf } from "obsidian";
import type FootPrintsPlugin from "../main";
import { filePathOf, isRootLeaf } from "../workspace/panes";
import { HistoryStore } from "./store";

/** How long a link click waits for the resulting file-open, in milliseconds. */
const LINK_WINDOW_MS = 3000;

/**
 * Turns workspace navigation into history nodes. A note reached through a link
 * becomes a child of the note the link was in; anything else starts a thread.
 */
export class HistoryRecorder {
	/** History node currently shown in each leaf. */
	private leafNodes = new WeakMap<WorkspaceLeaf, string>();
	/** Last file seen in each leaf, to tell focus changes from navigation. */
	private leafPaths = new WeakMap<WorkspaceLeaf, string>();
	private pending: { parentId: string; at: number } | null = null;

	constructor(private plugin: FootPrintsPlugin, private store: HistoryStore) {}

	load(): void {
		const { workspace, vault } = this.plugin.app;
		this.plugin.registerEvent(
			vault.on("rename", (file, oldPath) => this.store.renamePath(oldPath, file.path)),
		);
		workspace.onLayoutReady(() => {
			// Restored panes are not new visits.
			workspace.iterateRootLeaves((leaf) => {
				const path = filePathOf(leaf);
				if (path) this.leafPaths.set(leaf, path);
			});
			this.plugin.registerEvent(workspace.on("file-open", (file) => this.onFileOpen(file)));
		});
	}

	/** Call right before a link in `source` is opened. */
	linkFollowed(source: WorkspaceLeaf): void {
		if (!this.plugin.settings.recordHistory) return;
		let parentId = this.leafNodes.get(source);
		const path = filePathOf(source);
		if (path && (!parentId || this.store.get(parentId)?.path !== path)) {
			// The source pane predates recording (e.g. restored on startup).
			parentId = this.store.add(path, null).id;
			this.assign(source, parentId, path);
		}
		this.pending = parentId ? { parentId, at: Date.now() } : null;
	}

	/** Mark `leaf` as showing an existing history node (used when reopening a trail). */
	assign(leaf: WorkspaceLeaf, nodeId: string, path: string): void {
		this.leafNodes.set(leaf, nodeId);
		this.leafPaths.set(leaf, path);
	}

	private onFileOpen(file: TFile | null): void {
		const { workspace } = this.plugin.app;
		const pending = this.pending && Date.now() - this.pending.at < LINK_WINDOW_MS ? this.pending : null;
		this.pending = null;
		if (!file) return;

		const leaf = workspace.getMostRecentLeaf(workspace.rootSplit);
		if (!leaf || !isRootLeaf(workspace, leaf) || filePathOf(leaf) !== file.path) return;
		if (this.leafPaths.get(leaf) === file.path) return; // focus change or in-note link
		this.leafPaths.set(leaf, file.path);

		if (!this.plugin.settings.recordHistory) return;
		const node = this.store.add(file.path, pending?.parentId ?? null);
		this.leafNodes.set(leaf, node.id);
	}
}
