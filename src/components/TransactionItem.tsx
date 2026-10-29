import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Transaction } from '../types/database';
import { formatVndCurrency } from '../services/telegramService';
import { CategoryBadge } from './CategoryBadge';

interface TransactionItemProps {
  transaction: Transaction;
  onPress: (transaction: Transaction) => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onPress,
}) => {
  const timeFormatted = new Date(transaction.transaction_time).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isReviewed = transaction.is_reviewed === 1;

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={() => onPress(transaction)}
    >
      <View style={styles.leftCol}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>{transaction.category_icon || '❓'}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.description} numberOfLines={1}>
            {transaction.description || 'Giao dịch không tên'}
          </Text>
          <View style={styles.subRow}>
            <Text style={styles.timeText}>{timeFormatted}</Text>
            <Text style={styles.dot}>•</Text>
            <CategoryBadge
              name={transaction.category_name}
              icon={transaction.category_icon}
              size="small"
            />
            <View style={[styles.reviewBadge, isReviewed ? styles.reviewedBg : styles.autoBg]}>
              <Text style={[styles.reviewText, isReviewed ? styles.reviewedText : styles.autoText]}>
                {isReviewed ? '✓ Đã duyệt' : '🤖 Máy đoán'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.rightCol}>
        <Text style={styles.amount}>-{formatVndCurrency(transaction.amount)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  infoCol: {
    flex: 1,
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  dot: {
    color: '#CBD5E1',
    marginHorizontal: 5,
  },
  reviewBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reviewedBg: {
    backgroundColor: '#ECFDF5',
  },
  autoBg: {
    backgroundColor: '#EFF6FF',
  },
  reviewText: {
    fontSize: 10,
    fontWeight: '600',
  },
  reviewedText: {
    color: '#059669',
  },
  autoText: {
    color: '#3B82F6',
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
});
