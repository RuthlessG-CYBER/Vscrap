import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type } from '@/theme';
import { useTheme } from '@/context/ThemeContext';

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

export interface StatItem {
  label: string;
  value: string | number;
  tone?: Tone;
}

/**
 * Flat, cardless metric strip. Cells are separated by hairlines so the data
 * reads as one dashboard band instead of four floating cards.
 */
export function StatStrip({ items }: { items: StatItem[] }) {
  const { themeColors } = useTheme();

  const toneColor = (tone: Tone | undefined) => {
    if (tone === 'primary') return themeColors.primary;
    if (tone === 'success') return themeColors.success;
    if (tone === 'warning') return themeColors.warning;
    if (tone === 'danger') return themeColors.danger;
    return themeColors.text;
  };

  return (
    <View style={[styles.row, { borderColor: themeColors.border }]}>
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 ? (
            <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          ) : null}
          <View style={styles.cell}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[styles.value, { color: toneColor(item.tone) }]}>
              {item.value}
            </Text>
            <Text numberOfLines={1} style={[styles.label, { color: themeColors.textMuted }]}>
              {item.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  divider: {
    width: 1,
    marginVertical: 2,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 3,
  },
  value: {
    ...type.h2,
    fontSize: 19,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  label: {
    ...type.micro,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
