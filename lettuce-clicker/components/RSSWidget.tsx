import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  RefreshControl,
  Linking,
  Dimensions,
  PanResponder,
  Animated,
  Modal,
  SafeAreaView
} from 'react-native';
import { type RSSFeedItem } from '@/lib/rssService';
import { useGame } from '@/context/GameContext';

interface RSSWidgetProps {
  height?: number;
}

export const RSSWidget: React.FC<RSSWidgetProps> = ({ height = 80 }) => {
  const { rssFeeds, rssItems, updateRSSFeeds, orbitingUpgradeEmojis } = useGame();
  const [refreshing, setRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const screenHeight = Dimensions.get('window').height;

  // Simple pan responder for swipe up
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy < -30) {
          // Swipe up detected - show modal
          setIsExpanded(true);
        }
      },
    })
  ).current;

  // Load items on mount and when feeds change
  useEffect(() => {
    loadItems();
  }, [rssFeeds]);

  // Monitor rssItems changes
  useEffect(() => {
    // Only log occasionally when items actually change significantly
    if (rssItems.length > 0 && rssItems.length % 10 === 0) {
      console.log('📰 RSS Items updated:', rssItems.length, 'items');
    }
  }, [rssItems]);

  const loadItems = async () => {
    try {
      // Trigger RSS update which will populate context state
      await updateRSSFeeds();
    } catch (error) {
      console.warn('RSS loading error:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await updateRSSFeeds();
      // Simulate refresh delay for UX
      setTimeout(() => {
        loadItems();
        setRefreshing(false);
      }, 300);
    } catch (error) {
      console.warn('RSS refresh error:', error);
      setRefreshing(false);
    }
  };

  const handleItemPress = async (item: RSSFeedItem) => {
    console.log('RSS item pressed:', item.title);
    try {
      const supported = await Linking.canOpenURL(item.link);
      if (supported) {
        await Linking.openURL(item.link);
        console.log('📱 Opened article in system browser:', item.link);
      } else {
        Alert.alert(
          'Cannot Open Link',
          `Unable to open this article: ${item.title}`,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Failed to open article:', error);
      Alert.alert(
        'Error',
        'Failed to open the article. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };



  if (rssItems.length === 0) {
    return (
      <Animated.View 
        style={[styles.container, { height }]} 
        {...panResponder.panHandlers}
      >
        {/* Subtle swipe indicator */}
        <View style={styles.swipeIndicator}>
          <View style={styles.swipeHandle} />
        </View>
        
        <View style={styles.previewContainer}>
          <View style={styles.previewMainRow}>
            <Text style={styles.previewTitle}>📰 RSS Articles</Text>
          </View>
          <Text style={styles.moreIndicator}>
            Swipe up to configure feeds
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View 
      style={[styles.expandableContainer, { height }]} 
      {...panResponder.panHandlers}
    >
      {/* Subtle swipe indicator */}
      <View style={styles.swipeIndicator}>
        <View style={styles.swipeHandle} />
      </View>
      
      {/* RSS Articles Preview Footer */}
      <View style={styles.footerSection}>
        <View style={styles.previewContainer}>
          {/* Main horizontal layout */}
          <View style={styles.previewMainRow}>
            <Text style={styles.previewTitle}>📰 RSS Articles</Text>
            <View style={styles.previewArticles}>
              {rssItems.slice(0, 2).map((item: RSSFeedItem, index: number) => (
                <TouchableOpacity 
                  key={item.id}
                  style={styles.previewArticle}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.previewSource}>{item.source?.toUpperCase()}</Text>
                  <Text style={styles.previewText} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {/* Bottom indicator */}
          {rssItems.length > 2 && (
            <Text style={styles.moreIndicator}>
              Swipe up for {rssItems.length - 2} more articles
            </Text>
          )}
        </View>
      </View>

      
      {/* Simple Modal */}
      <Modal
        visible={isExpanded}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsExpanded(false)}
      >
        <View style={styles.modalFullScreen}>
          {/* Emoji background pattern when user has collected emojis */}
          {orbitingUpgradeEmojis && orbitingUpgradeEmojis.length > 0 && (
            <View style={styles.emojiBackground}>
              {Array.from({ length: 15 }, (_, i) => {
                const emoji = orbitingUpgradeEmojis[i % orbitingUpgradeEmojis.length];
                return (
                  <Text key={i} style={[
                    styles.backgroundEmoji,
                    {
                      left: `${(i * 28 + 12) % 95}%`,
                      top: `${(i * 18 + 15) % 85}%`,
                      opacity: 0.1,
                    }
                  ]}>
                    {emoji.emoji}
                  </Text>
                );
              })}
            </View>
          )}
          
          <SafeAreaView style={styles.modalSafeWrapper}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📰 RSS Articles</Text>
              <TouchableOpacity onPress={() => setIsExpanded(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.modalContent}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.gridContainer}>
                {rssItems.map((item: RSSFeedItem, index: number) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.gridItem}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.gridSource}>{item.source?.toUpperCase()}</Text>
                    <Text style={styles.gridTitle} numberOfLines={3}>
                      {item.title}
                    </Text>
                    <Text style={styles.gridMeta}>Tap to read</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent', // Transparent - parent provides white footer background
    borderRadius: 0, // No border radius for edge-to-edge footer
    flex: 1, // Fill the footer container
  },
  expandableContainer: {
    backgroundColor: 'white',
    borderRadius: 0,
    overflow: 'hidden',
    minHeight: 100,
  },
  footerSection: {
    height: 100, // Fixed height for the footer section
    backgroundColor: 'white',
  },
  expandedContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 10,
  },
  articlesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  gridArticleContainer: {
    width: '31%', // 3 columns with spacing
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  gridSourceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 4,
  },
  gridTitleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 14,
    marginBottom: 6,
  },
  gridMetaText: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 20, // Increased for better spacing
    alignItems: 'flex-start', // Align to top instead of center
    minHeight: '100%',
    paddingVertical: 0, // Remove vertical padding to maximize space
    flexDirection: 'row', // Ensure horizontal layout
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  // Subtle container for empty state in footer
  emptyWidgetContainer: {
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  emptyText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '500',
  },
  debugText: {
    position: 'absolute',
    top: 4,
    left: 16,
    fontSize: 10,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  articleContainer: {
    minWidth: 220, // Optimized for compact footer
    maxWidth: 260, // Better fit in reduced height
    paddingHorizontal: 12, // Reduced padding for compact design
    paddingVertical: 6, // Compact vertical padding for smaller footer
    backgroundColor: 'rgba(255, 255, 255, 0.98)', // High opacity white background for maximum readability
    borderRadius: 12, // Larger radius for modern look
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3, // More pronounced shadow
    },
    shadowOpacity: 0.12, // Stronger shadow for better definition
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)', // More visible border for definition
  },
  sourceText: {
    fontSize: 10, // Compact size for footer
    fontWeight: '800', // Very bold for visibility
    color: '#1e40af', // Strong blue for visibility
    letterSpacing: 0.4, // Tighter spacing
    marginBottom: 4, // Reduced space for compact design
    textTransform: 'uppercase',
  },
  titleText: {
    fontSize: 13, // Slightly smaller for compact footer
    fontWeight: '700', // Bolder for better visibility
    color: '#000000', // Pure black for maximum contrast
    lineHeight: 16, // Tighter line height for compact display
    flexWrap: 'wrap', // Allow text to wrap properly
  },
  separator: {
    width: 12, // Spacing between cards
  },
  swipeIndicator: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  swipeHandle: {
    width: 36,
    height: 3,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
  },
  modalContainer: {
    backgroundColor: '#fff',
    maxHeight: '90%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '31%',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  gridSource: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 4,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16,
    marginBottom: 6,
  },
  gridMeta: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  // New footer navigator styles
  previewContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  previewMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginRight: 16,
    minWidth: 100, // Fixed width for the title
  },
  previewArticles: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewArticle: {
    flex: 1,
    marginHorizontal: 4,
  },
  previewSource: {
    fontSize: 8,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 1,
  },
  previewText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 12,
  },
  moreIndicator: {
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalFullScreen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    width: '100%',
    height: '100%',
  },
  modalSafeWrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalScrollContent: {
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  emojiBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  backgroundEmoji: {
    position: 'absolute',
    fontSize: 24,
    zIndex: -1,
  },
});