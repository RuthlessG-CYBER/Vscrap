
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface AnimatedScreenProps {
  children: React.ReactNode;
}

export default function AnimatedScreen({
  children,
}: AnimatedScreenProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(15);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.ease),
    });

    translateX.value = withTiming(0, {
      duration: 280,
      easing: Easing.out(Easing.ease),
    });
  }, [opacity, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
