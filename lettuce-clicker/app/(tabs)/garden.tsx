import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Modal, View, Text, Pressable } from 'react-native';
import { useCallback, useState } from 'react';
import * as MediaLibrary from 'expo-media-library';

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
    setCustomEmojiName,
    freeBlendsUsed,
    incrementFreeBlendsUsed,
  } = useGame();

  const [showGardenSaveModal, setShowGardenSaveModal] = useState(false);
  const [pendingGardenUri, setPendingGardenUri] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const handleGardenSave = useCallback((uri: string) => {
    setPendingGardenUri(uri);
    setShowGardenSaveModal(true);
  }, []);

  const handleSaveAndAddToPromenade = useCallback(async () => {
    if (!pendingGardenUri) return;
    try {
      await MediaLibrary.saveToLibraryAsync(pendingGardenUri);
      const entry = addWidgetPromenadePhoto(pendingGardenUri);
      if (entry) {
        setPendingGardenUri(null);
        setShowGardenSaveModal(false);
      }
    } catch (error) {
      console.error('Failed to save garden:', error);
      setSaveError('Failed to save snapshot. Please try again.');
      setShowErrorModal(true);
    }
  }, [pendingGardenUri, addWidgetPromenadePhoto]);

  const handleSavePhotosOnly = useCallback(async () => {
    if (!pendingGardenUri) return;
    try {
      await MediaLibrary.saveToLibraryAsync(pendingGardenUri);
      setPendingGardenUri(null);
      setShowGardenSaveModal(false);
    } catch (error) {
      console.error('Failed to save garden:', error);
      setSaveError('Failed to save snapshot. Please try again.');
      setShowErrorModal(true);
    }
  }, [pendingGardenUri]);

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
        setCustomEmojiName={setCustomEmojiName}
        freeBlendsUsed={freeBlendsUsed}
        incrementFreeBlendsUsed={incrementFreeBlendsUsed}
        onGardenSave={handleGardenSave}
      />

      <Modal
        visible={showGardenSaveModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowGardenSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <Text style={styles.modalIcon}>🖼️</Text>
            </View>
            <Text style={styles.modalTitle}>Garden Saved</Text>
            <Text style={styles.modalCopy}>Your garden snapshot is now in your photos. Would you like to add it to your Promenade Gallery?</Text>
            <View style={{ gap: 12 }}>
              <Pressable
                style={styles.modalButton}
                onPress={handleSaveAndAddToPromenade}
              >
                <Text style={styles.modalButtonText}>Add to Promenade Gallery</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: '#f0fdf4', borderColor: '#1f6f4a', borderWidth: 1 }]}
                onPress={handleSavePhotosOnly}
              >
                <Text style={[styles.modalButtonText, { color: '#1f6f4a' }]}>Photos Only</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showErrorModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <Text style={styles.modalIcon}>⚠️</Text>
            </View>
            <Text style={styles.modalTitle}>Save Failed</Text>
            <Text style={styles.modalCopy}>{saveError}</Text>
            <Pressable
              style={styles.modalButton}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f9f2',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#1f6f4a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#dcfce7',
  },
  modalIcon: {
    fontSize: 56,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f6f4a',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalCopy: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: '#1f6f4a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 200,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
});
