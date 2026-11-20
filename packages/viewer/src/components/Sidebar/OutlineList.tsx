import type { OutlineNode, PageDestination } from '../../core/types';

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

export function OutlineList({
  nodes,
  onNavigate,
  depth = 0,
}: {
  nodes: ReadonlyArray<OutlineNode>;
  onNavigate: (pageIndex: number, scrollOffset?: number) => void;
  depth?: number;
}) {
  return (
    <ul
      className="dv-outline-list"
      role={depth === 0 ? 'tree' : 'group'}
      style={{ paddingLeft: `${depth * 16}px` }}
    >
      {keyOutlineNodes(nodes).map(({ node, key }) => (
        <li key={key} role="treeitem">
          <button
            className="dv-outline-item"
            onClick={() => {
              if (isPageDestination(node.dest)) onNavigate(node.dest.pageIndex, node.dest.scrollOffset);
            }}
          >
            {node.title}
          </button>
          {node.children && (
            <OutlineList nodes={node.children} onNavigate={onNavigate} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}
