import { SAMPLE_FILES } from '../samples';

export function sampleFile(fileName: string, renameTo?: string): File {
  const sample = SAMPLE_FILES.find((s) => s.fileName === fileName);
  if (!sample) throw new Error(`No sample named ${fileName}`);
  return new File([sample.content], renameTo ?? sample.fileName, { type: sample.mimeType });
}
