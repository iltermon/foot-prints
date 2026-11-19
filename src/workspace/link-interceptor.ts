import { getLinkpath, OpenViewState, PaneType, Workspace, WorkspaceLeaf } from "obsidian";
import type FootPrintsPlugin from "../main";
import { visibleLeaf } from "../types";
import { closePanesAfter, filePathOf, isRootLeaf, paneIndexOf, rootPanes } from "./panes";

type OpenLinkText = Workspace["openLinkText"];

/**
 * Wrap `workspace.openLinkText` so a plain link click opens the target in a pane
 * to the right of the note it was clicked in. Modifier clicks (new tab, split,
 * window) are left to Obsidian.
 */
export function installLinkInterceptor(plugin: FootPrintsPlugin): void {
	const workspace = plugin.app.workspace;
	// eslint-disable-next-line @typescript-eslint/unbound-method -- re-bound via .call below
	const original: OpenLinkText = workspace.openLinkText;

	const patched: OpenLinkText = async function (
		this: Workspace,
		linktext: string,
		sourcePath: string,
		newLeaf?: PaneType | boolean,
		state?: OpenViewState,
	) {
		const openHere = (): Promise<void> => original.call(this, linktext, sourcePath, false, state);
		const source = sourceLeaf(plugin, sourcePath);
		if (!source) return original.call(this, linktext, sourcePath, newLeaf, state);
		plugin.recorder.linkFollowed(source);
		try {
			if (plugin.isActive() && !newLeaf) {
				try {
					if (await openSideways(plugin, source, linktext, sourcePath, openHere)) return;
				} catch (err) {
					console.error("Foot prints: falling back to default link opening", err);
				}
			}
			return await original.call(this, linktext, sourcePath, newLeaf, state);
		} finally {
			plugin.recorder.linkSettled();
		}
	};

	workspace.openLinkText = patched;
	plugin.register(() => {
		if (workspace.openLinkText === patched) workspace.openLinkText = original;
	});
}

/**
 * The main-area leaf a link was clicked in, or null for links from the sidebar,
 * hover popovers, etc. (those keep their default behavior).
 */
function sourceLeaf(plugin: FootPrintsPlugin, sourcePath: string): WorkspaceLeaf | null {
	const { workspace } = plugin.app;
	const leaf = workspace.getMostRecentLeaf(workspace.rootSplit);
	if (!leaf || !isRootLeaf(workspace, leaf) || filePathOf(leaf) !== sourcePath) return null;
	return leaf;
}

async function openSideways(
	plugin: FootPrintsPlugin,
	source: WorkspaceLeaf,
	linktext: string,
	sourcePath: string,
	openInActiveLeaf: () => Promise<void>,
): Promise<boolean> {
	const { workspace, metadataCache } = plugin.app;

	const index = paneIndexOf(workspace, source);
	if (index < 0) return false;

	const target = metadataCache.getFirstLinkpathDest(getLinkpath(linktext), sourcePath);
	const nextPane = rootPanes(workspace)[index + 1];
	const nextLeaf = nextPane ? visibleLeaf(nextPane) : null;

	if (target && nextLeaf && filePathOf(nextLeaf) === target.path) {
		// Already the next note in the thread: keep it, drop what comes after.
		closePanesAfter(workspace, index + 1);
		workspace.setActiveLeaf(nextLeaf, { focus: true });
	} else if (target && target.path === sourcePath) {
		// Link to a heading/block in the same note: navigate in place.
		return false;
	} else {
		closePanesAfter(workspace, index);
		const leaf = workspace.createLeafBySplit(source, "vertical");
		workspace.setActiveLeaf(leaf, { focus: true });
	}

	// Let Obsidian do the actual opening in the (now active) leaf, so headings,
	// block refs and "create note from unresolved link" all keep working.
	await openInActiveLeaf();
	return true;
}
