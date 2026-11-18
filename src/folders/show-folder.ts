import { WorkspaceLeaf } from "obsidian";
import { FOLDER_VIEW_TYPE } from "../constants";
import type FootPrintsPlugin from "../main";

/** Turn `leaf` into a folder pane. `parent` is the pane it was opened from, if any. */
export async function showFolder(
	plugin: FootPrintsPlugin,
	leaf: WorkspaceLeaf,
	path: string,
	parent: WorkspaceLeaf | null,
): Promise<void> {
	plugin.recorder.folderOpened(leaf, path, parent);
	await leaf.setViewState({ type: FOLDER_VIEW_TYPE, state: { path }, active: true });
}

/** Open a folder from outside the main area (explorer, command, menu): like opening a note. */
export async function openFolder(plugin: FootPrintsPlugin, path: string): Promise<void> {
	const leaf = plugin.app.workspace.getLeaf(false);
	await showFolder(plugin, leaf, path, null);
	plugin.app.workspace.setActiveLeaf(leaf, { focus: true });
}
