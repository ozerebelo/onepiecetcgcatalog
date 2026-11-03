import { parseCardList, toImportItems, type ImportItem, type Language, type ParseResult } from '@binder/core';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { collectionKeys } from '@/hooks/use-collection';
import { importCollection, type ImportMode, type ImportSummary } from '@/lib/api';
import { pickTextFile, type PickedTextFile } from '@/lib/files';
import { confirmAction, notifyError } from '@/lib/notify';
import { useAuth } from '@/providers/auth';
import { monoFont, radius, spacing, usePalette } from '@/theme';

type Step =
  | { name: 'edit' }
  | { name: 'preview'; parsed: ParseResult; items: ImportItem[]; summary: ImportSummary }
  | { name: 'done'; summary: ImportSummary };

const LIST_PREVIEW = 20;

export default function ImportScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const client = useQueryClient();
  const { user, initializing } = useAuth();

  const [text, setText] = useState('');
  const [file, setFile] = useState<PickedTextFile | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [mode, setMode] = useState<ImportMode>('add');
  const [step, setStep] = useState<Step>({ name: 'edit' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (initializing) return <LoadingView />;
  if (!user) return <Redirect href="/auth/sign-in" />;

  const source = file?.text ?? text;

  const preview = async () => {
    setError(null);
    const parsed = parseCardList(source);
    const items = toImportItems(parsed.entries, language);
    if (items.length === 0) {
      setError(parsed.issues.length > 0 ? t('import.nothingValid') : t('import.empty'));
      return;
    }
    setBusy(true);
    try {
      const summary = await importCollection(items, mode, true);
      setStep({ name: 'preview', parsed, items, summary });
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const commit = async (items: ImportItem[]) => {
    if (mode === 'replace_all') {
      const ok = await confirmAction(t('import.replaceConfirmTitle'), t('import.replaceConfirmBody'), t('import.replaceConfirm'));
      if (!ok) return;
    }
    setBusy(true);
    try {
      const summary = await importCollection(items, mode, false);
      await client.invalidateQueries({ queryKey: collectionKeys.all(user.id) });
      setStep({ name: 'done', summary });
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = async () => {
    try {
      const picked = await pickTextFile();
      if (picked) setFile(picked);
    } catch (e) {
      notifyError(e);
    }
  };

  if (step.name === 'done') {
    const s = step.summary;
    return (
      <Screen scroll narrow edges={['bottom']}>
        <Text variant="title">{t('import.doneTitle')}</Text>
        <Stat label={t('import.inserted')} value={s.inserted} />
        <Stat label={t('import.updated')} value={s.updated} />
        {s.removed > 0 ? <Stat label={t('import.removed')} value={s.removed} /> : null}
        {s.unknown_count > 0 ? <Stat label={t('import.skippedUnknown')} value={s.unknown_count} /> : null}
        <Text tone="secondary">
          {t('import.collectionNow', { copies: s.total_quantity, printings: s.unique_printings })}
        </Text>
        <Button title={t('import.viewCollection')} onPress={() => router.replace('/collection')} />
        <Button
          title={t('import.importMore')}
          variant="secondary"
          onPress={() => {
            setText('');
            setFile(null);
            setStep({ name: 'edit' });
          }}
        />
      </Screen>
    );
  }

  if (step.name === 'preview') {
    const { parsed, items, summary: s } = step;
    return (
      <Screen scroll narrow edges={['bottom']}>
        <Text variant="title">{t('import.previewTitle')}</Text>
        <Text tone="secondary">
          {t('import.readLines', { count: parsed.entries.length + parsed.issues.length, format: t(`import.formats.${parsed.format}`) })}
        </Text>
        <View style={[styles.box, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Stat label={t('import.matched')} value={s.matched} />
          <Stat label={t('import.inserted')} value={s.inserted} />
          <Stat label={t('import.updated')} value={s.updated} />
          {s.unchanged > 0 ? <Stat label={t('import.unchanged')} value={s.unchanged} /> : null}
          {mode !== 'add' ? <Stat label={t('import.removed')} value={s.removed} danger={s.removed > 0} /> : null}
          <Text variant="caption" tone="secondary">
            {t('import.collectionAfter', { copies: s.total_quantity, printings: s.unique_printings })}
          </Text>
        </View>

        {s.unknown_count > 0 ? (
          <IssueList
            title={t('import.unknownTitle', { count: s.unknown_count })}
            hint={t('import.unknownHint')}
            lines={s.unknown.slice(0, LIST_PREVIEW).map((id) => id.replace(/^en:/, 'EN ').replace(/^ja:/, 'JP '))}
            more={s.unknown_count - Math.min(s.unknown_count, LIST_PREVIEW)}
          />
        ) : null}
        {parsed.issues.length > 0 ? (
          <IssueList
            title={t('import.issuesTitle', { count: parsed.issues.length })}
            lines={parsed.issues
              .slice(0, LIST_PREVIEW)
              .map((issue) => `${t('import.line', { line: issue.line })}: ${issue.text.slice(0, 60)} — ${t(`import.issues.${issue.message}`)}`)}
            more={parsed.issues.length - Math.min(parsed.issues.length, LIST_PREVIEW)}
          />
        ) : null}

        <Button
          title={mode === 'replace_all' ? t('import.replaceConfirm') : t('import.confirm', { count: s.matched })}
          variant={mode === 'replace_all' ? 'danger' : 'primary'}
          loading={busy}
          disabled={s.matched === 0 && mode !== 'replace_all'}
          onPress={() => commit(items)}
        />
        <Button title={t('common.back')} variant="ghost" onPress={() => setStep({ name: 'edit' })} />
      </Screen>
    );
  }

  return (
    <Screen scroll narrow edges={['bottom']}>
      <Text variant="title">{t('import.title')}</Text>
      <Text tone="secondary">{t('import.intro')}</Text>
      <View style={[styles.box, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
        <Text style={styles.example}>{t('import.examples')}</Text>
      </View>

      {file ? (
        <View style={[styles.box, styles.fileRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.flex}>
            <Text variant="subheading" numberOfLines={1}>
              {file.name}
            </Text>
            <Text variant="caption" tone="secondary">
              {t('import.fileLines', { count: file.text.split(/\r?\n/).filter((l) => l.trim()).length })}
            </Text>
          </View>
          <Pressable onPress={() => setFile(null)} accessibilityRole="button" hitSlop={8}>
            <Text tone="primary" style={styles.bold}>
              {t('import.removeFile')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextField
            label={t('import.pasteLabel')}
            value={text}
            onChangeText={setText}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={'4xOP01-016\n2x OP01-025_p1 JP\n…'}
            style={styles.textarea}
            textAlignVertical="top"
          />
          <Button title={t('import.chooseFile')} variant="secondary" onPress={chooseFile} />
        </>
      )}

      <View style={styles.option}>
        <Text variant="label" tone="secondary">
          {t('import.defaultLanguage')}
        </Text>
        <Segmented
          accessibilityLabel={t('import.defaultLanguage')}
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'en', label: t('languages.en') },
            { value: 'ja', label: t('languages.ja') },
          ]}
        />
        <Text variant="caption" tone="secondary">
          {t('import.defaultLanguageHint')}
        </Text>
      </View>

      <View style={styles.option}>
        <Text variant="label" tone="secondary">
          {t('import.mode')}
        </Text>
        <Segmented
          accessibilityLabel={t('import.mode')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'add', label: t('import.modes.add') },
            { value: 'set', label: t('import.modes.set') },
            { value: 'replace_all', label: t('import.modes.replace_all') },
          ]}
        />
        <Text variant="caption" tone={mode === 'replace_all' ? 'danger' : 'secondary'}>
          {t(`import.modeHints.${mode}`)}
        </Text>
      </View>

      {error ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button title={t('import.preview')} onPress={preview} loading={busy} disabled={source.trim() === ''} />
    </Screen>
  );
}

function Stat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text tone="secondary">{label}</Text>
      <Text variant="subheading" tone={danger ? 'danger' : 'default'}>
        {value.toLocaleString()}
      </Text>
    </View>
  );
}

function IssueList({ title, hint, lines, more }: { title: string; hint?: string; lines: string[]; more: number }) {
  const { t } = useTranslation();
  const palette = usePalette();
  return (
    <View style={[styles.box, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text variant="subheading" tone="danger">
        {title}
      </Text>
      {hint ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}
      {lines.map((line, i) => (
        <Text key={i} variant="mono" tone="secondary" numberOfLines={2}>
          {line}
        </Text>
      ))}
      {more > 0 ? (
        <Text variant="caption" tone="secondary">
          {t('import.andMore', { count: more })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  example: { fontFamily: monoFont, fontSize: 13, lineHeight: 20 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  textarea: { minHeight: 180, paddingTop: spacing.md, fontFamily: monoFont, fontSize: 14 },
  option: { gap: spacing.xs },
  stat: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
