import { debounce, Platform, Plugin, WorkspaceLeaf } from "obsidian";
import { registerCommands } from "./commands";
import { registerFolders } from "./folders";
import { openTrail } from "./history/open-trail";
import { HistoryRecorder } from "./history/recorder";
import { HistoryData, HistoryStore } from "./history/store";
import { FootPrintsSettings, FootPrintsSettingTab, sanitizeSettings } from "./settings";
import { OVERVIEW_VIEW_TYPE, OverviewView } from "./ui/overview-view";
import { installLinkInterceptor } from "./workspace/link-interceptor";
import { PaneStack } from "./workspace/pane-stack";

type StoredData = Partial<FootPrintsSettings> & { history?: Partial<HistoryData> };

export default class FootPrintsPlugin extends Plugin {
	settings: FootPrintsSettings;
	history: HistoryStore;
	recorder: HistoryRecorder;
	private paneStack: PaneStack;
	private requestSave = debounce(() => void this.persist(), 2000, true);

	async onload() {
		const data = (await this.loadData()) as StoredData | null;
		this.settings = sanitizeSettings(data);
		this.history = new HistoryStore();
		this.history.load(data?.history, this.settings.historyDays);
		this.registerEvent(this.history.on("changed", () => this.requestSave()));
		this.register(() => this.requestSave.run());

		this.recorder = new HistoryRecorder(this, this.history);
		this.recorder.load();
		this.paneStack = new PaneStack(this);
		this.paneStack.load();
		installLinkInterceptor(this);

		registerFolders(this);
		this.registerView(OVERVIEW_VIEW_TYPE, (leaf) => new OverviewView(leaf, this));
		this.registerHoverLinkSource(OVERVIEW_VIEW_TYPE, { display: "Foot Prints overview", defaultMod: false });
		this.addRibbonIcon("footprints", "Open overview", () => void this.openOverview());
		registerCommands(this);
		this.addSettingTab(new FootPrintsSettingTab(this.app, this));
	}

	/** Phones only ever show one pane, so the sideways layout makes no sense there. */
	isActive(): boolean {
		return this.settings.enabled && !Platform.isPhone;
	}

	async updateSettings(patch: Partial<FootPrintsSettings>): Promise<void> {
		this.settings = sanitizeSettings({ ...this.settings, ...patch });
		this.history.prune(this.settings.historyDays);
		await this.persist();
		this.paneStack.refresh();
	}

	async openOverview(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(OVERVIEW_VIEW_TYPE)[0];
		const leaf = existing ?? workspace.getLeaf("tab");
		if (!existing) await leaf.setViewState({ type: OVERVIEW_VIEW_TYPE, active: true });
		await workspace.revealLeaf(leaf);
		workspace.setActiveLeaf(leaf, { focus: true });
	}

	openTrail(nodeId: string, from: WorkspaceLeaf): Promise<void> {
		return openTrail(this, nodeId, from);
	}

	private async persist(): Promise<void> {
		const data: StoredData = { ...this.settings, history: this.history.serialize() };
		await this.saveData(data);
	}
}
