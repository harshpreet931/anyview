import { useEffect, useRef } from 'react';
import type { Rotation } from '../../../core/rotation';
import { useStrings } from '../../../i18n/I18nProvider';
import { EDITOR_H, EDITOR_W, toScreen } from './annotation-geometry';
import type { EditorState } from './useAnnotationDraft';

export interface AnnotationEditorProps {
  editor: EditorState;
  turn: Rotation;
  width: number;
  height: number;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export function AnnotationEditor({ editor, turn, width, height, onCommit, onCancel }: AnnotationEditorProps) {
  const strings = useStrings();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, [editor]);

  const at = toScreen(editor.at, turn);

  return (
    <foreignObject
      x={Math.min(at.x * width, Math.max(0, width - EDITOR_W))}
      y={Math.min(at.y * height, Math.max(0, height - EDITOR_H))}
      width={EDITOR_W}
      height={EDITOR_H}
      style={{ pointerEvents: 'auto' }}
    >
      <textarea
        className="dv-annotation-editor"
        ref={textareaRef}
        aria-label={editor.tool === 'sticky-note' ? strings.annotations.note : strings.annotations.freeText}
        onPointerDown={(e) => e.stopPropagation()}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onCommit(e.currentTarget.value);
          }
        }}
      />
    </foreignObject>
  );
}
