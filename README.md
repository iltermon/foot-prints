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

## Commands

| Command | |
| --- | --- |
| Open overview | Show the history timeline |
| Toggle sideways panes | Turn the sideways layout on or off |
| Close panes to the right | Close every pane after the current one |
| Focus previous pane / Focus next pane | Move between panes |

## Settings

- **Sideways panes**: turn the sideways layout on or off.
- **Pane width**: the width of each pane in pixels.
- **Stack panes** and **Spine width**: whether off-screen panes collapse into spines, and how wide the spines are.
- **Record history**, **Keep history for**, **Clear history**: control the overview's history.

Sideways panes are turned off on phones, because phones show one pane at a time.

## Development

```bash
npm install
npm run dev     # watch build
npm run build   # type-check + production build
npm run lint
```

To test the plugin, copy `main.js`, `manifest.json` and `styles.css` to `<Vault>/.obsidian/plugins/foot-prints/`. Then reload Obsidian and turn on the plugin in **Settings → Community plugins**.
