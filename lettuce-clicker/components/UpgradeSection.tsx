import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type {
  EmojiDefinition,
  EmojiThemeDefinition,
  HomeEmojiTheme,
  UpgradeDefinition,
} from '@/context/GameContext';

const CATEGORY_LABELS: Record<EmojiDefinition['category'], string> = {
  plants: 'Plants & Foliage',
  scenery: 'Scenery & Sky',
  creatures: 'Garden Creatures',
  features: 'Garden Features',
  accents: 'Atmosphere & Accents',
};

const CATEGORY_ICONS: Record<EmojiDefinition['category'], string> = {
  plants: '🪴',
  scenery: '🌅',
  creatures: '🦋',
  features: '🏡',
  accents: '✨',
};

const formatEmojiDescription = (entry: EmojiDefinition) => {
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

type Props = {
  harvest: number;
  autoPerSecond: number;
  upgrades: UpgradeDefinition[];
  purchasedUpgrades: Record<string, number>;
  purchaseUpgrade: (upgradeId: string) => boolean;
  emojiThemes: EmojiThemeDefinition[];
  ownedThemes: Record<HomeEmojiTheme, boolean>;
  purchaseEmojiTheme: (themeId: HomeEmojiTheme) => boolean;
  homeEmojiTheme: HomeEmojiTheme;
  setHomeEmojiTheme: (theme: HomeEmojiTheme) => void;
  emojiCatalog: EmojiDefinition[];
  emojiInventory: Record<string, boolean>;
  title?: string;
};

export function UpgradeSection({
  harvest,
  autoPerSecond,
  upgrades,
  purchasedUpgrades,
  purchaseUpgrade,
  emojiThemes,
  ownedThemes,
  purchaseEmojiTheme,
  homeEmojiTheme,
  setHomeEmojiTheme,
  emojiCatalog,
  emojiInventory,
  title = 'Conservatory Upgrades',
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const styles = useMemo(() => createResponsiveStyles(isLandscape), [isLandscape]);

  const ownedUpgradeCount = useMemo(
    () =>
      Object.values(purchasedUpgrades).reduce((total, value) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return total;
        }
        return total + value;
      }, 0),
    [purchasedUpgrades]
  );

  const lockedAutomationCount = useMemo(
    () =>
      upgrades.reduce((total, upgrade) => {
        const owned = purchasedUpgrades[upgrade.id] ?? 0;
        return total + (owned > 0 ? 0 : 1);
      }, 0),
    [purchasedUpgrades, upgrades]
  );

  const sortedThemes = useMemo(
    () =>
      [...emojiThemes].sort((a, b) => {
        if (a.cost === b.cost) {
          return a.name.localeCompare(b.name);
        }
        return a.cost - b.cost;
      }),
    [emojiThemes]
  );

  const [activeWorkshop, setActiveWorkshop] = useState<'automation' | 'themes'>('automation');
  const [activeSheet, setActiveSheet] = useState<'automation' | 'themes' | null>(null);
  const [collectionExpanded, setCollectionExpanded] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);

  const ownedThemeCount = useMemo(
    () => sortedThemes.filter((theme) => ownedThemes[theme.id]).length,
    [ownedThemes, sortedThemes]
  );

  const lockedThemes = useMemo(
    () => sortedThemes.filter((theme) => !ownedThemes[theme.id]),
    [ownedThemes, sortedThemes]
  );

  const nextThemeCost = lockedThemes.find((theme) => theme.cost > 0)?.cost ?? null;
  const themeToggleHint = lockedThemes.length
    ? nextThemeCost
      ? `Next unlock costs ${nextThemeCost.toLocaleString()} harvest`
      : 'Preview and expand your orbit styles.'
    : 'Showcase every orbit style you own';
  const activeTheme = useMemo(
    () => sortedThemes.find((theme) => theme.id === homeEmojiTheme) ?? null,
    [homeEmojiTheme, sortedThemes]
  );

  const selectedEmojiDetails = useMemo(
    () => emojiCatalog.find((emoji) => emoji.id === selectedEmoji) ?? null,
    [emojiCatalog, selectedEmoji]
  );

  const unlockedEmojis = useMemo(
    () =>
      emojiCatalog
        .filter((emoji) => emojiInventory[emoji.id]),
    [emojiCatalog, emojiInventory]
  );

  const emojiPreview = useMemo(() => unlockedEmojis.slice(0, 8), [unlockedEmojis]);
  const remainingEmojiCount = Math.max(unlockedEmojis.length - emojiPreview.length, 0);
  const hasUnlockedEmojis = unlockedEmojis.length > 0;

  const heroStats = useMemo(
    () => [
      { label: 'Auto clicks /s', value: autoPerSecond.toLocaleString() },
      { label: 'Upgrades owned', value: ownedUpgradeCount.toLocaleString() },
      { label: 'Emoji unlocked', value: unlockedEmojis.length.toLocaleString() },
    ],
    [autoPerSecond, ownedUpgradeCount, unlockedEmojis.length]
  );

  const automationToggleHint = lockedAutomationCount
    ? `${lockedAutomationCount} upgrade${lockedAutomationCount === 1 ? '' : 's'} ready to unlock`
    : 'Reinvest to amplify automation';

  const handleOpenSheet = useCallback(
    (sheet: 'automation' | 'themes') => {
      setActiveWorkshop(sheet);
      setActiveSheet(sheet);
    },
    []
  );

  const handleCloseSheet = useCallback(() => {
    setActiveSheet(null);
  }, []);

  const handleToggleCollection = useCallback(() => {
    if (!hasUnlockedEmojis) {
      return;
    }
    setCollectionExpanded((prev) => !prev);
  }, [hasUnlockedEmojis]);

  const handleEmojiSelect = useCallback((emojiId: string) => {
    setSelectedEmoji((prev) => (prev === emojiId ? null : emojiId));
  }, []);

  useEffect(() => {
    if (!hasUnlockedEmojis) {
      setCollectionExpanded(false);
    }
  }, [hasUnlockedEmojis]);

  return (
    <View style={styles.section}>
      <View style={styles.heroCard}>
        <View style={styles.heroBackdrop}>
          <View style={[styles.heroBubble, styles.heroBubbleOne]} />
          <View style={[styles.heroBubble, styles.heroBubbleTwo]} />
          <View style={[styles.heroBubble, styles.heroBubbleThree]} />
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroOverline}>Lettuce Park</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroHarvest}>{harvest.toLocaleString()} harvest of clicks</Text>
          <View style={styles.heroStatsRow}>
            {heroStats.map((stat, index) => (
              <View
                key={stat.label}
                style={[styles.heroStat, index > 0 && styles.heroStatWithBorder]}
              >
                <Text
                  style={styles.heroStatLabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {stat.label}
                </Text>
                <Text style={styles.heroStatValue}>{stat.value}</Text>
              </View>
            ))}
          </View>
          <Pressable
            // Container for the emoji collection
            style={[
              styles.collectionBlock,
              hasUnlockedEmojis && styles.collectionBlockInteractive,
              collectionExpanded && styles.collectionBlockExpanded,
            ]}
            onPress={() => {
              if (collectionExpanded) {
                setCollectionExpanded(false);
              }
            }}
          >
            <Pressable
              disabled={!hasUnlockedEmojis}
              onPress={handleToggleCollection}
              style={({ pressed }) => [
                styles.collectionHeaderRow,
                pressed && hasUnlockedEmojis && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.collectionLabel}>Emoji collection</Text>
              <View style={styles.collectionMetaRow}>
                <Text style={styles.collectionCount}>{unlockedEmojis.length.toLocaleString()} unlocked</Text>
                {hasUnlockedEmojis ? (
                  <Text style={styles.collectionToggleHint}>
                    {collectionExpanded ? 'Tap to collapse' : 'Tap to view all'}
                  </Text>
                ) : null}
              </View>
            </Pressable>

            {selectedEmojiDetails && (
              <View style={styles.emojiStatsContainer}>
                <View style={styles.emojiStatsHeader}>
                  <View style={styles.emojiStatsIconContainer}>
                    {selectedEmojiDetails.imageUrl ? (
                      <ExpoImage
                        source={{ uri: selectedEmojiDetails.imageUrl }}
                        style={styles.emojiStatsIconImage}
                        contentFit="contain"
                      />
                    ) : (
                      <Text style={styles.emojiStatsIcon}>{selectedEmojiDetails.emoji}</Text>
                    )}
                  </View>
                  <View style={styles.emojiStatsInfo}>
                    <Text style={styles.emojiStatsName}>{selectedEmojiDetails.name}</Text>
                    <Text style={styles.emojiStatsCategory}>
                      {CATEGORY_ICONS[selectedEmojiDetails.category]} {CATEGORY_LABELS[selectedEmojiDetails.category]}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedEmoji(null)}
                    style={styles.emojiStatsCloseButton}
                    hitSlop={8}
                  >
                    <Text style={styles.emojiStatsCloseText}>×</Text>
                  </Pressable>
                </View>
                <View style={styles.emojiStatsDetails}>
                  <Text style={styles.emojiStatsDescription}>{formatEmojiDescription(selectedEmojiDetails)}</Text>
                  <View style={styles.emojiStatsTags}>
                    {selectedEmojiDetails.tags.slice(0, 3).map((tag, index) => (
                      <View key={index} style={styles.emojiStatsTag}>
                        <Text style={styles.emojiStatsTagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {!hasUnlockedEmojis ? (
              <Text style={styles.collectionEmpty}>
                Unlock Garden Shop emojis to fill your conservatory showcase.
              </Text>
            ) : collectionExpanded ? (
              <View style={styles.collectionGrid}>
                {unlockedEmojis.map((emoji, index) => (
                  <Pressable
                    key={`${emoji.id}-${index}`}
                    onPress={() => handleEmojiSelect(emoji.id)}
                    style={[
                      styles.collectionBadge,
                      styles.collectionBadgeLarge,
                      selectedEmoji === emoji.id && styles.collectionBadgeSelected,
                    ]}
                  >
                    {emoji.imageUrl ? (
                      <ExpoImage source={{ uri: emoji.imageUrl }} style={styles.collectionEmojiImage} contentFit="contain" />
                    ) : (
                      <Text style={styles.collectionEmoji}>{emoji.emoji}</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.collectionPreviewRow}>
                {emojiPreview.map((emoji, index) => (
                  <Pressable
                    key={`${emoji.id}-${index}`}
                    onPress={() => handleEmojiSelect(emoji.id)}
                    style={[
                      styles.collectionBadge,
                      selectedEmoji === emoji.id && styles.collectionBadgeSelected,
                    ]}
                  >
                    {emoji.imageUrl ? (
                      <ExpoImage source={{ uri: emoji.imageUrl }} style={styles.collectionEmojiImageSmall} contentFit="contain" />
                    ) : (
                      <Text style={styles.collectionEmoji}>{emoji.emoji}</Text>
                    )}
                  </Pressable>
                ))}
                {remainingEmojiCount > 0 ? (
                  <Pressable
                    onPress={() => setCollectionExpanded(true)}
                    style={({ pressed }) => [
                      styles.collectionBadge,
                      styles.collectionBadgeMore,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.collectionMoreText}>+{remainingEmojiCount}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.workshopToggleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeWorkshop === 'automation' }}
          onPress={() => handleOpenSheet('automation')}
          style={[styles.workshopToggleCard, activeWorkshop === 'automation' && styles.workshopToggleActive]}
        >
          <Text style={[styles.workshopToggleLabel, activeWorkshop === 'automation' && styles.workshopToggleLabelActive]}>
            Automation Upgrades
          </Text>
          <Text style={[styles.workshopToggleHint, activeWorkshop === 'automation' && styles.workshopToggleHintActive]}>
            {automationToggleHint}
          </Text>
          <View style={styles.workshopToggleBadge}>
            <Text style={styles.workshopToggleBadgeText}>⚙️ {ownedUpgradeCount.toLocaleString()} owned</Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeWorkshop === 'themes' }}
          onPress={() => handleOpenSheet('themes')}
          style={[styles.workshopToggleCard, activeWorkshop === 'themes' && styles.workshopToggleActive]}
        >
          <Text style={[styles.workshopToggleLabel, activeWorkshop === 'themes' && styles.workshopToggleLabelActive]}>
            Themes Conservatory
          </Text>
          <Text style={[styles.workshopToggleHint, activeWorkshop === 'themes' && styles.workshopToggleHintActive]}>
            {themeToggleHint}
          </Text>
          <View style={styles.workshopToggleBadge}>
            <Text style={styles.workshopToggleBadgeText}>
              🎨 {lockedThemes.length ? `${lockedThemes.length} locked` : `${ownedThemeCount.toLocaleString()} owned`}
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={activeSheet !== null}
        animationType={isLandscape ? "fade" : "slide"}
        transparent
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={handleCloseSheet}
      >
        <View style={[styles.sheetOverlay, isLandscape && styles.sheetOverlayLandscape]}>
          <Pressable style={styles.sheetBackdrop} onPress={handleCloseSheet} />
          <View style={[styles.sheetCard, isLandscape && styles.sheetCardLandscape, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              {activeSheet === 'automation' ? (
                <View style={styles.workshopPanel}>
                  <View style={styles.panelHeaderRow}>
                    <View style={styles.panelHeaderLeft}>
                      <Text style={styles.panelHeaderEmoji}>🤖</Text>
                      <Text style={styles.panelTitle}>Automation Workshop</Text>
                    </View>
                    <Pressable
                      style={styles.modalCloseButton}
                      onPress={handleCloseSheet}
                      accessibilityRole="button"
                      accessibilityLabel="Close automation workshop"
                    >
                      <Text style={styles.modalCloseText}>❌</Text>
                    </Pressable>
                  </View>
                  <View style={styles.workshopList}>
                    {upgrades.map((upgrade) => {
                      const owned = purchasedUpgrades[upgrade.id] ?? 0;
                      const canAfford = harvest >= upgrade.cost;
                      return (
                        <View key={upgrade.id} style={styles.upgradeCard}>
                          <View style={styles.upgradeHeader}>
                            <View style={styles.upgradeTitleGroup}>
                              <Text style={styles.upgradeEmoji}>{upgrade.emoji}</Text>
                              <Text style={styles.upgradeTitle}>{upgrade.name}</Text>
                            </View>
                            <Text style={styles.upgradeCost}>{upgrade.cost.toLocaleString()} harvest</Text>
                          </View>
                          <Text style={styles.upgradeDescription}>{upgrade.description}</Text>
                          <Text style={styles.upgradeBoost}>+{upgrade.increment.toLocaleString()} auto clicks /s</Text>
                          <Text style={styles.upgradeOwned}>Owned: {owned}</Text>
                          <Pressable
                            accessibilityLabel={`Purchase ${upgrade.name}`}
                            disabled={!canAfford}
                            onPress={() => purchaseUpgrade(upgrade.id)}
                            style={[styles.upgradeButton, !canAfford && styles.upgradeButtonDisabled]}
                          >
                            <Text style={styles.upgradeButtonText}>
                              {canAfford ? 'Purchase upgrade' : 'Need more harvest'}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : activeSheet === 'themes' ? (
                <View style={styles.workshopPanel}>
                  <View style={styles.panelHeaderRow}>
                    <View style={styles.panelHeaderLeft}>
                      <Text style={styles.panelHeaderEmoji}>🎨</Text>
                      <Text style={styles.panelTitle}>Themes Workshop</Text>
                    </View>
                    <Pressable
                      style={styles.modalCloseButton}
                      onPress={handleCloseSheet}
                      accessibilityRole="button"
                      accessibilityLabel="Close themes workshop"
                    >
                      <Text style={styles.modalCloseText}>❌</Text>
                    </Pressable>
                  </View>
                  {activeTheme ? (
                    <View style={styles.themeSummaryCard}>
                      <View style={styles.themeSummaryBadge}>
                        <Text style={styles.themeSummaryEmoji}>{activeTheme.emoji}</Text>
                      </View>
                      <View style={styles.themeSummaryBody}>
                        <Text style={styles.themeSummaryTitle}>{activeTheme.name}</Text>
                        <Text style={styles.themeSummaryCopy}>Currently orbiting your lettuce centerpiece.</Text>
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.themeList}>
                    {sortedThemes.map((theme) => {
                      const owned = ownedThemes[theme.id] ?? false;
                      const isActive = homeEmojiTheme === theme.id;
                      const canAfford = harvest >= theme.cost || theme.cost === 0;
                      const statusLabel = isActive ? 'Active' : owned ? 'Owned' : 'Locked';
                      const costLabel = theme.cost === 0 ? 'Free starter' : `${theme.cost.toLocaleString()} harvest`;

                      return (
                        <View key={theme.id} style={[styles.themeCard, isActive && styles.themeCardActive]}>
                          <View style={styles.themeHeader}>
                            <Text style={styles.themeEmoji}>{theme.emoji}</Text>
                            <View style={styles.themeTitleBlock}>
                              <Text style={styles.themeName}>{theme.name}</Text>
                              <Text style={styles.themeCost}>{costLabel}</Text>
                            </View>
                            <View
                              style={[
                                styles.themeStatusPill,
                                isActive && styles.themeStatusPillActive,
                                owned && !isActive && styles.themeStatusPillOwned,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.themeStatusText,
                                  isActive && styles.themeStatusTextActive,
                                  owned && !isActive && styles.themeStatusTextOwned,
                                ]}
                              >
                                {statusLabel}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.themeDescription}>{theme.description}</Text>
                          <View style={styles.themeActions}>
                            {owned ? (
                              <Pressable
                                accessibilityLabel={`Apply ${theme.name}`}
                                style={[styles.themeApplyButton, isActive && styles.themeApplyButtonDisabled]}
                                onPress={() => setHomeEmojiTheme(theme.id)}
                                disabled={isActive}
                              >
                                <Text style={[styles.themeApplyText, isActive && styles.themeApplyTextDisabled]}>
                                  {isActive ? 'In use' : 'Apply theme'}
                                </Text>
                              </Pressable>
                            ) : (
                              <Pressable
                                accessibilityLabel={`Purchase ${theme.name}`}
                                style={[styles.themePurchaseButton, !canAfford && styles.themePurchaseButtonDisabled]}
                                onPress={() => purchaseEmojiTheme(theme.id)}
                                disabled={!canAfford}
                              >
                                <Text style={[styles.themePurchaseText, !canAfford && styles.themePurchaseTextDisabled]}>
                                  {canAfford ? 'Purchase theme' : 'Need more harvest'}
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createResponsiveStyles = (isLandscape: boolean) => StyleSheet.create({
  section: {
    gap: isLandscape ? 20 : 24,
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#14532d',
    borderRadius: 26,
    padding: 24,
    shadowColor: '#0b3d2c',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 8,
  },
  heroBackdrop: {
    position: 'absolute',
    inset: 0,
  },
  heroBubble: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.55,
  },
  heroBubbleOne: {
    width: 260,
    height: 260,
    backgroundColor: '#166534',
    top: -40,
    left: -60,
    shadowColor: '#064e3b',
    shadowOpacity: 0.45,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 12 },
  },
  heroBubbleTwo: {
    width: 200,
    height: 200,
    backgroundColor: '#0f766e',
    bottom: -40,
    right: -70,
    shadowColor: '#0f766e',
    shadowOpacity: 0.38,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 14 },
  },
  heroBubbleThree: {
    width: 160,
    height: 160,
    backgroundColor: '#bbf7d0',
    top: 40,
    right: -30,
    shadowColor: '#34d399',
    shadowOpacity: 0.35,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
  },
  heroContent: {
    gap: 12,
  },
  heroOverline: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#bbf7d0',
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f0fff4',
  },
  heroHarvest: {
    fontSize: 22,
    fontWeight: '700',
    color: '#dcfce7',
  },
  heroStatsRow: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 118, 110, 0.35)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    columnGap: 18,
    rowGap: 12,
  },
  collectionBlock: {
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(11, 101, 63, 0.32)',
    borderWidth: 1,
    borderColor: 'rgba(186, 230, 200, 0.45)',
    gap: 14,
    overflow: 'hidden',
  },
  collectionBlockInteractive: {
    shadowColor: '#0f766e',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  collectionBlockPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  collectionBlockExpanded: {
    backgroundColor: 'rgba(15, 118, 110, 0.42)',
  },
  collectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collectionLabel: {
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#bbf7d0',
  },
  collectionMetaRow: {
    alignItems: 'center',
    gap: 8,
  },
  collectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dcfce7',
  },
  collectionToggleHint: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: 'rgba(236, 253, 245, 0.76)',
  },
  collectionPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 10,
    marginTop: 12,
  },
  collectionBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(236, 253, 245, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(209, 250, 229, 0.45)',
  },
  collectionBadgeLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  collectionEmoji: {
    fontSize: 20,
  },
  collectionEmojiImage: {
    width: 32,
    height: 32,
  },
  collectionEmojiImageSmall: {
    width: 24,
    height: 24,
  },
  collectionBadgeMore: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  collectionMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#bbf7d0',
  },
  collectionEmpty: {
    fontSize: 13,
    color: '#d1fae5',
    lineHeight: 18,
  },
  heroStat: {
    flex: 1,
    minWidth: 110,
    alignItems: 'center',
    gap: 6,
  },
  heroStatWithBorder: {
    borderLeftWidth: 1,
    borderColor: 'rgba(226, 252, 239, 0.5)',
    paddingLeft: 18,
  },
  heroStatLabel: {
    fontSize: 12,
    color: '#bbf7d0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f0fff4',
  },
  workshopToggleRow: {
    flexDirection: 'row',
    gap: 16,
  },
  workshopToggleCard: {
    flex: 1,
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.22)',
    shadowColor: '#bbf7d0',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
    gap: 8,
  },
  workshopToggleActive: {
    borderColor: '#14532d',
    borderWidth: 2,
    shadowColor: '#0b3d2c',
    shadowOpacity: 0.3,
    elevation: 4,
  },
  workshopToggleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14532d',
  },
  workshopToggleLabelActive: {
    color: '#0f766e',
  },
  workshopToggleHint: {
    fontSize: 13,
    color: '#276749',
    lineHeight: 18,
  },
  workshopToggleHintActive: {
    color: '#0f766e',
  },
  workshopToggleBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#bbf7d0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  workshopToggleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  workshopPanel: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 4,
    gap: 18,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  panelHeaderEmoji: {
    fontSize: 40,
    textAlign: 'center',
    color: '#0f172a',
  },
  panelHeaderBadge: {
    marginTop: 2,
    backgroundColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  panelHeaderBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 31, 23, 0.55)',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetCard: {
    backgroundColor: '#f8fffb',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: 620,
    alignSelf: 'center',
    width: '100%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#cbd5f5',
    marginBottom: 12,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetContent: {
    paddingBottom: 32,
    gap: 20,
  },
  workshopList: {
    gap: 16,
    flexDirection: isLandscape ? 'row' : 'column',
    flexWrap: isLandscape ? 'wrap' : 'nowrap',
  },
  upgradeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#1f2937',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    width: isLandscape ? '48%' : '100%',
  },
  upgradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  upgradeTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#14532d',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  upgradeEmoji: {
    fontSize: 20,
  },
  upgradeCost: {
    fontSize: 15,
    fontWeight: '600',
    color: '#166534',
    maxWidth: '40%',
    textAlign: 'right',
  },
  upgradeDescription: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  upgradeBoost: {
    fontSize: 13,
    color: '#15803d',
    fontWeight: '600',
  },
  upgradeOwned: {
    fontSize: 13,
    color: '#475569',
  },
  upgradeButton: {
    marginTop: 4,
    backgroundColor: '#14532d',
    paddingVertical: 10,
    borderRadius: 12,
  },
  upgradeButtonDisabled: {
    backgroundColor: '#cbd5e0',
  },
  upgradeButtonText: {
    color: '#f0fff4',
    textAlign: 'center',
    fontWeight: '700',
  },
  themeSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ecfeff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  themeSummaryBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  themeSummaryEmoji: {
    fontSize: 30,
  },
  themeSummaryBody: {
    flex: 1,
    gap: 2,
  },
  themeSummaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  themeSummaryCopy: {
    fontSize: 13,
    color: '#075985',
    lineHeight: 18,
  },
  themeList: {
    gap: 16,
  },
  themeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  themeCardActive: {
    borderWidth: 2,
    borderColor: '#34d399',
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeEmoji: {
    fontSize: 30,
  },
  themeTitleBlock: {
    flex: 1,
    gap: 2,
  },
  themeName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  themeCost: {
    fontSize: 13,
    color: '#64748b',
  },
  themeStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  themeStatusPillOwned: {
    backgroundColor: '#bfdbfe',
  },
  themeStatusPillActive: {
    backgroundColor: '#bbf7d0',
  },
  themeStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  themeStatusTextOwned: {
    color: '#1d4ed8',
  },
  themeStatusTextActive: {
    color: '#047857',
  },
  themeDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  themeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themePurchaseButton: {
    flex: 1,
    backgroundColor: '#14532d',
    borderRadius: 12,
    paddingVertical: 10,
  },
  themePurchaseButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  themePurchaseText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#f0fff4',
  },
  themePurchaseTextDisabled: {
    color: '#475569',
  },
  themeApplyButton: {
    flex: 1,
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 10,
  },
  themeApplyButtonDisabled: {
    backgroundColor: '#bae6fd',
  },
  themeApplyText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#f8fafc',
  },
  themeApplyTextDisabled: {
    color: '#1d4ed8',
  },
  sheetOverlayLandscape: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetCardLandscape: {
    height: '100%',
    maxHeight: '100%',
    maxWidth: '100%',
    width: '100%',
    borderRadius: 0,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 16,
  },
  emojiStatsContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    marginHorizontal: 0,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  emojiStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  emojiStatsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#22c55e',
    shadowColor: 'rgba(34, 197, 94, 0.2)',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  emojiStatsIcon: {
    fontSize: 32,
  },
  emojiStatsIconImage: {
    width: 36,
    height: 36,
  },
  emojiStatsInfo: {
    flex: 1,
  },
  emojiStatsName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  emojiStatsCategory: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  emojiStatsDetails: {
    gap: 8,
  },
  emojiStatsDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  emojiStatsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emojiStatsTag: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  emojiStatsTagText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  emojiStatsCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emojiStatsCloseText: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: '600',
  },
  collectionBadgeSelected: {
    borderColor: '#22c55e',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
    transform: [{ scale: 1.1 }],
  },
});
