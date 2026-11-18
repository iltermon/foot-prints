import { App, PluginSettingTab, Setting } from "obsidian";
import type FootPrintsPlugin from "./main";

export interface FootPrintsSettings {
	/** Open links in a new pane to the right instead of replacing the current note. */
	enabled: boolean;
	/** Width of each pane, in pixels. */
	paneWidth: number;
	/** Most panes kept open; opening another closes the leftmost (0 = no limit). */
	maxPanes: number;
	/** Collapse panes that scroll off-screen into narrow title spines. */
	stackPanes: boolean;
	/** Width of a collapsed pane spine, in pixels. */
	spineWidth: number;
	/** Selecting a folder in the file explorer opens it as a folder pane. */
	openFoldersFromExplorer: boolean;
	/** Keep a local history of visited notes for the overview. */
	recordHistory: boolean;
	/** Forget threads older than this many days (0 keeps everything). */
	historyDays: number;
}

export const DEFAULT_SETTINGS: FootPrintsSettings = {
	enabled: true,
	paneWidth: 700,
	maxPanes: 3,
	stackPanes: true,
	spineWidth: 32,
	openFoldersFromExplorer: true,
	recordHistory: true,
	historyDays: 30,
};

const LIMITS = {
	paneWidth: { min: 300, max: 2000 },
	maxPanes: { min: 0, max: 50 },
	spineWidth: { min: 16, max: 80 },
	historyDays: { min: 0, max: 3650 },
};

export function sanitizeSettings(raw: Partial<FootPrintsSettings> | null | undefined): FootPrintsSettings {
	const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
	const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
	return {
		enabled: bool(s.enabled, DEFAULT_SETTINGS.enabled),
		paneWidth: clampNumber(s.paneWidth, LIMITS.paneWidth, DEFAULT_SETTINGS.paneWidth),
		maxPanes: clampNumber(s.maxPanes, LIMITS.maxPanes, DEFAULT_SETTINGS.maxPanes),
		stackPanes: bool(s.stackPanes, DEFAULT_SETTINGS.stackPanes),
		spineWidth: clampNumber(s.spineWidth, LIMITS.spineWidth, DEFAULT_SETTINGS.spineWidth),
		openFoldersFromExplorer: bool(s.openFoldersFromExplorer, DEFAULT_SETTINGS.openFoldersFromExplorer),
		recordHistory: bool(s.recordHistory, DEFAULT_SETTINGS.recordHistory),
		historyDays: clampNumber(s.historyDays, LIMITS.historyDays, DEFAULT_SETTINGS.historyDays),
	};
}

function clampNumber(value: unknown, range: { min: number; max: number }, fallback: number): number {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(range.max, Math.max(range.min, Math.round(n)));
}

export class FootPrintsSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: FootPrintsPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Sideways panes")
			.setDesc("Open links in a new pane to the right of the current note. Panes further right are closed, like a thread.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enabled).onChange(async (v) => {
					await this.plugin.updateSettings({ enabled: v });
				}),
			);

		this.numberSetting(
			"Pane width",
			`Width of each pane in pixels (${LIMITS.paneWidth.min}–${LIMITS.paneWidth.max}).`,
			"paneWidth",
		);

		this.numberSetting(
			"Maximum panes",
			"Most panes kept open. Opening another closes the leftmost one. Set to 0 for no limit.",
			"maxPanes",
		);

		new Setting(containerEl)
			.setName("Stack panes")
			.setDesc("Collapse panes that scroll off-screen into narrow spines showing their title.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.stackPanes).onChange(async (v) => {
					await this.plugin.updateSettings({ stackPanes: v });
				}),
			);

		this.numberSetting(
			"Spine width",
			`Width of a collapsed pane in pixels (${LIMITS.spineWidth.min}–${LIMITS.spineWidth.max}).`,
			"spineWidth",
		);

		new Setting(containerEl)
			.setName("Open folders from the file explorer")
			.setDesc("Selecting a folder name in the file explorer also opens it as a pane listing its contents.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.openFoldersFromExplorer).onChange(async (v) => {
					await this.plugin.updateSettings({ openFoldersFromExplorer: v });
				}),
			);

		new Setting(containerEl).setName("History").setHeading();

		new Setting(containerEl)
			.setName("Record history")
			.setDesc("Remember which notes you open and the links you follow, for the overview. Stored only in this vault's plugin data.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.recordHistory).onChange(async (v) => {
					await this.plugin.updateSettings({ recordHistory: v });
				}),
			);

		this.numberSetting(
			"Keep history for",
			"Days to keep threads in the overview. Set to 0 to keep them forever.",
			"historyDays",
		);

		new Setting(containerEl)
			.setName("Clear history")
			.setDesc("Remove every thread from the overview.")
			.addButton((b) =>
				b.setButtonText("Clear").setWarning().onClick(() => {
					this.plugin.history.clear();
				}),
			);
	}

	private numberSetting(name: string, desc: string, key: "paneWidth" | "maxPanes" | "spineWidth" | "historyDays"): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((t) => {
				t.inputEl.type = "number";
				t.setValue(String(this.plugin.settings[key]));
				// Apply on blur so typing "7" on the way to "700" doesn't get clamped.
				t.inputEl.addEventListener("blur", () => {
					void this.plugin.updateSettings({ [key]: Number(t.getValue()) }).then(() => {
						t.setValue(String(this.plugin.settings[key]));
					});
				});
			});
	}
}
