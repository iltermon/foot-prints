import { Platform, Plugin } from "obsidian";
import { registerCommands } from "./commands";
import { FootPrintsSettings, FootPrintsSettingTab, sanitizeSettings } from "./settings";
import { installLinkInterceptor } from "./workspace/link-interceptor";
import { PaneStack } from "./workspace/pane-stack";

export default class FootPrintsPlugin extends Plugin {
	settings: FootPrintsSettings;
	private paneStack: PaneStack;

	async onload() {
		this.settings = sanitizeSettings(await this.loadData() as Partial<FootPrintsSettings> | null);

		this.paneStack = new PaneStack(this);
		this.paneStack.load();
		installLinkInterceptor(this);
		registerCommands(this);
		this.addSettingTab(new FootPrintsSettingTab(this.app, this));
	}

	/** Phones only ever show one pane, so the sideways layout makes no sense there. */
	isActive(): boolean {
		return this.settings.enabled && !Platform.isPhone;
	}

	async updateSettings(patch: Partial<FootPrintsSettings>): Promise<void> {
		this.settings = sanitizeSettings({ ...this.settings, ...patch });
		await this.saveData(this.settings);
		this.paneStack.refresh();
	}
}
