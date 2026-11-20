import { useLocale } from '../../i18n/I18nProvider';
import { formatFileSize } from '../../i18n/format';
import type { AttachmentRef } from '../../core/types';

export function AttachmentList({ attachments }: { attachments: ReadonlyArray<AttachmentRef> }) {
  const locale = useLocale();
  return (
    <ul className="dv-attachment-list">
      {attachments.map((att) => (
        <li key={att.id}>
          <button
            className="dv-attachment-item"
            onClick={async () => {
              let url: string | undefined;
              try {
                const blob = await att.getData();
                url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = att.name;
                a.click();
              } catch {
                // A failed attachment read has nowhere to surface; the viewer keeps off console.
              } finally {
                if (url) URL.revokeObjectURL(url);
              }
            }}
          >
            {att.name}
            <span className="dv-attachment-size">{formatFileSize(att.size, locale)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
