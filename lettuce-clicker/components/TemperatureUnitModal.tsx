import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TemperatureUnit, formatTemperature } from '../lib/weatherUtils';

interface TemperatureUnitModalProps {
  visible: boolean;
  onClose: () => void;
  currentUnit: TemperatureUnit;
  onSelectUnit: (unit: TemperatureUnit) => void;
  sampleTemperature?: number;
}

export function TemperatureUnitModal({
  visible,
  onClose,
  currentUnit,
  onSelectUnit,
  sampleTemperature = 22, // Default sample temp in Celsius
}: TemperatureUnitModalProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleSelectUnit = (unit: TemperatureUnit) => {
    onSelectUnit(unit);
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
      borderRadius: 16,
      padding: 24,
      margin: 20,
      minWidth: 300,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 8,
      color: isDark ? '#FFFFFF' : '#000000',
    },
    subtitle: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 24,
      color: isDark ? '#A0A0A0' : '#666666',
    },
    unitOption: {
      backgroundColor: isDark ? '#3A3A3C' : '#F5F5F5',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    unitOptionSelected: {
      backgroundColor: isDark ? '#0A84FF' : '#007AFF',
      borderColor: isDark ? '#409CFF' : '#0051D5',
    },
    unitOptionText: {
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#000000',
      textAlign: 'center',
    },
    unitOptionTextSelected: {
      color: '#FFFFFF',
    },
    unitExample: {
      fontSize: 12,
      color: isDark ? '#A0A0A0' : '#666666',
      textAlign: 'center',
      marginTop: 4,
    },
    unitExampleSelected: {
      color: '#E5E5EA',
    },
    buttonContainer: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA',
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#007AFF',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={styles.modalContent}>
          <Text style={styles.title}>Temperature Unit</Text>
          <Text style={styles.subtitle}>
            Choose how you’d like temperatures displayed in weather widgets
          </Text>

          <Pressable
            style={[
              styles.unitOption,
              currentUnit === 'celsius' && styles.unitOptionSelected,
            ]}
            onPress={() => handleSelectUnit('celsius')}
          >
            <Text
              style={[
                styles.unitOptionText,
                currentUnit === 'celsius' && styles.unitOptionTextSelected,
              ]}
            >
              Celsius (°C)
            </Text>
            <Text
              style={[
                styles.unitExample,
                currentUnit === 'celsius' && styles.unitExampleSelected,
              ]}
            >
              Example: {formatTemperature(sampleTemperature, 'celsius')}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.unitOption,
              currentUnit === 'fahrenheit' && styles.unitOptionSelected,
            ]}
            onPress={() => handleSelectUnit('fahrenheit')}
          >
            <Text
              style={[
                styles.unitOptionText,
                currentUnit === 'fahrenheit' && styles.unitOptionTextSelected,
              ]}
            >
              Fahrenheit (°F)
            </Text>
            <Text
              style={[
                styles.unitExample,
                currentUnit === 'fahrenheit' && styles.unitExampleSelected,
              ]}
            >
              Example: {formatTemperature(sampleTemperature, 'fahrenheit')}
            </Text>
          </Pressable>

          <View style={styles.buttonContainer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}