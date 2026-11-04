import { Platform, Switch, type SwitchProps } from 'react-native';

import { usePalette } from '@/theme';

/**
 * Themed Switch. react-native-web colors the "on" knob with its own
 * `activeThumbColor` prop (default teal), which isn't in the RN types.
 */
export function AppSwitch(props: SwitchProps) {
  const palette = usePalette();
  const webProps = Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as object) : {};
  return (
    <Switch
      trackColor={{ true: palette.primary, false: palette.borderStrong }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={palette.borderStrong}
      {...webProps}
      {...props}
    />
  );
}
