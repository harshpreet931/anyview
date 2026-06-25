/* ============================================================
 * PropertiesDialog - document metadata viewer
 * ============================================================ */

import { useRef } from 'react';
import type { DocumentModel } from '../../core/types';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface PropertiesDialogProps {
  document: DocumentModel;
  onClose: () => void;
}

export function PropertiesDialog({ document: doc, onClose }: PropertiesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, onClose);
  const rows: Array<[string, string | undefined]> = [
    ['File name', doc.meta.name],
    ['Format', doc.format.toUpperCase()],
    ['File size', formatSize(doc.meta.size)],
    ['MIME type', doc.meta.mimeType],
    ['Pages', String(doc.pageCount)],
    ['Title', doc.metadata?.title],
    ['Author', doc.metadata?.author],
    ['Subject', doc.metadata?.subject],
    ['Creator', doc.metadata?.creator],
    ['Producer', doc.metadata?.producer],
    [
      'Created',
      doc.metadata?.creationDate
        ? new Date(doc.metadata.creationDate).toLocaleString()
        : undefined,
    ],
    [
      'Modified',
      doc.metadata?.modificationDate
        ? new Date(doc.metadata.modificationDate).toLocaleString()
        : undefined,
    ],
  ];

  return (
    <div className="dv-dialog-overlay" role="dialog" aria-modal="true" aria-label="Document properties">
      <div className="dv-dialog" ref={dialogRef} tabIndex={-1}>
        <div className="dv-dialog-header">
          <h2 className="dv-dialog-title">Document Properties</h2>
          <Button variant="icon" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </Button>
        </div>
        <div className="dv-dialog-body">
          <table className="dv-properties-table">
            <tbody>
              {rows
                .filter(([, value]) => value !== undefined)
                .map(([key, value]) => (
                  <tr key={key}>
                    <td className="dv-properties-key">{key}</td>
                    <td className="dv-properties-value">{value}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="dv-dialog-actions">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
