import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Transaction, Category } from '../types/database';
import { transactionRepo } from '../database/transactionRepo';
import { categoryRepo } from '../database/categoryRepo';
import { TransactionItem } from '../components/TransactionItem';
import { RawPayloadModal } from '../components/RawPayloadModal';
import { formatVndCurrency } from '../services/telegramService';
import { syncEngine } from '../services/syncEngine';

export const TransactionsScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [allCats, txList] = await Promise.all([
        categoryRepo.getAll(),
        transactionRepo.getTransactions({
          categoryId: selectedCategory,
          search: searchQuery,
          limit: 100,
        }),
      ]);
      setCategories(allCats);
      setTransactions(txList);
    } catch (e) {
      console.error('Failed to load transactions:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadData();
    const unsubscribe = syncEngine.subscribe(() => {
      loadData();
    });
    return unsubscribe;
  }, [loadData]);

  const totalFilteredAmount = transactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);

  const handleDeleteTransaction = async (txId: string) => {
    await transactionRepo.delete(txId);
    setSelectedTx(null);
    await loadData();
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo quán, người nhận, ghi chú..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Category Filter Pills */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              selectedCategory === undefined && styles.filterPillActive,
            ]}
            onPress={() => setSelectedCategory(undefined)}
          >
            <Text
              style={[
                styles.filterPillText,
                selectedCategory === undefined && styles.filterPillTextActive,
              ]}
            >
              Tất cả
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.filterPill,
                selectedCategory === cat.id && styles.filterPillActive,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedCategory === cat.id && styles.filterPillTextActive,
                ]}
              >
                {cat.icon} {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Subheader summary */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryCount}>{transactions.length} giao dịch</Text>
        <Text style={styles.summaryTotal}>
          Tổng chi: <Text style={styles.summaryTotalAmount}>{formatVndCurrency(totalFilteredAmount)}</Text>
        </Text>
      </View>

      {/* Transactions List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TransactionItem transaction={item} onPress={(tx) => setSelectedTx(tx)} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🧾</Text>
            <Text style={styles.emptyTitle}>Không tìm thấy giao dịch nào</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedCategory !== undefined
                ? 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc'
                : 'Bấm quét ở trang chủ hoặc trang cài đặt để nạp email MoMo'}
            </Text>
          </View>
        }
      />

      {/* Detail / Self Learning modal */}
      <RawPayloadModal
        visible={!!selectedTx}
        transaction={selectedTx}
        categories={categories}
        onClose={() => setSelectedTx(null)}
        onRefreshData={loadData}
        onDeleteTransaction={handleDeleteTransaction}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#2563EB',
  },
  filterPillText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  summaryCount: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryTotal: {
    fontSize: 13,
    color: '#64748B',
  },
  summaryTotalAmount: {
    fontWeight: '700',
    color: '#DC2626',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 260,
  },
});
