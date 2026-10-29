import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Transaction, CategorySummary, Category, UserProfile } from '../types/database';
import { transactionRepo } from '../database/transactionRepo';
import { categoryRepo } from '../database/categoryRepo';
import { profileRepo } from '../database/profileRepo';
import { syncEngine, SyncReport } from '../services/syncEngine';
import { parseEmailContent } from '../services/regexParser';
import { TransactionItem } from '../components/TransactionItem';
import { RawPayloadModal } from '../components/RawPayloadModal';
import { formatVndCurrency } from '../services/telegramService';

interface DashboardScreenProps {
  onNavigateToTransactions: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateToTransactions,
}) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [totalMonthSpend, setTotalMonthSpend] = useState(0);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [essentialTotal, setEssentialTotal] = useState(0);
  const [discretionaryTotal, setDiscretionaryTotal] = useState(0);
  const [totalTxCount, setTotalTxCount] = useState(0);
  const [categorySummaries, setCategorySummaries] = useState<CategorySummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Edit Budget Modal State
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [editMonthlyBudget, setEditMonthlyBudget] = useState('3000000');
  const [editSavingsTarget, setEditSavingsTarget] = useState('500000');
  const [editOccupation, setEditOccupation] = useState<'student' | 'working'>('student');

  // Quick Paste Notification State
  const [quickPasteVisible, setQuickPasteVisible] = useState(false);
  const [pasteInputText, setPasteInputText] = useState('');
  const [savingPastedTx, setSavingPastedTx] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [p, txList, spendingStats, catSummaries, allCats] = await Promise.all([
        profileRepo.getProfile(),
        transactionRepo.getTransactions({ limit: 5 }),
        transactionRepo.getTotalSpending(firstDayOfMonth),
        transactionRepo.getCategorySummary(firstDayOfMonth),
        categoryRepo.getAll(),
      ]);

      setProfile(p);
      setEditMonthlyBudget(String(p.monthly_budget));
      setEditSavingsTarget(String(p.savings_target));
      setEditOccupation(p.occupation_type);
      setRecentTransactions(txList);
      setTotalMonthSpend(spendingStats.expenseTotal || spendingStats.total);
      setIncomeTotal(spendingStats.incomeTotal || 0);
      setEssentialTotal(spendingStats.essentialTotal);
      setDiscretionaryTotal(spendingStats.discretionaryTotal);
      setTotalTxCount(spendingStats.count);
      setCategorySummaries(catSummaries);
      setCategories(allCats);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // 1. Subscribe to sync events for real-time reactivity
    const unsubscribe = syncEngine.subscribe(() => {
      loadData();
    });

    // 2. Auto-sync on open if Gmail or Background sync is configured
    syncEngine.runSync(false).catch((err) => {
      console.warn('Auto-sync on dashboard mount skipped/failed:', err);
    });

    return unsubscribe;
  }, [loadData]);

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      const report: SyncReport = await syncEngine.runSync(false);
      Alert.alert('Đồng bộ MoMo/Bank', report.message);
      await loadData();
    } catch (err: any) {
      Alert.alert('Lỗi đồng bộ', err.message || 'Không thể đồng bộ');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveBudget = async () => {
    const budgetNum = parseFloat(editMonthlyBudget.replace(/[^\d]/g, '')) || 0;
    const savingsNum = parseFloat(editSavingsTarget.replace(/[^\d]/g, '')) || 0;

    if (budgetNum <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập ngân sách hợp lệ lớn hơn 0');
      return;
    }

    try {
      await profileRepo.updateProfile(budgetNum, editOccupation, savingsNum);
      setBudgetModalVisible(false);
      await loadData();
      Alert.alert('Thành công', 'Đã cập nhật hạn mức ngân sách tháng!');
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể lưu ngân sách');
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    await transactionRepo.delete(txId);
    setSelectedTx(null);
    await loadData();
  };

  const handleOpenQuickPaste = async () => {
    try {
      const clip = await Clipboard.getStringAsync();
      if (clip && clip.trim().length > 3) {
        setPasteInputText(clip.trim());
      }
    } catch (e) {
      // ignore
    }
    setQuickPasteVisible(true);
  };

  const handleSavePastedTx = async () => {
    if (!pasteInputText.trim()) {
      Alert.alert('Chưa có nội dung', 'Vui lòng dán hoặc nhập nội dung thông báo MoMo/Ngân hàng.');
      return;
    }

    try {
      setSavingPastedTx(true);
      const res = await syncEngine.processManualText(pasteInputText.trim());
      if (res.success && res.transaction) {
        setQuickPasteVisible(false);
        setPasteInputText('');
        await loadData();
        const sign = res.transaction.amount > 0 ? '+' : '-';
        Alert.alert(
          'Đã lưu thành công! 🎉',
          `${sign}${formatVndCurrency(res.transaction.amount)} • ${res.transaction.description}`
        );
      } else {
        Alert.alert('Không thể bóc tách', res.error || 'Vui lòng kiểm tra lại nội dung thông báo');
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Lỗi xử lý');
    } finally {
      setSavingPastedTx(false);
    }
  };

  const monthlyBudget = profile?.monthly_budget || 3000000;
  const availableBudget = monthlyBudget + incomeTotal - totalMonthSpend;
  const remainingBudget = Math.max(availableBudget, 0);
  const totalFunding = monthlyBudget + incomeTotal;
  const budgetPercent = Math.min(Math.round((totalMonthSpend / (totalFunding > 0 ? totalFunding : 1)) * 100), 100);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        {/* Student Budget Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <View>
              <Text style={styles.heroBadge}>
                {profile?.occupation_type === 'student' ? '🎓 Sinh viên' : '💼 Đi làm'} • Hạn mức tháng
              </Text>
              <Text style={styles.heroBudgetLabel}>Đã chi {formatVndCurrency(totalMonthSpend)} / {formatVndCurrency(totalFunding)}</Text>
              {incomeTotal > 0 && (
                <Text style={styles.heroIncomeBadge}>
                  💰 Đã nhận: +{formatVndCurrency(incomeTotal)}
                </Text>
              )}
            </View>
            <View style={styles.heroBtnGroup}>
              <TouchableOpacity
                style={styles.editBudgetBtn}
                onPress={() => setBudgetModalVisible(true)}
              >
                <Text style={styles.editBudgetBtnText}>✏️ Đổi hạn mức</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
                onPress={handleSyncNow}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.syncBtnText}>🔄 Quét ngay</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.budgetBarBg}>
            <View
              style={[
                styles.budgetBarFill,
                { width: `${budgetPercent}%` },
                budgetPercent > 85 ? styles.budgetBarDanger : budgetPercent > 65 ? styles.budgetBarWarn : styles.budgetBarNormal,
              ]}
            />
          </View>

          <View style={styles.budgetFooterRow}>
            <Text style={styles.budgetRemainingText}>
              Còn lại: <Text style={styles.budgetRemainingBold}>{formatVndCurrency(remainingBudget)}</Text> ({100 - budgetPercent}%)
            </Text>
            <Text style={styles.savingsTargetText}>
              Mục tiêu tiết kiệm: {formatVndCurrency(profile?.savings_target || 500000)}
            </Text>
          </View>
        </View>

        {/* Quick Action: 1-Tap Paste MoMo / Bank Notification */}
        <TouchableOpacity style={styles.quickPasteBanner} onPress={handleOpenQuickPaste}>
          <Text style={styles.quickPasteIcon}>📋</Text>
          <View style={styles.quickPasteTextContainer}>
            <Text style={styles.quickPasteTitle}>Dán nhanh thông báo MoMo / Bank</Text>
            <Text style={styles.quickPasteSubtitle}>Bóc tách số tiền & tự phân loại danh mục (1 chạm)</Text>
          </View>
          <Text style={styles.quickPasteArrow}>＋</Text>
        </TouchableOpacity>

        {/* Essential vs Discretionary Breakdown */}
        <View style={styles.splitRow}>
          {incomeTotal > 0 && (
            <View style={[styles.splitCard, styles.incomeCard]}>
              <Text style={styles.splitIcon}>💰</Text>
              <Text style={styles.splitTitle}>Tiền vào / Nhận</Text>
              <Text style={[styles.splitAmount, styles.incomeAmount]}>+{formatVndCurrency(incomeTotal)}</Text>
            </View>
          )}

          <View style={[styles.splitCard, styles.essentialCard]}>
            <Text style={styles.splitIcon}>💡</Text>
            <Text style={styles.splitTitle}>Thiết yếu (Cơm, trọ)</Text>
            <Text style={styles.splitAmount}>{formatVndCurrency(essentialTotal)}</Text>
          </View>

          <View style={[styles.splitCard, styles.discretionaryCard]}>
            <Text style={styles.splitIcon}>🎉</Text>
            <Text style={styles.splitTitle}>Phát sinh / Giải trí</Text>
            <Text style={styles.splitAmount}>{formatVndCurrency(discretionaryTotal)}</Text>
          </View>
        </View>

        {/* Categories Breakdown */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Phân loại chi tiêu tháng này</Text>
            <Text style={styles.txCountBadge}>{totalTxCount} GD</Text>
          </View>

          {categorySummaries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Chưa có dữ liệu chi tiêu trong tháng.</Text>
            </View>
          ) : (
            categorySummaries.map((cat, idx) => (
              <View key={cat.category_id ?? idx} style={styles.catSummaryRow}>
                <View style={styles.catSummaryHeader}>
                  <Text style={styles.catName}>
                    {cat.icon} {cat.name}
                  </Text>
                  <Text style={styles.catAmount}>{formatVndCurrency(cat.total_amount)}</Text>
                </View>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(cat.percentage || 0, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.catPercentText}>
                  {cat.percentage}% ({cat.count} giao dịch)
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
            <TouchableOpacity onPress={onNavigateToTransactions}>
              <Text style={styles.seeAllText}>Xem tất cả →</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Chưa có giao dịch nào được ghi nhận.</Text>
            </View>
          ) : (
            recentTransactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                onPress={(item) => setSelectedTx(item)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Debug & Detail Modal */}
      <RawPayloadModal
        visible={!!selectedTx}
        transaction={selectedTx}
        categories={categories}
        onClose={() => setSelectedTx(null)}
        onRefreshData={loadData}
        onDeleteTransaction={handleDeleteTransaction}
      />

      {/* Edit Budget Modal */}
      <Modal
        visible={budgetModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBudgetModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cài đặt Ngân sách & Hạn mức tháng</Text>
            <TouchableOpacity onPress={() => setBudgetModalVisible(false)}>
              <Text style={styles.modalCancelText}>Đóng</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalFormContent}>
            <Text style={styles.modalDesc}>
              Do MoMo/Ngân hàng chủ yếu gửi mail khi tiền chi ra, bạn chỉ cần nhập ngân sách đầu tháng (ví dụ: tiền bố mẹ gửi hoặc tiền lương), app sẽ tự động trừ dần và báo cáo real-time.
            </Text>

            <Text style={styles.modalFieldLabel}>Đối tượng / Nghề nghiệp:</Text>
            <View style={styles.occRow}>
              <TouchableOpacity
                style={[styles.occBtn, editOccupation === 'student' && styles.occBtnActive]}
                onPress={() => setEditOccupation('student')}
              >
                <Text style={[styles.occBtnText, editOccupation === 'student' && styles.occBtnTextActive]}>
                  🎓 Sinh viên
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.occBtn, editOccupation === 'working' && styles.occBtnActive]}
                onPress={() => setEditOccupation('working')}
              >
                <Text style={[styles.occBtnText, editOccupation === 'working' && styles.occBtnTextActive]}>
                  💼 Người đi làm
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalFieldLabel}>Ngân sách tổng 1 tháng (VNĐ):</Text>
            <TextInput
              style={styles.modalInput}
              value={editMonthlyBudget}
              onChangeText={setEditMonthlyBudget}
              placeholder="3000000"
              keyboardType="numeric"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.modalInputHint}>
              Ví dụ: Sinh viên thường là 3,000,000đ - 4,000,000đ
            </Text>

            <Text style={styles.modalFieldLabel}>Mục tiêu tiết kiệm muốn để dành (VNĐ):</Text>
            <TextInput
              style={styles.modalInput}
              value={editSavingsTarget}
              onChangeText={setEditSavingsTarget}
              placeholder="500000"
              keyboardType="numeric"
              placeholderTextColor="#94A3B8"
            />

            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveBudget}>
              <Text style={styles.modalSaveBtnText}>💾 Lưu hạn mức ngân sách</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Quick Paste MoMo / Bank Notification Modal */}
      <Modal visible={quickPasteVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafeContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📋 Dán thông báo MoMo / Bank</Text>
            <TouchableOpacity onPress={() => setQuickPasteVisible(false)}>
              <Text style={styles.modalCancelText}>Đóng</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalFormContent}>
            <Text style={styles.modalDesc}>
              Sao chép thông báo biến động số dư từ thanh trạng thái điện thoại rồi dán vào đây:
            </Text>

            <TextInput
              style={[styles.modalInput, { height: 110, textAlignVertical: 'top' }]}
              value={pasteInputText}
              onChangeText={setPasteInputText}
              placeholder="Ví dụ: Bạn đã thanh toán 35.000đ cho Cơm tấm Ba Ghiền... hoặc Nhận 500.000đ từ NGUYEN VAN A..."
              multiline
              placeholderTextColor="#94A3B8"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 }}>
              <TouchableOpacity
                style={{ paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#E0F2FE', borderRadius: 8 }}
                onPress={async () => {
                  try {
                    const clip = await Clipboard.getStringAsync();
                    if (clip) setPasteInputText(clip);
                  } catch (e) {}
                }}
              >
                <Text style={{ fontSize: 13, color: '#0369A1', fontWeight: '700' }}>📥 Dán từ bộ nhớ tạm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#F1F5F9', borderRadius: 8 }}
                onPress={() => setPasteInputText('')}
              >
                <Text style={{ fontSize: 13, color: '#64748B' }}>Xóa chữ</Text>
              </TouchableOpacity>
            </View>

            {/* Live Preview if text parsed */}
            {pasteInputText.trim().length > 0 && (() => {
              const preview = parseEmailContent('preview', pasteInputText.trim());
              return (
                <View style={{ backgroundColor: '#F0FDF4', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', marginVertical: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534', marginBottom: 4 }}>
                    🔎 KẾT QUẢ BÓC TÁCH TỰ ĐỘNG:
                  </Text>
                  <Text style={{ fontSize: 16, color: preview.isIncome ? '#16A34A' : '#DC2626', fontWeight: '800' }}>
                    {preview.isIncome ? '💰 Tiền vào (+):' : '💸 Tiền ra (-):'} {formatVndCurrency(preview.amount)}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>
                    📝 Mô tả: <Text style={{ fontWeight: '600' }}>{preview.description}</Text>
                  </Text>
                  {preview.counterparty ? (
                    <Text style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>
                      👤 Đối tác / Người chuyển: <Text style={{ fontWeight: '600' }}>{preview.counterparty}</Text>
                    </Text>
                  ) : null}
                </View>
              );
            })()}

            <TouchableOpacity
              style={[styles.modalSaveBtn, savingPastedTx && { opacity: 0.7 }]}
              onPress={handleSavePastedTx}
              disabled={savingPastedTx}
            >
              {savingPastedTx ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalSaveBtnText}>💾 Lưu vào sổ chi tiêu ngay</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  heroBadge: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroBudgetLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  heroIncomeBadge: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  quickPasteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  quickPasteIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  quickPasteTextContainer: {
    flex: 1,
  },
  quickPasteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
  },
  quickPasteSubtitle: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 1,
  },
  quickPasteArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563EB',
    marginLeft: 6,
  },
  heroBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editBudgetBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 6,
  },
  editBudgetBtnText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 12,
  },
  syncBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  syncBtnDisabled: {
    opacity: 0.6,
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  budgetBarBg: {
    height: 10,
    backgroundColor: '#334155',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  budgetBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  budgetBarNormal: {
    backgroundColor: '#10B981',
  },
  budgetBarWarn: {
    backgroundColor: '#F59E0B',
  },
  budgetBarDanger: {
    backgroundColor: '#EF4444',
  },
  budgetFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetRemainingText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  budgetRemainingBold: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  savingsTargetText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '500',
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  splitCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  essentialCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  discretionaryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  incomeCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  incomeAmount: {
    color: '#059669',
  },
  splitIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  splitTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  splitAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  txCountBadge: {
    fontSize: 12,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  seeAllText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  emptyCard: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  catSummaryRow: {
    marginBottom: 14,
  },
  catSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  catAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  catPercentText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
  },
  modalSafeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCancelText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  modalFormContent: {
    padding: 16,
  },
  modalDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 8,
  },
  occRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  occBtn: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  occBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  occBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  occBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  modalInputHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 8,
  },
  modalSaveBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
