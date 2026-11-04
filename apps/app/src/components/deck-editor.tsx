import { parseDecklist, validateDeck, type DeckItem } from '@binder/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DeckProblems } from '@/components/deck-problems';
import { Button } from '@/components/ui/button';
import { Badge, Panel, ProgressBar } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { checkCards, saveDeck } from '@/lib/api';
import { notifyError } from '@/lib/notify';
import { useAuth } from '@/providers/auth';
import { monoFont, spacing } from '@/theme';

interface DeckEditorProps {
  deckId?: string;
  initialName?: string;
  initialList?: string;
  initialNotes?: string;
}

const EXAMPLE = '1xOP01-001\n4xOP01-016\n4xOP01-025\n…';

/**
 * Paste a decklist, see instantly which cards were recognised and how much of the
 * deck you own (live check against the collection), then save it.
 */
export function DeckEditor({ deckId, initialName = '', initialList = '', initialNotes = '' }: DeckEditorProps) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState(initialName);
  const [list, setList] = useState(initialList);
  const [notes, setNotes] = useState(initialNotes);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseDecklist(list), [list]);
  const debouncedItems = useDebouncedValue<DeckItem[]>(parsed.items, 400);
  const preview = useQuery({
    queryKey: ['deck-preview', user?.id, debouncedItems],
    queryFn: () => checkCards(debouncedItems, { languages: null, reserveBuilt: false }),
    enabled: Boolean(user) && debouncedItems.length > 0,
  });

  const rows = preview.data ?? [];
  const known = rows.filter((r) => r.known);
  const unknown = rows.filter((r) => !r.known);
  const total = known.reduce((n, r) => n + r.needed, 0);
  const have = known.reduce((n, r) => n + r.have, 0);
  const problems = preview.data
    ? validateDeck(known.map((r) => ({ card_id: r.card_id, category: r.category, quantity: r.needed })))
    : [];

  const save = async () => {
    if (!name.trim()) {
      setNameError(t('decks.errors.nameRequired'));
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      const result = await saveDeck(deckId ?? null, name.trim(), parsed.items, notes.trim() || null);
      await client.invalidateQueries({ queryKey: ['decks'] });
      router.replace({ pathname: '/deck/[id]', params: { id: result.id } });
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll edges={['bottom']} contentStyle={styles.page}>
      <TextField
        label={t('decks.name')}
        value={name}
        onChangeText={setName}
        error={nameError}
        placeholder={t('decks.namePlaceholder')}
        maxLength={80}
      />
      <TextField
        label={t('decks.listLabel')}
        hint={t('decks.listHint')}
        value={list}
        onChangeText={setList}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={EXAMPLE}
        style={styles.textarea}
        textAlignVertical="top"
      />

      {parsed.items.length > 0 ? (
        <Panel>
          <View style={styles.row}>
            <Text variant="subheading" style={styles.flex}>
              {t('decks.preview')}
            </Text>
            <Badge label={t('decks.cardCount', { count: total || parsed.total })} />
          </View>
          {preview.data ? (
            <>
              <ProgressBar value={total ? have / total : 0} tone={have >= total && total > 0 ? 'success' : 'primary'} />
              <Text tone="secondary">{t('decks.youOwn', { have, total })}</Text>
              <DeckProblems problems={problems} />
              {unknown.length > 0 ? (
                <Text variant="caption" tone="danger">
                  {t('decks.unknownCards', { count: unknown.length, codes: unknown.map((u) => u.card_id).join(', ') })}
                </Text>
              ) : null}
            </>
          ) : (
            <Text variant="caption" tone="muted">
              {t('common.loading')}
            </Text>
          )}
          {parsed.issues.length > 0 ? (
            <Text variant="caption" tone="secondary">
              {t('decks.ignoredLines', { count: parsed.issues.length })}
            </Text>
          ) : null}
        </Panel>
      ) : null}

      <TextField
        label={t('decks.notes')}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder={t('decks.notesPlaceholder')}
        style={styles.notes}
        textAlignVertical="top"
        maxLength={2000}
      />
      <Button
        title={deckId ? t('common.save') : t('decks.saveNew')}
        icon="save"
        size="lg"
        loading={saving}
        disabled={parsed.items.length === 0}
        onPress={save}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 720, paddingTop: spacing.lg },
  textarea: { minHeight: 220, paddingTop: spacing.md, fontFamily: monoFont, fontSize: 14 },
  notes: { minHeight: 80, paddingTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
