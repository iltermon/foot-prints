import type FootPrintsPlugin from "../main";
import { visibleLeaf } from "../types";
import { closePanesAfter, paneIndexOf, rootPanes } from "../workspace/panes";

export function registerCommands(plugin: FootPrintsPlugin): void {
	const { workspace } = plugin.app;

	const activeIndex = (): number => {
		const leaf = workspace.getMostRecentLeaf(workspace.rootSplit);
		return leaf ? paneIndexOf(workspace, leaf) : -1;
	};

	const focusPane = (offset: number) => (checking: boolean): boolean => {
		const index = activeIndex();
		const pane = index >= 0 ? rootPanes(workspace)[index + offset] : undefined;
		const leaf = pane ? visibleLeaf(pane) : null;
		if (!plugin.isActive() || !leaf) return false;
		if (!checking) workspace.setActiveLeaf(leaf, { focus: true });
		return true;
	};

	plugin.addCommand({
		id: "toggle-sideways-panes",
		name: "Toggle sideways panes",
		callback: async () => {
			await plugin.updateSettings({ enabled: !plugin.settings.enabled });
		},
	});

	plugin.addCommand({
		id: "close-panes-to-right",
		name: "Close panes to the right",
		checkCallback: (checking) => {
			const index = activeIndex();
			if (index < 0 || index >= rootPanes(workspace).length - 1) return false;
			if (!checking) closePanesAfter(workspace, index);
			return true;
		},
	});

	plugin.addCommand({
		id: "focus-previous-pane",
		name: "Focus previous pane",
		checkCallback: focusPane(-1),
	});

	plugin.addCommand({
		id: "focus-next-pane",
		name: "Focus next pane",
		checkCallback: focusPane(1),
	});
}
