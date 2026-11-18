import { debounce, ItemView, Keymap, setIcon, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import type FootPrintsPlugin from "../main";
import type { HistoryNode, HistoryTree } from "../history/store";

export const OVERVIEW_VIEW_TYPE = "foot-prints-overview";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
	"August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A timeline of reading threads, grouped by day, drawn as branching trees. */
export class OverviewView extends ItemView {
	private requestRender = debounce(() => this.render(), 200, true);

	constructor(leaf: WorkspaceLeaf, private plugin: FootPrintsPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return OVERVIEW_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Overview";
	}

	getIcon(): string {
		return "footprints";
	}

	async onOpen(): Promise<void> {
		this.registerEvent(this.plugin.history.on("changed", this.requestRender));
		this.registerEvent(this.app.vault.on("delete", this.requestRender));
		this.registerEvent(this.app.vault.on("create", this.requestRender));
		this.render();
	}

	async onClose(): Promise<void> {
		this.requestRender.cancel();
	}

	render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass("fp-overview");

		const days = groupByDay(this.plugin.history.threads());
		if (days.length === 0) {
			root.createDiv({
				cls: "fp-overview-empty",
				text: "No history yet. Open a note and follow its links to start a thread.",
			});
			return;
		}

		for (const day of days) {
			const dayEl = root.createDiv({ cls: "fp-day" });
			const label = dayEl.createDiv({ cls: "fp-day-label" });
			label.createDiv({ cls: "fp-day-weekday", text: WEEKDAYS[day.date.getDay()] });
			label.createDiv({ cls: "fp-day-date", text: longDate(day.date) });

			const threadsEl = dayEl.createDiv({ cls: "fp-day-threads" });
			let lastTime = "";
			day.threads.forEach((thread, i) => {
				const row = threadsEl.createDiv({ cls: "fp-thread" });
				const when = row.createDiv({ cls: "fp-thread-when" });
				const opened = new Date(thread.node.openedAt);
				if (i === 0) when.createDiv({ cls: "fp-thread-date", text: shortDate(opened) });
				const time = clockTime(opened);
				if (time !== lastTime) when.createDiv({ cls: "fp-thread-time", text: time });
				lastTime = time;
				this.renderTree(row.createDiv({ cls: "fp-tree" }), thread);
			});
		}
	}

	private renderTree(parentEl: HTMLElement, tree: HistoryTree): void {
		const nodeEl = parentEl.createDiv({ cls: "fp-tree-node" });
		this.renderChip(nodeEl, tree.node);
		if (tree.children.length === 0) return;
		const childrenEl = nodeEl.createDiv({ cls: "fp-tree-children" });
		childrenEl.toggleClass("is-single", tree.children.length === 1);
		for (const child of tree.children) {
			this.renderTree(childrenEl.createDiv({ cls: "fp-tree-child" }), child);
		}
	}

	private renderChip(parentEl: HTMLElement, node: HistoryNode): void {
		const file = this.app.vault.getAbstractFileByPath(node.path);
		const isFolder = node.kind === "folder";
		const exists = isFolder ? file instanceof TFolder : file instanceof TFile;
		const name = file instanceof TFile ? file.basename : file instanceof TFolder && !file.isRoot() ? file.name : basename(node.path);

		const chip = parentEl.createDiv({ cls: "fp-chip" });
		chip.toggleClass("is-missing", !exists);
		chip.setAttr("aria-label", exists ? node.path : `${node.path} (deleted)`);
		const icon = isFolder ? (exists ? "folder" : "folder-x") : exists ? "file-text" : "file-x";
		setIcon(chip.createSpan({ cls: "fp-chip-icon" }), icon);
		chip.createSpan({ cls: "fp-chip-title", text: name });
		if (!exists) return;

		chip.addEventListener("click", (evt) => {
			if (file instanceof TFile && Keymap.isModEvent(evt)) {
				void this.app.workspace.getLeaf(Keymap.isModEvent(evt)).openFile(file);
			} else {
				void this.plugin.openTrail(node.id, this.leaf);
			}
		});
		if (isFolder) return;
		chip.addEventListener("mouseover", (evt) => {
			this.app.workspace.trigger("hover-link", {
				event: evt,
				source: OVERVIEW_VIEW_TYPE,
				hoverParent: this,
				targetEl: chip,
				linktext: node.path,
			});
		});
	}
}

interface Day {
	date: Date;
	threads: HistoryTree[];
}

/** Newest day first; threads within a day oldest first. */
function groupByDay(threads: HistoryTree[]): Day[] {
	const days = new Map<string, Day>();
	for (const thread of threads) {
		const date = new Date(thread.node.openedAt);
		const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
		let day = days.get(key);
		if (!day) {
			day = { date, threads: [] };
			days.set(key, day);
		}
		day.threads.push(thread);
	}
	return [...days.values()]
		.map((d) => ({ ...d, threads: d.threads.sort((a, b) => a.node.openedAt - b.node.openedAt) }))
		.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function longDate(d: Date): string {
	return `${MONTHS[d.getMonth()]} ${d.getDate()}${ordinal(d.getDate())}, ${d.getFullYear()}`;
}

function shortDate(d: Date): string {
	return `${MONTHS[d.getMonth()]?.slice(0, 3)} ${d.getDate()} ${d.getFullYear()}`;
}

function clockTime(d: Date): string {
	const h = d.getHours() % 12 || 12;
	const m = String(d.getMinutes()).padStart(2, "0");
	return `${h}:${m}${d.getHours() < 12 ? "am" : "pm"}`;
}

function ordinal(n: number): string {
	if (n % 100 >= 11 && n % 100 <= 13) return "th";
	return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

function basename(path: string): string {
	const name = path.split("/").pop() ?? path;
	return name.replace(/\.md$/, "");
}
