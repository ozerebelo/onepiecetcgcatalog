import {
  collectionToCsv,
  diffImport,
  parseCardList,
  parsePrintingId,
  toImportItems,
  type ImportDiff,
  type ImportItem,
  type Language,
  type ParseResult,
} from '@binder/core';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import type { TFunction } from 'i18next';
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
import { exportCollection, fetchPrintingNames, importCollection, type ImportMode, type ImportSummary } from '@/lib/api';
import { pickTextFile, saveTextFile, type PickedTextFile } from '@/lib/files';
import { notifyError } from '@/lib/notify';
import { useAuth } from '@/providers/auth';
import { fonts, monoFont, radius, spacing, usePalette } from '@/theme';

type Step =
  | { name: 'edit' }
  | { name: 'preview'; parsed: ParseResult; items: ImportItem[]; summary: ImportSummary; diff: ImportDiff; names: Record<string, string> }
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
  const [showAll, setShowAll] = useState(false);
  /** Replace all is enabled once a backup is saved, or the user explicitly skips it. */
  const [backup, setBackup] = useState<'none' | 'saved' | 'skipped'>('none');

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
      const [summary, current] = await Promise.all([importCollection(items, mode, true), exportCollection()]);
      const diff = diffImport(new Map(current.map((r) => [r.printing_id, r.quantity])), items, mode, new Set(summary.unknown));
      const names: Record<string, string> = Object.fromEntries(current.map((r) => [r.printing_id, r.name]));
      const missingNames = diff.changes.map((c) => c.printing_id).filter((id) => !names[id]);
      if (missingNames.length) Object.assign(names, await fetchPrintingNames(missingNames));
      setShowAll(false);
      setBackup('none');
      setStep({ name: 'preview', parsed, items, summary, diff, names });
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const saveBackup = async () => {
    try {
      const rows = await exportCollection();
      const date = new Date().toISOString().slice(0, 10);
      await saveTextFile(`playset-collection-${date}.csv`, collectionToCsv(rows), 'text/csv');
      setBackup('saved');
    } catch (e) {
      notifyError(e);
    }
  };

  const commit = async (items: ImportItem[]) => {
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
    const { parsed, items, summary: s, diff, names } = step;
    const shown = showAll ? diff.changes : diff.changes.slice(0, LIST_PREVIEW);
    const replace = mode === 'replace_all';
    const ready = !replace || backup !== 'none';
    return (
      <Screen scroll narrow edges={['bottom']}>
        <Text variant="title">{t('import.previewTitle')}</Text>
        <Text tone="secondary">
          {t('import.readLines', { count: parsed.entries.length + parsed.issues.length, format: t(`import.formats.${parsed.format}`) })}{' '}
          {t('import.recognised', { count: s.matched })}
        </Text>

        {/* The whole change in one sentence, in one unit: copies. */}
        <Text variant="heading">
          {diff.changes.length === 0
            ? t('import.noChanges')
            : changeSentence(t, diff.copiesAdded, diff.copiesRemoved, diff.changes.length)}
        </Text>
        <Text tone="secondary">{t('import.afterwards', { before: diff.copiesBefore, after: diff.copiesAfter, printings: s.unique_printings })}</Text>

        {diff.changes.length > 0 ? (
          <View>
            <View style={[styles.diffRow, styles.diffHead, { borderBottomColor: palette.rule }]}>
              <Text variant="eyebrow" tone="secondary" style={styles.diffCode}>
                {t('import.columns.number')}
              </Text>
              <Text variant="eyebrow" tone="secondary" style={styles.flex}>
                {t('import.columns.card')}
              </Text>
              <Text variant="eyebrow" tone="secondary" style={styles.diffQty}>
                {t('import.columns.change')}
              </Text>
            </View>
            {shown.map((c) => {
              const id = parsePrintingId(c.printing_id);
              const down = c.after < c.before;
              return (
                <View key={c.printing_id} style={[styles.diffRow, { borderBottomColor: palette.border }]}>
                  <Text variant="mono" style={styles.diffCode} numberOfLines={1}>
                    {id ? `${id.code} ${id.language.toUpperCase()}` : c.printing_id}
                  </Text>
                  <Text numberOfLines={1} style={styles.flex}>
                    {names[c.printing_id] ?? '—'}
                  </Text>
                  <Text variant="mono" style={[styles.diffQty, { color: down ? palette.danger : palette.text }]}>
                    {c.after === 0 ? t('import.removedRow', { count: c.before }) : `${c.before} → ${c.after}`}
                  </Text>
                </View>
              );
            })}
            {diff.changes.length > LIST_PREVIEW ? (
              <Button
                title={showAll ? t('import.showFewer') : t('import.showAll', { count: diff.changes.length })}
                variant="ghost"
                size="sm"
                onPress={() => setShowAll((v) => !v)}
                boxStyle={styles.start}
              />
            ) : null}
          </View>
        ) : null}

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

        {replace ? (
          // Replace all removes everything not in the list: a backup comes first (or is skipped knowingly).
          <View style={[styles.backup, { borderColor: palette.danger }]}>
            <Text weight="semibold" tone="danger">
              {t('import.backupTitle', { count: diff.copiesRemoved })}
            </Text>
            <Text variant="caption" tone="secondary">
              {t('import.backupBody')}
            </Text>
            <View style={styles.backupActions}>
              <Button
                title={backup === 'saved' ? t('import.backupSaved') : t('import.backupSave')}
                icon={backup === 'saved' ? 'check' : 'download'}
                variant="outline"
                size="sm"
                onPress={saveBackup}
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: backup === 'skipped' }}
                onPress={() => setBackup(backup === 'skipped' ? 'none' : 'skipped')}
                style={styles.skip}>
                <View style={[styles.box16, { borderColor: palette.text, backgroundColor: backup === 'skipped' ? palette.text : 'transparent' }]} />
                <Text variant="caption">{t('import.backupSkip')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Button
          title={
            replace
              ? t('import.replaceConfirm')
              : mode === 'add'
                ? t('import.confirmAdd', { count: diff.copiesAdded })
                : t('import.confirmSet', { count: diff.changes.length })
          }
          variant={replace ? 'danger' : 'primary'}
          loading={busy}
          disabled={!ready || (diff.changes.length === 0 && !replace)}
          onPress={() => commit(items)}
        />
        <Button title={t('import.editList')} variant="ghost" onPress={() => setStep({ name: 'edit' })} />
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
  bold: { fontFamily: fonts.semibold },
  textarea: { minHeight: 180, paddingTop: spacing.md, fontFamily: monoFont, fontSize: 14 },
  option: { gap: spacing.xs },
  stat: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  start: { alignSelf: 'flex-start' },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 36, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  diffHead: { borderBottomWidth: 2 },
  diffCode: { width: 128 },
  diffQty: { width: 104, textAlign: 'right' },
  backup: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radius.md },
  backupActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  skip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  box16: { width: 16, height: 16, borderWidth: 1.5, borderRadius: 2 },
});

/** "Adds 10 copies across 4 printings." — names only the directions that actually happen. */
function changeSentence(t: TFunction, added: number, removed: number, changed: number) {
  const printings = t('import.printings', { count: changed });
  const copies = (count: number) => t('import.copies', { count });
  if (added > 0 && removed > 0) return t('import.changeBoth', { added: copies(added), removed: copies(removed), printings });
  if (removed > 0) return t('import.changeRemoves', { copies: copies(removed), printings });
  return t('import.changeAdds', { copies: copies(added), printings });
}
