/* ============================================================
 * PropertiesDialog - document metadata viewer
 * ============================================================ */

import { useRef } from 'react';
import type { DocumentModel } from '../../core/types';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useStrings } from '../../i18n/I18nProvider';

interface PropertiesDialogProps {
  document: DocumentModel;
  onClose: () => void;
}

export function PropertiesDialog({ document: doc, onClose }: PropertiesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const strings = useStrings();
  useFocusTrap(dialogRef, true, onClose);
  const d = strings.dialog;
  const rows: Array<[string, string | undefined]> = [
    [d.fileName, doc.meta.name],
    [d.format, doc.format.toUpperCase()],
    [d.fileSize, formatSize(doc.meta.size)],
    [d.mimeType, doc.meta.mimeType],
    [d.pages, String(doc.pageCount)],
    [d.title, doc.metadata?.title],
    [d.author, doc.metadata?.author],
    [d.subject, doc.metadata?.subject],
    [d.creator, doc.metadata?.creator],
    [d.producer, doc.metadata?.producer],
    [
      d.creationDate,
      doc.metadata?.creationDate
        ? new Date(doc.metadata.creationDate).toLocaleString()
        : undefined,
    ],
    [
      d.modificationDate,
      doc.metadata?.modificationDate
        ? new Date(doc.metadata.modificationDate).toLocaleString()
        : undefined,
    ],
  ];

  return (
    <div className="dv-dialog-overlay" role="dialog" aria-modal="true" aria-label={d.properties}>
      <div className="dv-dialog" ref={dialogRef} tabIndex={-1}>
        <div className="dv-dialog-header">
          <h2 className="dv-dialog-title">{d.properties}</h2>
          <Button variant="icon" onClick={onClose} aria-label={d.close}>
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
            {d.close}
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
