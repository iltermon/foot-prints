import { getLinkpath, OpenViewState, PaneType, Workspace } from "obsidian";
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
		if (plugin.isActive() && !newLeaf) {
			try {
				if (await openSideways(plugin, linktext, sourcePath, openHere)) return;
			} catch (err) {
				console.error("Foot prints: falling back to default link opening", err);
			}
		}
		return original.call(this, linktext, sourcePath, newLeaf, state);
	};

	workspace.openLinkText = patched;
	plugin.register(() => {
		if (workspace.openLinkText === patched) workspace.openLinkText = original;
	});
}

async function openSideways(
	plugin: FootPrintsPlugin,
	linktext: string,
	sourcePath: string,
	openInActiveLeaf: () => Promise<void>,
): Promise<boolean> {
	const { workspace, metadataCache } = plugin.app;

	// Only handle links clicked inside a note in the main area. Links from the
	// sidebar, hover popovers, etc. keep their default behavior.
	const source = workspace.getMostRecentLeaf(workspace.rootSplit);
	if (!source || !isRootLeaf(workspace, source) || filePathOf(source) !== sourcePath) return false;

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
