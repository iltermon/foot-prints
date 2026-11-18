import { debounce, ItemView, Keymap, setIcon, TAbstractFile, TFile, TFolder, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { FOLDER_VIEW_TYPE } from "../constants";
import type FootPrintsPlugin from "../main";
import { visibleLeaf } from "../types";
import { openBeside } from "../workspace/open-beside";
import { paneIndexOf, pathOf, rootPanes } from "../workspace/panes";
import { showFolder } from "./show-folder";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** A pane listing a folder's contents. Selecting an entry opens it to the right. */
export class FolderView extends ItemView {
	folderPath = "";
	/** Lets explorer clicks and links replace this pane, like a note. */
	navigation = true;
	private requestRender = debounce(() => this.render(), 100, true);

	constructor(leaf: WorkspaceLeaf, private plugin: FootPrintsPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return FOLDER_VIEW_TYPE;
	}

	getDisplayText(): string {
		const folder = this.folder();
		if (folder?.isRoot()) return this.app.vault.getName();
		return folder?.name ?? this.folderPath.split("/").pop() ?? "Folder";
	}

	getIcon(): string {
		return "folder";
	}

	getState(): Record<string, unknown> {
		return { path: this.folderPath };
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const path = (state as { path?: unknown } | null)?.path;
		if (typeof path === "string") this.folderPath = path;
		this.render();
		await super.setState(state, result);
	}

	async onOpen(): Promise<void> {
		const { vault, workspace } = this.app;
		this.registerEvent(vault.on("create", this.requestRender));
		this.registerEvent(vault.on("delete", this.requestRender));
		this.registerEvent(
			vault.on("rename", (file, oldPath) => {
				if (oldPath === this.folderPath) this.folderPath = file.path;
				else if (this.folderPath.startsWith(oldPath + "/")) {
					this.folderPath = file.path + this.folderPath.slice(oldPath.length);
				}
				this.requestRender();
			}),
		);
		this.registerEvent(workspace.on("layout-change", () => this.markOpenEntry()));
		this.registerEvent(workspace.on("active-leaf-change", () => this.markOpenEntry()));
		this.render();
	}

	async onClose(): Promise<void> {
		this.requestRender.cancel();
	}

	private folder(): TFolder | null {
		const f = this.app.vault.getAbstractFileByPath(this.folderPath || "/");
		return f instanceof TFolder ? f : null;
	}

	private render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass("fp-folder");

		const folder = this.folder();
		root.createEl("h2", { cls: "fp-folder-title", text: this.getDisplayText() });
		if (!folder) {
			root.createDiv({ cls: "fp-folder-empty", text: "This folder no longer exists." });
			return;
		}

		const entries = [...folder.children].sort((a, b) => {
			const af = a instanceof TFolder, bf = b instanceof TFolder;
			if (af !== bf) return af ? -1 : 1;
			return collator.compare(displayName(a), displayName(b));
		});
		if (entries.length === 0) {
			root.createDiv({ cls: "fp-folder-empty", text: "This folder is empty." });
			return;
		}

		const list = root.createDiv({ cls: "fp-folder-list" });
		for (const entry of entries) this.renderEntry(list, entry);
		this.markOpenEntry();
	}

	private renderEntry(list: HTMLElement, entry: TAbstractFile): void {
		const isFolder = entry instanceof TFolder;
		const row = list.createDiv({ cls: "fp-folder-entry" });
		row.dataset.path = entry.path;
		setIcon(row.createSpan({ cls: "fp-chip-icon" }), isFolder ? "folder" : iconFor(entry));
		row.createSpan({ cls: "fp-folder-entry-name", text: displayName(entry) });
		if (isFolder) row.createSpan({ cls: "fp-folder-entry-count", text: String(entry.children.length) });

		row.addEventListener("click", (evt) => {
			if (entry instanceof TFile && Keymap.isModEvent(evt)) {
				void this.app.workspace.getLeaf(Keymap.isModEvent(evt)).openFile(entry);
				return;
			}
			void this.openEntry(entry);
		});
		if (entry instanceof TFile) {
			row.addEventListener("mouseover", (evt) => {
				this.app.workspace.trigger("hover-link", {
					event: evt,
					source: FOLDER_VIEW_TYPE,
					hoverParent: this,
					targetEl: row,
					linktext: entry.path,
				});
			});
		}
	}

	private async openEntry(entry: TAbstractFile): Promise<void> {
		const plugin = this.plugin;
		if (entry instanceof TFolder) {
			await openBeside(plugin, this.leaf, entry.path, (leaf) => showFolder(plugin, leaf, entry.path, this.leaf));
		} else if (entry instanceof TFile) {
			plugin.recorder.linkFollowed(this.leaf);
			await openBeside(plugin, this.leaf, entry.path, (leaf) => leaf.openFile(entry));
		}
	}

	/** Highlight the entry shown in the pane to the right. */
	private markOpenEntry(): void {
		const { workspace } = this.app;
		const index = paneIndexOf(workspace, this.leaf);
		const next = index >= 0 ? rootPanes(workspace)[index + 1] : undefined;
		const openPath = next ? pathOf(visibleLeaf(next)) : null;
		this.contentEl.querySelectorAll<HTMLElement>(".fp-folder-entry").forEach((row) => {
			row.toggleClass("is-active", row.dataset.path === openPath);
		});
	}
}

function displayName(file: TAbstractFile): string {
	return file instanceof TFile && file.extension === "md" ? file.basename : file.name;
}

function iconFor(file: TAbstractFile): string {
	if (!(file instanceof TFile)) return "file";
	if (file.extension === "md") return "file-text";
	if (file.extension === "canvas") return "layout-dashboard";
	if (file.extension === "pdf") return "file-type";
	if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(file.extension)) return "image";
	return "file";
}
