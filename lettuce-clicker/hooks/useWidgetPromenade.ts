import { NativeModules, Platform } from 'react-native';

const { WidgetPromenadeModule } = NativeModules;

export interface UseWidgetPromenadeResult {
  setWidgetImage: (imageUri: string) => Promise<{ success: boolean; widgetCount: number }>;
  getInstalledWidgetCount: () => Promise<number>;
  getWidgetImageUri: () => Promise<string | null>;
  clearWidgetImage: () => Promise<{ success: boolean }>;
}

/**
 * Hook for managing Android home screen widgets displaying images from the widget promenade
 * Only available on Android platform
 */
export const useWidgetPromenade = (): UseWidgetPromenadeResult => {
  // Return stub implementation for non-Android platforms
  if (Platform.OS !== 'android') {
    return {
      setWidgetImage: async () => ({ success: false, widgetCount: 0 }),
      getInstalledWidgetCount: async () => 0,
      getWidgetImageUri: async () => null,
      clearWidgetImage: async () => ({ success: false }),
    };
  }

  return {
    /**
     * Sets the image on all installed Lettuce Click widgets
     * @param imageUri - Content URI or file URI of the image to display
     * @returns Promise with success status and widget count
     */
    setWidgetImage: async (imageUri: string) => {
      try {
        const result = await WidgetPromenadeModule.setWidgetImage(imageUri);
        return {
          success: true,
          widgetCount: result || 0,
        };
      } catch (error) {
        console.error('Failed to set widget image:', error);
        return {
          success: false,
          widgetCount: 0,
        };
      }
    },

    /**
     * Gets the count of installed Lettuce Click widgets
     * @returns Promise with the number of installed widgets
     */
    getInstalledWidgetCount: async () => {
      try {
        return await WidgetPromenadeModule.getInstalledWidgetCount();
      } catch (error) {
        console.error('Failed to get widget count:', error);
        return 0;
      }
    },

    /**
     * Retrieves the currently set widget image URI
     * @returns Promise with the image URI or null if none set
     */
    getWidgetImageUri: async () => {
      try {
        return await WidgetPromenadeModule.getWidgetImageUri();
      } catch (error) {
        console.error('Failed to get widget image URI:', error);
        return null;
      }
    },

    /**
     * Clears the widget image from all installed widgets
     * @returns Promise with success status
     */
    clearWidgetImage: async () => {
      try {
        await WidgetPromenadeModule.clearWidgetImage();
        return { success: true };
      } catch (error) {
        console.error('Failed to clear widget image:', error);
        return { success: false };
      }
    },
  };
};
