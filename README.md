# Foot Prints

An Obsidian plugin that brings [Tangent](https://www.tangentnotes.com)-style browsing to Obsidian.

## Sideways panes

Select a link in a note and the linked note opens in a **new pane to the right**. Any panes further right are closed, so the row of panes is always the trail of links you followed, like a thread.

- The main area scrolls sideways, and every pane has a fixed width.
- Panes that scroll off either edge collapse into narrow **spines** that show the note title. Select a spine to bring its pane back.
- If the link points to the note that is already open in the next pane, that pane is focused instead of reopened.
- Modifier-clicks (new tab, split, new window) work as they normally do in Obsidian.

## Overview

Select the footprints ribbon icon, or run **Foot Prints: Open overview**, to see a timeline of your reading. The timeline is grouped by day, and each thread is drawn as a tree. A branch appears wherever you followed more than one link from the same note.

- Select a note to reopen its whole thread, from the note where the thread started to the note you selected, as sideways panes.
- Mod-click opens just that note in a new tab. Hover with the page-preview modifier to preview a note.

History is kept **only in this vault's plugin data** (`.obsidian/plugins/foot-prints/data.json`) and is never sent anywhere. You can turn it off, choose how long to keep it, or clear it in **Settings → Foot Prints**.

## Folders

Folders can open as panes too. A folder pane lists the folder's notes and subfolders. Selecting an entry opens it in a pane to the right, and the entry that's open there is highlighted. Folders are part of your threads, so they appear in the overview with a folder icon.

There are three ways to open a folder as a pane:

- Select a folder name in the file explorer. The folder still expands or collapses as usual. You can turn this off in settings.
- Right-click a folder and select **Open as pane**.
- Run **Foot Prints: Open folder as pane**.

## Commands

| Command | |
| --- | --- |
| Open overview | Show the history timeline |
| Open folder as pane | Pick a folder to open as a pane |
| Toggle sideways panes | Turn the sideways layout on or off |
| Close panes to the right | Close every pane after the current one |
| Focus previous pane / Focus next pane | Move between panes |

## Settings

- **Sideways panes**: turn the sideways layout on or off.
- **Pane width**: the width of each pane in pixels.
- **Stack panes** and **Spine width**: whether off-screen panes collapse into spines, and how wide the spines are.
- **Open folders from the file explorer**: whether selecting a folder in the file explorer opens it as a pane.
- **Record history**, **Keep history for**, **Clear history**: control the overview's history.

Sideways panes are turned off on phones, because phones show one pane at a time.

## Installation

### With BRAT (beta)

1. Install **BRAT** from **Settings → Community plugins → Browse** and turn it on.
2. Run **BRAT: Add a beta plugin for testing** and enter `iltermon/foot-prints`.
3. Turn on **Foot Prints** in **Settings → Community plugins**.

BRAT checks for new releases and updates the plugin for you.

### Manually

Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/iltermon/foot-prints/releases/latest). Put them in `<Vault>/.obsidian/plugins/foot-prints/`, then turn on the plugin.

## Releasing

1. Bump the version with `npm version patch` (or `minor` or `major`). This updates `manifest.json` and `versions.json`.
2. Merge the change into `master`.
3. The **Release** workflow sees the new version, builds the plugin, and publishes a GitHub release tagged with that version. The three files are attached to it.

You can also start the workflow by pushing a matching tag (for example `1.0.1`, with no leading `v`). Or run it manually from the **Actions** tab. A version with a suffix, like `1.1.0-beta.1`, is published as a pre-release.

## Development

```bash
npm install
npm run dev     # watch build
npm run build   # type-check + production build
npm run lint
```

To test the plugin, copy `main.js`, `manifest.json` and `styles.css` to `<Vault>/.obsidian/plugins/foot-prints/`. Then reload Obsidian and turn on the plugin in **Settings → Community plugins**.
