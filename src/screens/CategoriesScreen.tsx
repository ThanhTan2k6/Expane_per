import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Category, CategoryKeyword, CounterpartyRule } from '../types/database';
import { categoryRepo } from '../database/categoryRepo';
import { counterpartyRepo } from '../database/counterpartyRepo';

type ViewMode = 'categories' | 'learned_rules';

export const CategoriesScreen: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [keywords, setKeywords] = useState<CategoryKeyword[]>([]);
  const [counterpartyRules, setCounterpartyRules] = useState<CounterpartyRule[]>([]);
  const [loading, setLoading] = useState(false);

  // Add Keyword Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<number>(1);
  const [newKeyword, setNewKeyword] = useState('');
  const [newPriority, setNewPriority] = useState('1');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [allCats, allKws, allCps] = await Promise.all([
        categoryRepo.getAll(),
        categoryRepo.getKeywords(),
        counterpartyRepo.getAll(),
      ]);
      setCategories(allCats);
      setKeywords(allKws);
      setCounterpartyRules(allCps);
    } catch (e) {
      console.error('Failed to load categories:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập từ khóa');
      return;
    }

    try {
      await categoryRepo.addKeyword(
        selectedCatId,
        newKeyword.trim(),
        parseInt(newPriority, 10) || 1
      );
      setNewKeyword('');
      setModalVisible(false);
      await loadData();
      Alert.alert('Thành công', 'Đã thêm từ khóa thông minh mới');
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể thêm từ khóa');
    }
  };

  const handleDeleteKeyword = (kw: CategoryKeyword) => {
    Alert.alert(
      'Xóa từ khóa',
      `Bạn có muốn xóa từ khóa "${kw.keyword}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            await categoryRepo.deleteKeyword(kw.keyword_id);
            await loadData();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Switch Tab: Danh mục vs Tự học */}
      <View style={styles.switchTabs}>
        <TouchableOpacity
          style={[styles.switchTab, viewMode === 'categories' && styles.switchTabActive]}
          onPress={() => setViewMode('categories')}
        >
          <Text style={[styles.switchTabText, viewMode === 'categories' && styles.switchTabTextActive]}>
            🏷️ Danh mục & Từ khóa
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switchTab, viewMode === 'learned_rules' && styles.switchTabActive]}
          onPress={() => setViewMode('learned_rules')}
        >
          <Text style={[styles.switchTabText, viewMode === 'learned_rules' && styles.switchTabTextActive]}>
            🧠 Bộ nhớ tự học ({counterpartyRules.length})
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'categories' ? (
        <>
          <View style={styles.headerBar}>
            <Text style={styles.headerDesc}>
              Hệ thống tự động so khớp từ khóa có trọng số để gán nhãn chính xác 99%.
            </Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.addBtnText}>+ Thêm từ khóa thông minh</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={categories}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshing={loading}
            onRefresh={loadData}
            renderItem={({ item }) => {
              const catKeywords = keywords.filter((k) => k.category_id === item.id);
              return (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.iconCircle}>{item.icon || '🏷️'}</Text>
                      <View>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        <View style={styles.pillRow}>
                          <Text
                            style={[
                              styles.typePill,
                              item.is_essential === 1 ? styles.essentialBg : styles.discretionaryBg,
                            ]}
                          >
                            {item.is_essential === 1 ? '💡 Thiết yếu' : '🎉 Phát sinh'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.keywordLabel}>Từ khóa nhận diện ({catKeywords.length}):</Text>
                  <View style={styles.keywordTagsWrap}>
                    {catKeywords.length > 0 ? (
                      catKeywords.map((kw) => (
                        <TouchableOpacity
                          key={kw.keyword_id}
                          style={[
                            styles.keywordPill,
                            kw.priority === 2 && styles.keywordPriorityPill,
                          ]}
                          onLongPress={() => handleDeleteKeyword(kw)}
                        >
                          <Text
                            style={[
                              styles.keywordPillText,
                              kw.priority === 2 && styles.keywordPriorityText,
                            ]}
                          >
                            {kw.keyword} {kw.priority === 2 && '⚡'}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.noKeywordsText}>Chưa có từ khóa</Text>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </>
      ) : (
        /* Counterparty Memory Tab */
        <ScrollView contentContainerStyle={styles.memoryContent}>
          <View style={styles.memoryInfoBox}>
            <Text style={styles.memoryInfoTitle}>🧠 Cơ chế Lưu nhớ Đối tượng (Counterparty Memory)</Text>
            <Text style={styles.memoryInfoDesc}>
              Khi bạn sửa danh mục một giao dịch, app tự động ghi nhớ tên người nhận / quán quen đó. Lần sau dù giao dịch có để trống nội dung thì máy vẫn tự động gán vào danh mục bạn đã chỉ định!
            </Text>
          </View>

          {counterpartyRules.length === 0 ? (
            <View style={styles.emptyMemory}>
              <Text style={styles.emptyMemoryEmoji}>🤖</Text>
              <Text style={styles.emptyMemoryTitle}>Chưa có quy tắc tự học nào</Text>
              <Text style={styles.emptyMemoryDesc}>
                Khi bạn chỉnh sửa một giao dịch trong lịch sử, máy sẽ bắt đầu học và hiển thị ở đây.
              </Text>
            </View>
          ) : (
            counterpartyRules.map((rule) => {
              const cat = categories.find((c) => c.id === rule.category_id);
              return (
                <View key={rule.id} style={styles.ruleCard}>
                  <View style={styles.ruleLeft}>
                    <Text style={styles.ruleTarget}>"{rule.counterparty_name}"</Text>
                    <Text style={styles.ruleArrow}>➜ Tự gán vào:</Text>
                  </View>
                  <View style={styles.ruleRight}>
                    <Text style={styles.ruleCategory}>
                      {cat?.icon} {cat?.name || 'Chưa rõ'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add Keyword Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Thêm từ khóa thông minh</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalForm}>
            <Text style={styles.fieldLabel}>Chọn danh mục gán nhãn:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catPickerScroll}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catPickPill, selectedCatId === c.id && styles.catPickPillActive]}
                  onPress={() => setSelectedCatId(c.id)}
                >
                  <Text style={[styles.catPickText, selectedCatId === c.id && styles.catPickTextActive]}>
                    {c.icon} {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Từ khóa thô (xuất hiện trong mail MoMo/Ngân hàng):</Text>
            <TextInput
              style={styles.input}
              value={newKeyword}
              onChangeText={setNewKeyword}
              placeholder="Ví dụ: shopeefood, winmart, cây xăng, sách..."
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Mức độ ưu tiên:</Text>
            <View style={styles.priorityRow}>
              <TouchableOpacity
                style={[styles.priorityBtn, newPriority === '1' && styles.priorityBtnActive]}
                onPress={() => setNewPriority('1')}
              >
                <Text style={[styles.priorityBtnText, newPriority === '1' && styles.priorityBtnTextActive]}>
                  Bình thường (1)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.priorityBtn, newPriority === '2' && styles.priorityBtnActive]}
                onPress={() => setNewPriority('2')}
              >
                <Text style={[styles.priorityBtnText, newPriority === '2' && styles.priorityBtnTextActive]}>
                  Ưu tiên cao ⚡ (2)
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleAddKeyword}>
              <Text style={styles.saveBtnText}>Lưu từ khóa</Text>
            </TouchableOpacity>
          </View>
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
  switchTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  switchTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  switchTabActive: {
    borderBottomColor: '#2563EB',
  },
  switchTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  switchTabTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  headerBar: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 17,
  },
  addBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    fontSize: 24,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  pillRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  typePill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  essentialBg: {
    backgroundColor: '#D1FAE5',
    color: '#059669',
  },
  discretionaryBg: {
    backgroundColor: '#FEF3C7',
    color: '#D97706',
  },
  keywordLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 6,
    fontWeight: '600',
  },
  keywordTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  keywordPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  keywordPriorityPill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  keywordPillText: {
    fontSize: 11,
    color: '#475569',
  },
  keywordPriorityText: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  noKeywordsText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  memoryContent: {
    padding: 16,
    paddingBottom: 40,
  },
  memoryInfoBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  memoryInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  memoryInfoDesc: {
    fontSize: 12,
    color: '#15803D',
    lineHeight: 17,
  },
  emptyMemory: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyMemoryEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyMemoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  emptyMemoryDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 260,
  },
  ruleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  ruleLeft: {
    flex: 1,
  },
  ruleTarget: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  ruleArrow: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  ruleRight: {},
  ruleCategory: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  modalContainer: {
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
  cancelText: {
    fontSize: 15,
    color: '#64748B',
  },
  modalForm: {
    padding: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  catPickerScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
    marginBottom: 8,
  },
  catPickPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  catPickPillActive: {
    backgroundColor: '#2563EB',
  },
  catPickText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  catPickTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  priorityBtn: {
    width: '48%',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  priorityBtnActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  priorityBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  priorityBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
