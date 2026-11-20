import { useRef, useState, type PointerEvent } from 'react';
import type { Rotation } from '../../../core/rotation';
import { useViewerStore } from '../../../hooks/useDocViewer';
import { usePinPage } from '../pinned-pages';
import {
  FREE_TEXT_SIZE,
  INK_THICKNESS,
  SHAPE_STROKE,
  lineHighlightRects,
  toPage,
  type Point,
  type Rect,
} from './annotation-geometry';
import { TOOL_DEFAULTS, isShapeTool, type TextTool } from './annotation-tools';

export interface DraftBox {
  from: Point;
  to: Point;
}

export interface EditorState {
  tool: TextTool;
  at: Point;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `a-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function useAnnotationDraft(pageIndex: number, turn: Rotation) {
  const activeTool = useViewerStore((s) => s.activeAnnotationTool);
  const addAnnotation = useViewerStore((s) => s.addAnnotation);

  const svgRef = useRef<SVGSVGElement>(null);
  const startRef = useRef<Point | null>(null);
  const pointersRef = useRef(new Set<number>());
  const [draftBox, setDraftBox] = useState<DraftBox | null>(null);
  const [draftPath, setDraftPath] = useState<Point[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  // A half-typed note would be lost if its page scrolled out of the virtualized window and unmounted.
  usePinPage(pageIndex, editor !== null);

  const stamp = (tool: keyof typeof TOOL_DEFAULTS) => {
    const now = Date.now();
    return {
      id: newId(),
      pageIndex,
      color: TOOL_DEFAULTS[tool].color,
      opacity: TOOL_DEFAULTS[tool].opacity,
      createdAt: now,
      updatedAt: now,
    };
  };

  const cancelDraft = () => {
    startRef.current = null;
    setDraftBox(null);
    setDraftPath([]);
  };

  const closeEditor = () => setEditor(null);

  const commitEditor = (text: string) => {
    if (!editor) return;
    setEditor(null);
    const value = text.trim();
    if (!value) return;
    const { tool, at } = editor;
    if (tool === 'sticky-note') {
      addAnnotation({ ...stamp(tool), type: tool, data: { x: at.x, y: at.y, comment: value } });
    } else {
      addAnnotation({
        ...stamp(tool),
        type: tool,
        data: { x: at.x, y: at.y, text: value, fontSize: FREE_TEXT_SIZE },
      });
    }
  };

  const toPoint = (e: PointerEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return toPage(
      {
        x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
      },
      turn,
    );
  };

  const highlightRects = (from: Point, to: Point): Rect[] | null => {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    if (dx > 0.01 && dy <= 0.01 && svgRef.current) {
      return lineHighlightRects(svgRef.current, from, to, turn);
    }
    if (dx > 0.002 && dy > 0.002) {
      return [{ x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: dx, height: dy }];
    }
    return null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (activeTool === null) return;
    pointersRef.current.add(e.pointerId);
    if (pointersRef.current.size > 1) {
      cancelDraft();
      return;
    }
    e.preventDefault();
    const pt = toPoint(e);

    if (activeTool === 'sticky-note' || activeTool === 'free-text') {
      if (!editor) setEditor({ tool: activeTool, at: pt });
      return;
    }

    svgRef.current?.setPointerCapture(e.pointerId);
    startRef.current = pt;
    if (activeTool === 'ink') setDraftPath([pt]);
    else setDraftBox({ from: pt, to: pt });
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!startRef.current || pointersRef.current.size > 1) return;
    const pt = toPoint(e);
    if (activeTool === 'ink') {
      setDraftPath((prev) => [...prev, pt]);
    } else {
      setDraftBox({ from: startRef.current, to: pt });
    }
  };

  const releasePointer = (e: PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (startRef.current && e.type === 'pointercancel') cancelDraft();
  };

  const onPointerUp = (e: PointerEvent) => {
    releasePointer(e);
    const from = startRef.current;
    if (!from) return;
    startRef.current = null;
    svgRef.current?.releasePointerCapture(e.pointerId);

    if (activeTool === 'ink') {
      if (draftPath.length > 1) {
        addAnnotation({
          ...stamp('ink'),
          type: 'ink',
          data: { paths: [draftPath], thickness: INK_THICKNESS },
        });
      }
      setDraftPath([]);
    } else if (draftBox) {
      const to = draftBox.to;
      if (isShapeTool(activeTool)) {
        if (Math.hypot(to.x - from.x, to.y - from.y) > 0.005) {
          addAnnotation({
            ...stamp('shape'),
            type: 'shape',
            data: { shape: activeTool, from, to, strokeWidth: SHAPE_STROKE },
          });
        }
      } else if (activeTool === 'highlight') {
        const rects = highlightRects(from, to);
        if (rects) addAnnotation({ ...stamp('highlight'), type: 'highlight', data: { rects } });
      }
      setDraftBox(null);
    }
  };

  return {
    svgRef,
    activeTool,
    draftBox,
    draftPath,
    editor,
    commitEditor,
    closeEditor,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: releasePointer,
    },
  };
}
