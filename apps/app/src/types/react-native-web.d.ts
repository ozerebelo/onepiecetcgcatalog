import 'react-native';

// react-native-web adds hover/focus to Pressable's state callback. On native they're
// simply undefined, so reading them is always safe.
declare module 'react-native' {
  interface PressableStateCallbackType {
    hovered?: boolean;
    focused?: boolean;
  }
}
