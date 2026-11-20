import type { DocumentModel } from '../../core/types';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { useLocale, useStrings } from '../../i18n/I18nProvider';
import { formatDateTime, formatFileSize } from '../../i18n/format';
import { DialogShell } from './DialogShell';

interface PropertiesDialogProps {
  document: DocumentModel;
  onClose: () => void;
}

export function PropertiesDialog({ document: doc, onClose }: PropertiesDialogProps) {
  const strings = useStrings();
  const locale = useLocale();
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
    <DialogShell
      title={d.properties}
      onEscape={onClose}
      headerAction={
        <Button variant="icon" onClick={onClose} aria-label={d.close}>
          <Icon name="close" />
        </Button>
      }
    >
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
    </DialogShell>
  );
}
