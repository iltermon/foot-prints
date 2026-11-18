import { FileView, Workspace, WorkspaceItem, WorkspaceLeaf } from "obsidian";
import { FOLDER_VIEW_TYPE } from "../constants";
import { containsLeaf, itemChildren, itemEl, leavesIn } from "../types";

/** The columns of the main editing area, left to right. */
export function rootPanes(workspace: Workspace): WorkspaceItem[] {
	// Resize handles live in the DOM, not in `children`, so this is panes only.
	return itemChildren(workspace.rootSplit).filter((item) => itemEl(item) !== null);
}

export function paneIndexOf(workspace: Workspace, leaf: WorkspaceLeaf): number {
	return rootPanes(workspace).findIndex((pane) => containsLeaf(pane, leaf));
}

export function isRootLeaf(workspace: Workspace, leaf: WorkspaceLeaf): boolean {
	return leaf.getRoot() === workspace.rootSplit;
}

export function filePathOf(leaf: WorkspaceLeaf | null): string | null {
	return leaf?.view instanceof FileView ? leaf.view.file?.path ?? null : null;
}

/** The file or folder a leaf shows (folder panes included, even while deferred). */
export function pathOf(leaf: WorkspaceLeaf | null): string | null {
	if (!leaf) return null;
	const file = filePathOf(leaf);
	if (file) return file;
	const state = leaf.getViewState();
	if (state.type !== FOLDER_VIEW_TYPE) return null;
	const path = (state.state as { path?: unknown } | undefined)?.path;
	return typeof path === "string" ? path : null;
}

/** Close the leftmost panes until at most `max` remain (0 = no limit). */
export function enforcePaneLimit(workspace: Workspace, max: number): void {
	if (max <= 0) return;
	const panes = rootPanes(workspace);
	const doomed = panes.slice(0, Math.max(0, panes.length - max)).flatMap(leavesIn);
	for (const leaf of doomed) leaf.detach();
}

/** Close every pane to the right of the pane at `index`. */
export function closePanesAfter(workspace: Workspace, index: number): void {
	const doomed = rootPanes(workspace).slice(index + 1).flatMap(leavesIn);
	for (const leaf of doomed) leaf.detach();
}
