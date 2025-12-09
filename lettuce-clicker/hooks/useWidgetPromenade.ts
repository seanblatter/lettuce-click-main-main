import { NativeModules, Platform } from 'react-native';

const { WidgetPromenadeModule } = NativeModules;

export interface UseWidgetPromenadeResult {
  setWidgetImage: (imageUri: string) => Promise<{ success: boolean; widgetCount: number }>;
  getInstalledWidgetCount: () => Promise<number>;
  getWidgetImageUri: () => Promise<string | null>;
  clearWidgetImage: () => Promise<{ success: boolean }>;
}

export const useWidgetPromenade = (): UseWidgetPromenadeResult => {
  const isAndroidWithModule = Platform.OS === 'android' && WidgetPromenadeModule;
  
  if (!isAndroidWithModule) {
    return {
      setWidgetImage: async () => ({ success: false, widgetCount: 0 }),
      getInstalledWidgetCount: async () => 0,
      getWidgetImageUri: async () => null,
      clearWidgetImage: async () => ({ success: false }),
    };
  }

  return {
    setWidgetImage: async (imageUri: string) => {
      try {
        const result = await WidgetPromenadeModule.setWidgetImage(imageUri);
        return { success: true, widgetCount: result?.widgetCount || result || 0 };
      } catch (error) {
        console.error('Failed to set widget image:', error);
        return { success: false, widgetCount: 0 };
      }
    },

    getInstalledWidgetCount: async () => {
      try {
        return await WidgetPromenadeModule.getInstalledWidgetCount();
      } catch (error) {
        console.error('Failed to get widget count:', error);
        return 0;
      }
    },

    getWidgetImageUri: async () => {
      try {
        return await WidgetPromenadeModule.getWidgetImageUri();
      } catch (error) {
        console.error('Failed to get widget image URI:', error);
        return null;
      }
    },

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
