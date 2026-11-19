import { Events } from "obsidian";

export interface HistoryNode {
	id: string;
	path: string;
	/** Node this note was opened from via a link; null starts a new thread. */
	parentId: string | null;
	/** Epoch milliseconds. */
	openedAt: number;
	/** Set for folder panes; absent for notes and other files. */
	kind?: "folder";
}

export interface HistoryData {
	nodes: HistoryNode[];
}

export interface HistoryTree {
	node: HistoryNode;
	children: HistoryTree[];
}

const MAX_NODES = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Navigation history as a forest: each root is a thread start (a note opened
 * from the file explorer, quick switcher, etc.), children are notes reached by
 * following links. Fires "changed" whenever it is modified.
 */
export class HistoryStore extends Events {
	private nodes: HistoryNode[] = [];
	private byId = new Map<string, HistoryNode>();

	load(data: Partial<HistoryData> | undefined, retentionDays: number): void {
		const nodes = Array.isArray(data?.nodes) ? data.nodes.filter(isNode) : [];
		this.setNodes(nodes);
		this.prune(retentionDays);
	}

	serialize(): HistoryData {
		return { nodes: this.nodes };
	}

	get(id: string): HistoryNode | undefined {
		return this.byId.get(id);
	}

	add(path: string, parentId: string | null, isFolder = false): HistoryNode {
		const node: HistoryNode = {
			id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
			path,
			parentId: parentId && this.byId.has(parentId) ? parentId : null,
			openedAt: Date.now(),
		};
		if (isFolder) node.kind = "folder";
		this.nodes.push(node);
		this.byId.set(node.id, node);
		if (this.nodes.length > MAX_NODES) this.setNodes(this.nodes.slice(-MAX_NODES));
		this.trigger("changed");
		return node;
	}

	/** Attach `id` under `parentId` (ignored if that would form a cycle). */
	setParent(id: string, parentId: string): void {
		const node = this.byId.get(id);
		if (!node || !this.byId.has(parentId) || this.trail(parentId).some((n) => n.id === id)) return;
		node.parentId = parentId;
		this.trigger("changed");
	}

	/** Root → … → node. */
	trail(id: string): HistoryNode[] {
		const trail: HistoryNode[] = [];
		let node = this.byId.get(id);
		while (node) {
			trail.unshift(node);
			node = node.parentId ? this.byId.get(node.parentId) : undefined;
		}
		return trail;
	}

	/** Thread trees, oldest first. */
	threads(): HistoryTree[] {
		const trees = new Map<string, HistoryTree>();
		for (const node of this.nodes) trees.set(node.id, { node, children: [] });
		const roots: HistoryTree[] = [];
		for (const node of this.nodes) {
			const tree = trees.get(node.id);
			if (!tree) continue;
			const parent = node.parentId ? trees.get(node.parentId) : undefined;
			(parent ? parent.children : roots).push(tree);
		}
		return roots;
	}

	/** Follow a file or folder rename. */
	renamePath(oldPath: string, newPath: string): void {
		let changed = false;
		for (const node of this.nodes) {
			if (node.path === oldPath) {
				node.path = newPath;
				changed = true;
			} else if (node.path.startsWith(oldPath + "/")) {
				node.path = newPath + node.path.slice(oldPath.length);
				changed = true;
			}
		}
		if (changed) this.trigger("changed");
	}

	clear(): void {
		this.setNodes([]);
		this.trigger("changed");
	}

	/** Drop threads whose start is older than `days` (0 keeps everything). */
	prune(days: number): void {
		if (days <= 0) return;
		const cutoff = Date.now() - days * DAY_MS;
		const kept = this.nodes.filter((n) => this.rootOf(n).openedAt >= cutoff);
		if (kept.length !== this.nodes.length) {
			this.setNodes(kept);
			this.trigger("changed");
		}
	}

	private rootOf(node: HistoryNode): HistoryNode {
		let current = node;
		const seen = new Set<string>();
		while (current.parentId && !seen.has(current.id)) {
			seen.add(current.id);
			const parent = this.byId.get(current.parentId);
			if (!parent) break;
			current = parent;
		}
		return current;
	}

	private setNodes(nodes: HistoryNode[]): void {
		this.nodes = nodes;
		this.byId = new Map(nodes.map((n) => [n.id, n]));
		// Orphans (parent pruned away) become thread starts.
		for (const n of nodes) if (n.parentId && !this.byId.has(n.parentId)) n.parentId = null;
	}
}

function isNode(value: unknown): value is HistoryNode {
	const n = value as HistoryNode;
	return (
		typeof n === "object" && n !== null &&
		typeof n.id === "string" && typeof n.path === "string" &&
		typeof n.openedAt === "number" &&
		(n.parentId === null || typeof n.parentId === "string") &&
		(n.kind === undefined || n.kind === "folder")
	);
}
