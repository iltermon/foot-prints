import type { WorkspaceItem, WorkspaceLeaf } from "obsidian";

/**
 * Obsidian keeps these fields private. They are stable in practice (used by many
 * layout plugins) but are not part of the public API, so access them through
 * these narrow helpers only.
 */
interface InternalItem {
	containerEl?: HTMLElement;
	children?: WorkspaceItem[];
	currentTab?: number;
}

export function itemEl(item: WorkspaceItem): HTMLElement | null {
	return (item as unknown as InternalItem).containerEl ?? null;
}

export function itemChildren(item: WorkspaceItem): WorkspaceItem[] {
	return (item as unknown as InternalItem).children ?? [];
}

/** All leaves inside a workspace item, depth-first. */
export function leavesIn(item: WorkspaceItem): WorkspaceLeaf[] {
	const children = itemChildren(item);
	if (children.length === 0) return isLeaf(item) ? [item] : [];
	return children.flatMap(leavesIn);
}

/** The visible leaf of a pane (the selected tab of a tab group). */
export function visibleLeaf(item: WorkspaceItem): WorkspaceLeaf | null {
	if (isLeaf(item)) return item;
	const children = itemChildren(item);
	const current = (item as unknown as InternalItem).currentTab ?? 0;
	const child = children[current] ?? children[0];
	return child ? visibleLeaf(child) : null;
}

export function containsLeaf(item: WorkspaceItem, leaf: WorkspaceLeaf): boolean {
	let node: WorkspaceItem | null = leaf;
	while (node) {
		if (node === item) return true;
		node = node.parent ?? null;
	}
	return false;
}

function isLeaf(item: WorkspaceItem): item is WorkspaceLeaf {
	return "view" in item;
}
