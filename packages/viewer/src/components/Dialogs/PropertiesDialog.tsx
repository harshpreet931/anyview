import { useRef } from 'react';
import type { DocumentModel } from '../../core/types';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLocale, useStrings } from '../../i18n/I18nProvider';
import { formatDateTime, formatFileSize } from '../../i18n/format';

interface PropertiesDialogProps {
  document: DocumentModel;
  onClose: () => void;
}

export function PropertiesDialog({ document: doc, onClose }: PropertiesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const strings = useStrings();
  const locale = useLocale();
  useFocusTrap(dialogRef, true, onClose);
  const d = strings.dialog;
  const rows: Array<[string, string | undefined]> = [
    [d.fileName, doc.meta.name],
    [d.format, doc.format.toUpperCase()],
    [d.fileSize, formatFileSize(doc.meta.size, locale)],
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
        ? formatDateTime(doc.metadata.creationDate, locale)
        : undefined,
    ],
    [
      d.modificationDate,
      doc.metadata?.modificationDate
        ? formatDateTime(doc.metadata.modificationDate, locale)
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
