import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Transaction, Category } from '../types/database';
import { formatVndCurrency } from '../services/telegramService';
import { CategoryBadge } from './CategoryBadge';
import { learnFromUserCorrection } from '../services/feedbackLearner';

interface RawPayloadModalProps {
  visible: boolean;
  transaction: Transaction | null;
  categories: Category[];
  onClose: () => void;
  onRefreshData: () => Promise<void>;
  onDeleteTransaction: (transactionId: string) => Promise<void>;
}

export const RawPayloadModal: React.FC<RawPayloadModalProps> = ({
  visible,
  transaction,
  categories,
  onClose,
  onRefreshData,
  onDeleteTransaction,
}) => {
  if (!transaction) return null;

  const handleSelectCategory = async (newCatId: number) => {
    try {
      const learn = await learnFromUserCorrection(transaction.id, newCatId);
      let alertMsg = 'Đã cập nhật danh mục cho giao dịch này.';
      if (learn.rememberedCounterparty) {
        alertMsg += `\n🧠 Cơ chế tự học: Đã ghi nhớ "${learn.rememberedCounterparty}". Lần sau các giao dịch từ đối tượng này sẽ được tự động xếp vào đây 100%!`;
      }
      Alert.alert('Đã học quy tắc mới 🎉', alertMsg);
      await onRefreshData();
      onClose();
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể lưu danh mục');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chi tiết & Huấn luyện tự học</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕ Đóng</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.amountText}>-{formatVndCurrency(transaction.amount)}</Text>
            <Text style={styles.descText}>{transaction.description || 'Không có mô tả'}</Text>
            <View style={styles.badgeRow}>
              <CategoryBadge
                name={transaction.category_name}
                icon={transaction.category_icon}
                size="medium"
              />
              <View style={[styles.statusBadge, transaction.is_reviewed ? styles.bgReviewed : styles.bgPredicted]}>
                <Text style={[styles.statusText, transaction.is_reviewed ? styles.txtReviewed : styles.txtPredicted]}>
                  {transaction.is_reviewed ? '✓ Người dùng đã duyệt' : '🤖 Máy tự động đoán'}
                </Text>
              </View>
            </View>
          </View>

          {/* Self Learning Category Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sửa danh mục & Dạy máy tự học (Self-learning)</Text>
            <Text style={styles.sectionHint}>
              Khi chọn danh mục đúng ở đây, hệ thống sẽ tự động ghi nhớ tên quán / người nhận vào bộ nhớ đối tượng để lần sau tự phân loại đúng 100%.
            </Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catOption,
                    transaction.category_id === cat.id && styles.catOptionSelected,
                  ]}
                  onPress={() => handleSelectCategory(cat.id)}
                >
                  <Text style={styles.catOptionIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.catOptionText,
                      transaction.category_id === cat.id && styles.catOptionTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                  {cat.is_essential === 1 && (
                    <Text style={styles.essentialPill}>Thiết yếu</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin kỹ thuật</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Gmail Message ID:</Text>
              <Text style={styles.infoValue} selectable>
                {transaction.id}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Thời gian GD:</Text>
              <Text style={styles.infoValue}>
                {new Date(transaction.transaction_time).toLocaleString('vi-VN')}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Raw Email Snippet (Debug)</Text>
            <View style={styles.rawContainer}>
              <Text style={styles.rawText} selectable>
                {transaction.raw_payload || 'Không có nội dung thô (payload rỗng)'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => {
              onDeleteTransaction(transaction.id);
              onClose();
            }}
          >
            <Text style={styles.deleteBtnText}>🗑️ Xóa giao dịch này</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 15,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  amountText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 6,
  },
  descText: {
    fontSize: 15,
    color: '#334155',
    textAlign: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bgReviewed: {
    backgroundColor: '#ECFDF5',
  },
  bgPredicted: {
    backgroundColor: '#EFF6FF',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  txtReviewed: {
    color: '#059669',
  },
  txtPredicted: {
    color: '#2563EB',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 17,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  catOption: {
    width: '48%',
    margin: '1%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  catOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  catOptionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  catOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  catOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },
  essentialPill: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '65%',
  },
  rawContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    maxHeight: 200,
  },
  rawText: {
    color: '#38BDF8',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 15,
  },
});
