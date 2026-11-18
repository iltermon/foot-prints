import { WorkspaceLeaf } from "obsidian";
import type FootPrintsPlugin from "../main";
import { visibleLeaf } from "../types";
import { closePanesAfter, enforcePaneLimit, isRootLeaf, paneIndexOf, pathOf, rootPanes } from "./panes";

/**
 * Show `path` in the pane right of `source`, closing panes beyond it. If the
 * next pane already shows `path` it is focused instead. With sideways panes off
 * (or outside the main area) `source` itself navigates.
 */
export async function openBeside(
	plugin: FootPrintsPlugin,
	source: WorkspaceLeaf,
	path: string,
	open: (leaf: WorkspaceLeaf) => Promise<unknown>,
): Promise<void> {
	const { workspace } = plugin.app;
	const index = plugin.isActive() && isRootLeaf(workspace, source) ? paneIndexOf(workspace, source) : -1;
	if (index < 0) {
		await open(source);
		return;
	}

	const nextPane = rootPanes(workspace)[index + 1];
	const nextLeaf = nextPane ? visibleLeaf(nextPane) : null;
	if (nextLeaf && pathOf(nextLeaf) === path) {
		closePanesAfter(workspace, index + 1);
		workspace.setActiveLeaf(nextLeaf, { focus: true });
		return;
	}

	closePanesAfter(workspace, index);
	const leaf = workspace.createLeafBySplit(source, "vertical");
	workspace.setActiveLeaf(leaf, { focus: true });
	await open(leaf);
	enforcePaneLimit(workspace, plugin.settings.maxPanes);
}
