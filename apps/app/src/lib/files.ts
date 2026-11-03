import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface PickedTextFile {
  name: string;
  text: string;
}

/** Lets the user choose a CSV / text file and returns its contents, or null if cancelled. */
export async function pickTextFile(): Promise<PickedTextFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/plain', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
  return { name: asset.name, text };
}

/**
 * Saves text as a file: a download on web, the share sheet on iOS/Android
 * (so it can go to Files, Drive, email, ...).
 */
export async function saveTextFile(fileName: string, content: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
}
