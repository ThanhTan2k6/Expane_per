import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatVndCurrency } from '../services/telegramService';

interface StatCardProps {
  title: string;
  amount: number;
  count?: number;
  icon?: string;
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  amount,
  count,
  icon = '💳',
  color = '#2563EB',
}) => {
  return (
    <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.amount}>{formatVndCurrency(amount)}</Text>
      {count !== undefined && (
        <Text style={styles.subtitle}>{count} giao dịch đã ghi nhận</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  icon: {
    fontSize: 18,
  },
  amount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
