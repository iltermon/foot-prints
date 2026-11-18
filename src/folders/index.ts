import { FuzzySuggestModal, TFolder } from "obsidian";
import { FOLDER_VIEW_TYPE } from "../constants";
import type FootPrintsPlugin from "../main";
import { FolderView } from "./folder-view";
import { openFolder } from "./show-folder";

/** Folder panes: the view, the explorer hook, a context-menu item and a command. */
export function registerFolders(plugin: FootPrintsPlugin): void {
	const { workspace } = plugin.app;
	plugin.registerView(FOLDER_VIEW_TYPE, (leaf) => new FolderView(leaf, plugin));
	plugin.registerHoverLinkSource(FOLDER_VIEW_TYPE, { display: "Foot Prints folder panes", defaultMod: false });

	plugin.registerEvent(
		workspace.on("file-menu", (menu, file) => {
			if (!(file instanceof TFolder)) return;
			menu.addItem((item) =>
				item
					.setTitle("Open as pane")
					.setIcon("folder-open")
					.onClick(() => void openFolder(plugin, file.path)),
			);
		}),
	);

	plugin.addCommand({
		id: "open-folder",
		name: "Open folder as pane",
		callback: () => new FolderSuggestModal(plugin).open(),
	});

	// Selecting a folder name in the file explorer also opens it as a pane. The
	// explorer still expands/collapses it as usual.
	plugin.registerDomEvent(document, "click", (evt) => {
		if (!plugin.settings.openFoldersFromExplorer || !plugin.isActive()) return;
		if (evt.button !== 0 || evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey) return;
		const target = evt.target;
		if (!(target instanceof Element)) return;
		if (target.closest(".collapse-icon, .nav-folder-collapse-indicator")) return;
		const title = target.closest<HTMLElement>(".nav-folder-title[data-path]");
		if (!title || !title.closest('.workspace-leaf-content[data-type="file-explorer"]')) return;
		if (title.querySelector("input, [contenteditable='true']")) return; // renaming
		const path = title.dataset.path;
		if (path) void openFolder(plugin, path);
	});
}

class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	constructor(private plugin: FootPrintsPlugin) {
		super(plugin.app);
		this.setPlaceholder("Open folder as pane…");
	}

	getItems(): TFolder[] {
		return this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder);
	}

	getItemText(folder: TFolder): string {
		return folder.isRoot() ? "/" : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		void openFolder(this.plugin, folder.path);
	}
}
