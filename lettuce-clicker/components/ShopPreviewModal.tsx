import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
} from 'react-native';
import { formatClickValue } from '@/constants/emojiCatalog';

type InventoryEntry = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  owned: boolean;
  tags: string[];
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

  const readableTags = entry.tags
    .slice(0, 5)
    .map((tag) => tag.replace(/[-_]/g, ' '))
    .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));

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
  
  console.log('🎭 Modal render - visible:', visible, 'item:', item?.name || 'null');
  
  if (!item) {
    console.log('🚫 Modal: No item provided, returning null');
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
          <Text style={{ fontSize: 30, fontWeight: 'bold', color: 'black' }}>
            🚨 MODAL IS VISIBLE! 🚨
          </Text>
          <Text style={{ fontSize: 20, color: 'black', textAlign: 'center' }}>
            {item.name}
          </Text>
          <View style={styles.emojiContainer}>
            <View style={styles.halo} />
            <View
              style={[
                styles.circle,
                item.owned && { borderColor: '#16a34a' },
                !item.owned && { borderColor: '#b45309' },
              ]}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
          </View>
          
          <Text style={styles.title}>{item.name}</Text>
          {hasPremiumUpgrade && item.owned && !isEditingName && (
            <Pressable onPress={handleStartEdit} style={styles.editNameButton}>
              <Text style={styles.editNameButtonText}>✏️ Edit Name</Text>
            </Pressable>
          )}
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
          <Text style={styles.description}>{formatEmojiDescription(item)}</Text>
          <Text style={styles.unicode}>
            Unicode: {item.emoji.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}
          </Text>
          <Text style={styles.price}>
            {formatClickValue(item.cost)} clicks
          </Text>
          
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.button,
                (!item.owned && harvest < item.cost) && styles.buttonDisabled,
              ]}
              onPress={handlePurchase}
              disabled={!item.owned && harvest < item.cost}
            >
              <Text style={styles.buttonText}>
                {item.owned
                  ? 'Open in inventory'
                  : harvest >= item.cost
                  ? `Unlock for ${formatClickValue(item.cost)} clicks`
                  : 'Need more clicks'}
              </Text>
            </Pressable>
            
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Close</Text>
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
    backgroundColor: 'rgba(255, 0, 0, 0.95)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
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
    maxWidth: 360,
    borderRadius: 28,
    padding: 28,
    backgroundColor: '#ffff00',
    alignItems: 'center',
    gap: 18,
    shadowColor: 'rgba(15, 23, 42, 0.35)',
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 30,
    borderWidth: 5,
    borderColor: '#ff0000',
  },
  emojiContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(125, 211, 161, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.2)',
    position: 'absolute',
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#15803d',
    shadowColor: 'rgba(21, 128, 61, 0.3)',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
    color: '#6b7280',
    paddingHorizontal: 8,
  },
  unicode: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9ca3af',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f5132',
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 8,
  },
  button: {
    borderRadius: 18,
    paddingVertical: 14,
    backgroundColor: '#1f6f4a',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(31, 111, 74, 0.35)',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.32)',
    alignItems: 'center',
    backgroundColor: '#ecfdf3',
  },
  secondaryButtonText: {
    color: '#0f5132',
    fontWeight: '600',
    fontSize: 15,
  },
  editNameButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  editNameButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
  },
  editNameContainer: {
    width: '100%',
    gap: 10,
  },
  editNameInput: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#86efac',
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  editNameActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editNameSaveButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    alignItems: 'center',
  },
  editNameSaveText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  editNameCancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  editNameCancelText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 15,
  },
});