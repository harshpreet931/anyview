import { useMemo, useState } from 'react';
import { useStrings } from '../../i18n/I18nProvider';
import type { OutlineNode, PageDestination } from '../../core/types';
import { Icon } from '../common/Icon';
import { useSidebarList } from './useSidebarList';

const ROW_HEIGHT = 32;
const INDENT = 16;

function isPageDestination(dest: OutlineNode['dest']): dest is PageDestination {
  return typeof dest === 'object' && dest !== null && 'pageIndex' in dest;
}

// Outline nodes carry no id, so identity comes from title + destination. Repeats of that pair
// (a document really can have two "Introduction" headings on one page) get an occurrence suffix.
function keyOutlineNodes(
  nodes: ReadonlyArray<OutlineNode>,
): ReadonlyArray<{ node: OutlineNode; key: string }> {
  const seen = new Map<string, number>();
  return nodes.map((node) => {
    const dest = isPageDestination(node.dest) ? String(node.dest.pageIndex) : String(node.dest);
    const base = `${node.title} ${dest}`;
    const seenBefore = seen.get(base) ?? 0;
    seen.set(base, seenBefore + 1);
    return { node, key: seenBefore === 0 ? base : `${base} ${seenBefore}` };
  });
}

interface Row {
  node: OutlineNode;
  key: string;
  level: number;
  parent: number;
  setSize: number;
  posInSet: number;
  expanded: boolean | undefined;
}

/** The rows a reader can see: every node whose ancestors are all expanded, in document order. */
function visibleRows(nodes: ReadonlyArray<OutlineNode>, collapsed: ReadonlySet<string>): Row[] {
  const rows: Row[] = [];
  const walk = (list: ReadonlyArray<OutlineNode>, level: number, parent: number, path: string) => {
    keyOutlineNodes(list).forEach(({ node, key }, i) => {
      const fullKey = `${path}/${key}`;
      const expanded = node.children?.length ? !collapsed.has(fullKey) : undefined;
      const index = rows.length;
      rows.push({ node, key: fullKey, level, parent, setSize: list.length, posInSet: i + 1, expanded });
      if (expanded) walk(node.children!, level + 1, index, fullKey);
    });
  };
  walk(nodes, 1, -1, '');
  return rows;
}

export function OutlineList({
  nodes,
  scrollElement,
  onNavigate,
}: {
  nodes: ReadonlyArray<OutlineNode>;
  scrollElement: HTMLElement;
  onNavigate: (pageIndex: number, scrollOffset?: number) => void;
}) {
  const strings = useStrings();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useMemo(() => visibleRows(nodes, collapsed), [nodes, collapsed]);
  const nested = useMemo(() => nodes.some((n) => n.children?.length), [nodes]);

  const { virtualizer, active, moveFocus, listRef, listProps } = useSidebarList({
    count: rows.length,
    scrollElement,
    estimateSize: () => ROW_HEIGHT,
    paddingEnd: 8,
  });

  const setExpanded = (key: string, expanded: boolean) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (expanded) next.delete(key);
      else next.add(key);
      return next;
    });

  const open = (row: Row) => {
    if (isPageDestination(row.node.dest)) onNavigate(row.node.dest.pageIndex, row.node.dest.scrollOffset);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const row = rows[active];
    if (!row) return;
    switch (e.key) {
      case 'ArrowDown':
        moveFocus(active + 1);
        break;
      case 'ArrowUp':
        moveFocus(active - 1);
        break;
      case 'Home':
        moveFocus(0);
        break;
      case 'End':
        moveFocus(rows.length - 1);
        break;
      case 'ArrowRight':
        if (row.expanded === false) setExpanded(row.key, true);
        else if (row.expanded) moveFocus(active + 1);
        break;
      case 'ArrowLeft':
        if (row.expanded) setExpanded(row.key, false);
        else if (row.parent >= 0) moveFocus(row.parent);
        break;
      case 'Enter':
      case ' ':
        open(row);
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <ul
      className="dv-outline-list"
      role="tree"
      aria-label={strings.sidebar.outline}
      ref={listRef}
      {...listProps}
      onKeyDown={onKeyDown}
    >
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index]!;
        return (
          <li
            key={row.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            role="treeitem"
            className="dv-outline-item"
            tabIndex={active === item.index ? 0 : -1}
            aria-level={row.level}
            aria-setsize={row.setSize}
            aria-posinset={row.posInSet}
            aria-expanded={row.expanded}
            style={{
              transform: `translateY(${item.start}px)`,
              paddingInlineStart: `${12 + (row.level - 1) * INDENT}px`,
            }}
            onClick={() => open(row)}
          >
            {nested && (
              <span
                className="dv-outline-toggle"
                onClick={(e) => {
                  if (row.expanded === undefined) return;
                  e.stopPropagation();
                  setExpanded(row.key, !row.expanded);
                }}
              >
                {row.expanded !== undefined && <Icon name="chevron-right" size={14} />}
              </span>
            )}
            {row.node.title}
          </li>
        );
      })}
    </ul>
  );
}
