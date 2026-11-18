import { Notice, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import { showFolder } from "../folders/show-folder";
import type FootPrintsPlugin from "../main";
import { enforcePaneLimit, isRootLeaf } from "../workspace/panes";

/**
 * Replace the main area with the thread leading to `nodeId`: its root on the
 * left, the node itself on the right. Pinned tabs are left alone.
 */
export async function openTrail(plugin: FootPrintsPlugin, nodeId: string, from: WorkspaceLeaf): Promise<void> {
	const { workspace, vault } = plugin.app;
	const steps = plugin.history.trail(nodeId).flatMap((node) => {
		const file = vault.getAbstractFileByPath(node.path);
		return file instanceof TFile || file instanceof TFolder ? [{ node, file }] : [];
	});
	if (steps.length === 0) {
		new Notice("That note or folder no longer exists.");
		return;
	}

	const anchor = isRootLeaf(workspace, from) ? from : workspace.getLeaf("tab");
	const others: WorkspaceLeaf[] = [];
	workspace.iterateRootLeaves((leaf) => {
		if (leaf !== anchor && !leaf.getViewState().pinned) others.push(leaf);
	});
	others.forEach((leaf) => leaf.detach());

	// Only the end of a long trail fits within the pane limit.
	const max = plugin.isActive() ? plugin.settings.maxPanes : 0;
	const shown = max > 0 ? steps.slice(-max) : steps;

	let leaf = anchor;
	for (const [i, { node, file }] of shown.entries()) {
		if (i > 0) leaf = workspace.createLeafBySplit(leaf, "vertical");
		// Register before opening so this isn't recorded as a new visit.
		plugin.recorder.assign(leaf, node.id, file.path);
		if (file instanceof TFile) await leaf.openFile(file);
		else await showFolder(plugin, leaf, file.path, null);
	}
	workspace.setActiveLeaf(leaf, { focus: true });
	if (plugin.isActive()) enforcePaneLimit(workspace, max);
}
