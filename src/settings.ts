import { App, PluginSettingTab, Setting } from "obsidian";
import type FootPrintsPlugin from "./main";

export interface FootPrintsSettings {
	/** Open links in a new pane to the right instead of replacing the current note. */
	enabled: boolean;
	/** Width of each pane, in pixels. */
	paneWidth: number;
	/** Collapse panes that scroll off-screen into narrow title spines. */
	stackPanes: boolean;
	/** Width of a collapsed pane spine, in pixels. */
	spineWidth: number;
}

export const DEFAULT_SETTINGS: FootPrintsSettings = {
	enabled: true,
	paneWidth: 700,
	stackPanes: true,
	spineWidth: 32,
};

const LIMITS = {
	paneWidth: { min: 300, max: 2000 },
	spineWidth: { min: 16, max: 80 },
};

export function sanitizeSettings(raw: Partial<FootPrintsSettings> | null): FootPrintsSettings {
	const s = Object.assign({}, DEFAULT_SETTINGS, raw ?? {});
	s.paneWidth = clampNumber(s.paneWidth, LIMITS.paneWidth, DEFAULT_SETTINGS.paneWidth);
	s.spineWidth = clampNumber(s.spineWidth, LIMITS.spineWidth, DEFAULT_SETTINGS.spineWidth);
	s.enabled = Boolean(s.enabled);
	s.stackPanes = Boolean(s.stackPanes);
	return s;
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
	}

	private numberSetting(name: string, desc: string, key: "paneWidth" | "spineWidth"): void {
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
