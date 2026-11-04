import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { LandingPrinting } from '@/lib/api';
import { poster } from '@/theme';

import { PHeading, PText, Reveal, type PosterLayout } from './kit';

type SheetKey = 'import' | 'languages' | 'sets' | 'built';
const SHEETS: {
  key: SheetKey;
  ground: string;
  ink: string;
}[] = [
  { key: 'import', ground: poster.red, ink: poster.ink },
  {
    key: 'languages',
    ground: poster.black,
    ink: poster.paper,
  },
  { key: 'sets', ground: poster.green, ink: poster.ink },
  { key: 'built', ground: poster.boneStep, ink: poster.ink },
];

/**
 * What else the binder does: four rounded colour blocks in a 2×2 grid (one column on phones),
 * each with its title, a sentence and one picture made from real card art.
 */
export function Sheets({ layout, cards, showcase }: { layout: PosterLayout; cards: LandingPrinting[]; showcase: LandingPrinting[] }) {
  const { t } = useTranslation();
  const { wide, phone, margin, size } = layout;
  const columns = phone ? 1 : 2;
  const gap = phone ? 12 : 16;

  const english = showcase.find((p) => p.language === 'en' && p.variant === 'base') ?? showcase[0];
  const japanese = showcase.find((p) => p.language === 'ja' && p.variant === 'base') ?? showcase.find((p) => p.language === 'ja');
  const pictures: Record<SheetKey, LandingPrinting[]> = {
    import: cards.slice(0, 9),
    languages: [english, japanese].filter(Boolean) as LandingPrinting[],
    sets: cards.slice(9, 18),
    built: cards.filter((c) => c.category === 'Leader').slice(0, 1),
  };

  return (
    <View style={{ backgroundColor: poster.bone, paddingHorizontal: margin, paddingTop: phone ? 88 : 160, paddingBottom: phone ? 24 : 40 }}>
      <Reveal>
        <PHeading level={2} size={size.head} color={poster.ink} style={{ marginBottom: phone ? 32 : 48 }}>
          {t('landing.sheets.title')}
        </PHeading>
      </Reveal>
      <View style={[styles.grid, { gap }]}>
        {SHEETS.map((sheet, i) => (
          <Reveal
            key={sheet.key}
            delay={(i % columns) * 90}
            style={{ width: columns === 1 ? '100%' : `${(100 - (gap / layout.width) * 100) / 2 - 0.5}%`, flexGrow: 1 }}
          >
            <View style={[styles.block, { backgroundColor: sheet.ground, padding: phone ? 20 : 32 }]}>
              <PText
                face="black"
                size={phone ? 24 : size.title}
                leading={1.05}
                track={-0.03}
                color={sheet.ink}
                role="heading"
                aria-level={3}
              >
                {t(`landing.sheets.${sheet.key}.title`)}
              </PText>
              <PText size={size.body} color={sheet.ink} style={{ maxWidth: 480 }}>
                {t(`landing.sheets.${sheet.key}.body`)}
              </PText>
              <View style={[styles.picture, { aspectRatio: wide ? 16 / 10 : 4 / 3 }]}>
                <SheetPicture printings={pictures[sheet.key]} kind={sheet.key} />
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </View>
  );
}

/** The sheet's one picture, built from real card art. */
function SheetPicture({ printings, kind }: { printings: LandingPrinting[]; kind: SheetKey }) {
  const { t } = useTranslation();
  if (!printings.length) return null;
  if (kind === 'import' || kind === 'sets') {
    // A binder page: three by three pockets. On the set sheet, missing cards are dimmed.
    return (
      <View style={styles.page}>
        {printings.slice(0, 9).map((p, i) => (
          <View key={p.id} style={styles.pocket}>
            <Image
              source={{ uri: p.image_url ?? undefined }}
              style={[StyleSheet.absoluteFill, kind === 'sets' && [2, 5, 7].includes(i) ? { opacity: 0.22 } : null]}
              contentFit="cover"
              contentPosition={{ top: '14%', left: '50%' }}
              accessibilityLabel={p.name}
            />
          </View>
        ))}
      </View>
    );
  }
  if (kind === 'languages') {
    return (
      <View style={styles.pair}>
        {printings.map((p) => (
          <View key={p.id} style={styles.pairItem}>
            <View style={styles.flex}>
              <Image
                source={{ uri: p.image_url ?? undefined }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition={{ top: '20%', left: '50%' }}
                accessibilityLabel={p.name}
              />
            </View>
            <PText face="medium" size={16} color={poster.paper}>
              {p.language === 'ja' ? t('landing.printing.japanese') : t('landing.printing.english')}
            </PText>
          </View>
        ))}
      </View>
    );
  }
  const leader = printings[0];
  return (
    <View style={styles.single}>
      <Image
        source={{ uri: leader.image_url ?? undefined }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={{ top: '16%', left: '50%' }}
        accessibilityLabel={leader.name}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  block: { borderRadius: 28, gap: 16, flexGrow: 1 },
  picture: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  page: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: poster.black,
  },
  pocket: {
    width: '33.333%',
    height: '33.333%',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: poster.black,
    backgroundColor: poster.blackStep,
  },
  pair: { flex: 1, flexDirection: 'row', gap: 12 },
  pairItem: { flex: 1, gap: 10 },
  single: { flex: 1, overflow: 'hidden' },
});
