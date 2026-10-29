import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CategoryBadgeProps {
  name?: string | null;
  icon?: string | null;
  size?: 'small' | 'medium';
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  name = 'Chưa phân loại',
  icon = '🏷️',
  size = 'small',
}) => {
  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, isSmall ? styles.badgeSmall : styles.badgeMedium]}>
      <Text style={isSmall ? styles.iconSmall : styles.iconMedium}>{icon || '🏷️'}</Text>
      <Text
        style={[styles.text, isSmall ? styles.textSmall : styles.textMedium]}
        numberOfLines={1}
      >
        {name || 'Chưa phân loại'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeMedium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  iconSmall: {
    fontSize: 12,
    marginRight: 4,
  },
  iconMedium: {
    fontSize: 16,
    marginRight: 6,
  },
  text: {
    color: '#334155',
    fontWeight: '500',
  },
  textSmall: {
    fontSize: 12,
  },
  textMedium: {
    fontSize: 14,
  },
});
