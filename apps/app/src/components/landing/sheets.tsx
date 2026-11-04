import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import type { LandingPrinting } from '@/lib/api';
import { poster } from '@/theme';

import { HEADER_HEIGHT } from './hero';
import { PHeading, PText, Reveal, web, type ChapterName, type PosterLayout } from './kit';

type SheetKey = 'import' | 'languages' | 'sets' | 'built';
const SHEETS: {
  key: SheetKey;
  ground: string;
  ink: string;
  chapter: ChapterName;
}[] = [
  { key: 'import', ground: poster.red, ink: poster.ink, chapter: 'red' },
  {
    key: 'languages',
    ground: poster.black,
    ink: poster.paper,
    chapter: 'black',
  },
  { key: 'sets', ground: poster.green, ink: poster.ink, chapter: 'green' },
  { key: 'built', ground: poster.boneStep, ink: poster.ink, chapter: 'bone' },
];

/**
 * What else the binder does, as full-width colour sheets that stack like folders in a drawer:
 * each sticks one title band lower than the last, so earlier titles stay visible as later sheets
 * slide up over them. Below 1024px a sheet's picture comes first and its text follows.
 */
export function Sheets({
  layout,
  cards,
  showcase,
  onSheet,
}: {
  layout: PosterLayout;
  cards: LandingPrinting[];
  showcase: LandingPrinting[];
  /** Where each sheet starts (relative to this section), for the header's chapter colours. */
  onSheet?: (index: number, y: number, chapter: ChapterName) => void;
}) {
  const { t } = useTranslation();
  const { wide, phone, margin, size, height } = layout;
  const sticky = Platform.OS === 'web';
  const titleSize = phone ? 22 : size.title;
  const band = Math.round(titleSize * 1.15 + (wide ? 36 : 28));
  const stickTop = phone ? 0 : HEADER_HEIGHT;
  // Below 1024px sheets get one fixed height too (picture + up to five lines of text), so they all
  // reach the end of the section together.
  const pictureH = Math.round((layout.width - margin * 2) / (phone ? 4 / 3 : 16 / 9));
  const compactHeight = band + pictureH + 20 + 5 * Math.round(size.body * 1.5) + 40;

  const english = showcase.find((p) => p.language === 'en' && p.variant === 'base') ?? showcase[0];
  const japanese = showcase.find((p) => p.language === 'ja' && p.variant === 'base') ?? showcase.find((p) => p.language === 'ja');
  const pictures: Record<SheetKey, LandingPrinting[]> = {
    import: cards.slice(0, 9),
    languages: [english, japanese].filter(Boolean) as LandingPrinting[],
    sets: cards.slice(9, 18),
    built: cards.filter((c) => c.category === 'Leader').slice(0, 1),
  };

  return (
    <View style={{ backgroundColor: poster.bone }}>
      <View
        style={{
          paddingHorizontal: margin,
          paddingTop: phone ? 96 : 160,
          paddingBottom: 48,
        }}
      >
        <Reveal>
          <PHeading level={2} size={size.head} color={poster.ink}>
            {t('landing.sheets.title')}
          </PHeading>
        </Reveal>
      </View>
      {SHEETS.map((sheet, i) => {
        const title = (
          <View style={{ height: band, justifyContent: 'center' }}>
            <PText
              face="black"
              size={titleSize}
              leading={1.1}
              track={-0.03}
              color={sheet.ink}
              role="heading"
              aria-level={3}
              numberOfLines={1}
            >
              {t(`landing.sheets.${sheet.key}.title`)}
            </PText>
          </View>
        );
        const body = (
          <PText size={size.body} color={sheet.ink} style={{ maxWidth: 480 }}>
            {t(`landing.sheets.${sheet.key}.body`)}
          </PText>
        );
        return (
          <View
            key={sheet.key}
            onLayout={(e) => onSheet?.(i, e.nativeEvent.layout.y, sheet.chapter)}
            style={[
              {
                backgroundColor: sheet.ground,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingHorizontal: margin,
              },
              // Earlier sheets are taller by the bands that will cover them, so every sheet reaches the end of
              // the section at the same moment and the stack leaves as one (no sheet slides over the tabs).
              wide
                ? {
                    height: Math.max(520, Math.round(height * 0.64)) + (SHEETS.length - 1 - i) * band,
                    flexDirection: 'row',
                  }
                : { height: compactHeight + (SHEETS.length - 1 - i) * band },
              sticky && web({ position: 'sticky', top: stickTop + i * band }),
            ]}
          >
            {wide ? (
              <>
                <View style={{ width: '50%', paddingRight: 48, gap: 20 }}>
                  {title}
                  {body}
                </View>
                <View
                  style={[
                    styles.flex,
                    {
                      marginTop: band,
                      marginBottom: 32 + (SHEETS.length - 1 - i) * band,
                    },
                  ]}
                >
                  <SheetPicture printings={pictures[sheet.key]} kind={sheet.key} />
                </View>
              </>
            ) : (
              <>
                {title}
                <View style={{ aspectRatio: phone ? 4 / 3 : 16 / 9 }}>
                  <SheetPicture printings={pictures[sheet.key]} kind={sheet.key} />
                </View>
                <View style={{ paddingTop: 20 }}>{body}</View>
              </>
            )}
          </View>
        );
      })}
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
