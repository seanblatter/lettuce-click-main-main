import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { formatClickValue } from '@/constants/emojiCatalog';

type InventoryEntry = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  owned: boolean;
  tags: string[];
  imageUrl?: string;
};

interface ShopPreviewModalProps {
  visible: boolean;
  item: InventoryEntry | null;
  harvest: number;
  hasPremiumUpgrade?: boolean;
  onClose: () => void;
  onPurchase: (itemId: string) => boolean;
  onRename?: (itemId: string, newName: string) => void;
}

const formatEmojiDescription = (entry: InventoryEntry) => {
  if (!entry.tags.length) {
    return 'A fresh garden accent ready to brighten your park.';
  }

  // Get the displayed tags (first 3) to filter them out of description
  const displayedTags = entry.tags.slice(0, 3).map(tag => tag.toLowerCase());
  
  const readableTags = entry.tags
    .slice(0, 5)
    .filter(tag => {
      // Remove tags that are shown as hashtags (first 3 tags)
      const normalized = tag.toLowerCase().replace(/[-_]/g, ' ');
      return !displayedTags.some(displayedTag => {
        const displayedNormalized = displayedTag.toLowerCase().replace(/[-_]/g, ' ');
        return normalized === displayedNormalized || normalized.includes(displayedNormalized) || displayedNormalized.includes(normalized);
      });
    })
    .map((tag) => tag.replace(/[-_]/g, ' '))
    .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));

  if (readableTags.length === 0) {
    return 'A unique decoration for your garden.';
  }

  if (readableTags.length === 1) {
    return `${readableTags[0]} inspiration for your garden layouts.`;
  }

  const last = readableTags[readableTags.length - 1];
  const others = readableTags.slice(0, -1);
  return `${others.join(', ')} and ${last} combine in this decoration.`;
};

export const ShopPreviewModal: React.FC<ShopPreviewModalProps> = ({
  visible,
  item,
  harvest,
  hasPremiumUpgrade = false,
  onClose,
  onPurchase,
  onRename,
}) => {
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [editedName, setEditedName] = React.useState('');
  const flipAnimation = useRef(new Animated.Value(0)).current;
  
  if (!item) {
    return null;
  }

  const handleStartEdit = () => {
    setEditedName(item.name);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (editedName.trim() && onRename) {
      onRename(item.id, editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const handlePurchase = () => {
    if (!item.owned) {
      const success = onPurchase(item.id);
      if (success) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleEmojiIconFlip = useCallback(() => {
    flipAnimation.setValue(0);
    Animated.timing(flipAnimation, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [flipAnimation]);

  const flipInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Pressable onPress={handleEmojiIconFlip}>
              <Animated.View 
                style={[
                  styles.iconContainer,
                  {
                    transform: [{ rotateY: flipInterpolate }],
                  },
                ]}
              >
                {item.imageUrl ? (
                  <ExpoImage
                    source={{ uri: item.imageUrl }}
                    style={styles.iconImage}
                    contentFit="contain"
                  />
                ) : (
                  <Text style={styles.icon}>{item.emoji}</Text>
                )}
              </Animated.View>
            </Pressable>
            <View style={[styles.info, { flex: 1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.name, { flex: 1 }]}>{item.name}</Text>
                {hasPremiumUpgrade && item.owned && !isEditingName && (
                  <Pressable 
                    onPress={handleStartEdit}
                    hitSlop={8}
                  >
                    <Text style={{ fontSize: 20 }}>✏️</Text>
                  </Pressable>
                )}
              </View>
              {isEditingName && (
                <View style={styles.editNameContainer}>
                  <TextInput
                    style={styles.editNameInput}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="Enter custom name"
                    maxLength={40}
                    autoFocus
                  />
                  <View style={styles.editNameActions}>
                    <Pressable onPress={handleSaveName} style={styles.editNameSaveButton}>
                      <Text style={styles.editNameSaveText}>Save</Text>
                    </Pressable>
                    <Pressable onPress={handleCancelEdit} style={styles.editNameCancelButton}>
                      <Text style={styles.editNameCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.details}>
            <Text style={styles.description}>{formatEmojiDescription(item)}</Text>
            <View style={styles.tags}>
              {item.tags.slice(0, 3).map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
          
          <View style={styles.actions}>
            {!item.owned && (
              <Pressable
                style={[
                  styles.purchaseButton,
                  harvest < item.cost && styles.purchaseButtonDisabled,
                ]}
                onPress={handlePurchase}
                disabled={harvest < item.cost}
              >
                <Text style={[styles.purchaseButtonText, harvest < item.cost && styles.purchaseButtonTextDisabled]}>
                  {harvest >= item.cost
                    ? `Buy for ${formatClickValue(item.cost)}`
                    : 'Need more clicks'}
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>
                {item.owned ? 'Close' : 'Cancel'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    shadowColor: 'rgba(15, 23, 42, 0.35)',
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#22c55e',
    shadowColor: 'rgba(34, 197, 94, 0.2)',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  icon: {
    fontSize: 32,
  },
  iconImage: {
    width: 36,
    height: 36,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  details: {
    gap: 8,
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  tagText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  actions: {
    marginTop: 16,
    gap: 8,
  },
  purchaseButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  purchaseButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  purchaseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  purchaseButtonTextDisabled: {
    color: '#6b7280',
  },
  closeButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  editNameContainer: {
    marginTop: 8,
    gap: 8,
  },
  editNameInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#0f172a',
  },
  editNameActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editNameSaveButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  editNameSaveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  editNameCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  editNameCancelText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});