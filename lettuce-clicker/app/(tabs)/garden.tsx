import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import { GardenSection } from '@/components/GardenSection';
import { useGame } from '@/context/GameContext';

export default function GardenScreen() {
  const {
    harvest,
    emojiCatalog,
    emojiInventory,
    placements,
    purchaseEmoji,
    placeEmoji,
    addPhotoPlacement,
    addTextPlacement,
    updatePlacement,
    removePlacement,
    clearGarden,
    registerCustomEmoji,
    addWidgetPromenadePhoto,
    gardenBackgroundColor,
    hasPremiumUpgrade,
    purchasePremiumUpgrade,
  } = useGame();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: gardenBackgroundColor }]}>
      <GardenSection
        harvest={harvest}
        emojiCatalog={emojiCatalog}
        emojiInventory={emojiInventory}
        placements={placements}
        purchaseEmoji={purchaseEmoji}
        placeEmoji={placeEmoji}
        addPhotoPlacement={addPhotoPlacement}
        addTextPlacement={addTextPlacement}
        updatePlacement={updatePlacement}
        removePlacement={removePlacement}
        clearGarden={clearGarden}
        registerCustomEmoji={registerCustomEmoji}
        addWidgetPromenadePhoto={addWidgetPromenadePhoto}
        gardenBackgroundColor={gardenBackgroundColor}
        hasPremiumUpgrade={hasPremiumUpgrade}
        purchasePremiumUpgrade={purchasePremiumUpgrade}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f9f2',
  },
});
