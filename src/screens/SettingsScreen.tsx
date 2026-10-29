import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { AppSettings } from '../types/settings';
import { settingsService } from '../services/settingsService';
import { testTelegramBot } from '../services/telegramService';
import { syncEngine } from '../services/syncEngine';
import { registerBackgroundSync, unregisterBackgroundSync } from '../services/backgroundSync';
import { transactionRepo } from '../database/transactionRepo';
import { resetDatabase } from '../database/db';
import { promptGoogleLogin, fetchGoogleUserInfo, getGoogleRedirectUri } from '../services/googleAuth';

export const SettingsScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncingDemo, setSyncingDemo] = useState(false);
  const [showAdvancedGmail, setShowAdvancedGmail] = useState(false);
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);

  // Google OAuth Modal
  const [googleModalVisible, setGoogleModalVisible] = useState(false);
  const [signingInGoogle, setSigningInGoogle] = useState(false);

  // Form states
  const [gmailAccount, setGmailAccount] = useState<string | null>(null);
  const [gmailQuery, setGmailQuery] = useState('');
  const [gmailAccessToken, setGmailAccessToken] = useState('');
  const [gmailClientId, setGmailClientId] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramNotifyEnabled, setTelegramNotifyEnabled] = useState(true);
  const [backgroundSyncEnabled, setBackgroundSyncEnabled] = useState(true);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(15);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const s = await settingsService.getSettings();
      setSettings(s);
      setGmailQuery(s.gmailQuery || 'from:no-reply@momo.vn subject:Xác nhận giao dịch');
      setGmailAccessToken(s.gmailAccessToken || '');
      setGmailClientId(s.gmailClientId || '');

      if (s.gmailAccessToken) {
        // Fetch real Google user info if token is present
        const userInfo = await fetchGoogleUserInfo(s.gmailAccessToken);
        if (userInfo?.email) {
          setGmailAccount(userInfo.email);
        } else {
          setGmailAccount('tai-khoan-gmail@gmail.com');
        }
      } else {
        setGmailAccount(null);
      }

      setTelegramBotToken(s.telegramBotToken || '');
      setTelegramChatId(s.telegramChatId || '');
      setTelegramNotifyEnabled(s.telegramNotifyEnabled);
      setBackgroundSyncEnabled(s.backgroundSyncEnabled);
      setSyncIntervalMinutes(s.syncIntervalMinutes || 15);
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartGoogleOAuth = async () => {
    if (!gmailClientId.trim()) {
      setGoogleModalVisible(true);
      return;
    }

    try {
      setSigningInGoogle(true);
      const authRes = await promptGoogleLogin(gmailClientId.trim());

      if (authRes.success && authRes.accessToken) {
        setGmailAccessToken(authRes.accessToken);
        setGmailAccount(authRes.user?.email || 'gmail_user@gmail.com');
        await settingsService.saveSettings({
          gmailAccessToken: authRes.accessToken,
          gmailClientId: gmailClientId.trim(),
        });
        setGoogleModalVisible(false);
        Alert.alert(
          'Đăng nhập Google thành công! 🎉',
          `Đã kết nối tài khoản Gmail: ${authRes.user?.email || 'Google User'}`
        );
      } else if (authRes.error === 'NEED_CLIENT_ID') {
        setGoogleModalVisible(true);
      } else {
        Alert.alert('Đăng nhập Google', authRes.error || 'Không thể hoàn tất đăng nhập Google');
      }
    } catch (err: any) {
      Alert.alert('Lỗi đăng nhập Google', err.message || 'Lỗi hệ thống');
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleManualTokenSubmit = async (manualToken: string, emailHint?: string) => {
    const token = manualToken.trim();
    if (!token) {
      Alert.alert('Lỗi', 'Vui lòng nhập Access Token');
      return;
    }

    if (token.includes('.apps.googleusercontent.com')) {
      Alert.alert(
        'Nhầm mã rồi bạn ơi! ⚠️',
        'Mã bạn vừa dán là "Google Client ID", không phải "Access Token".\n\n• Client ID (dạng ...apps.googleusercontent.com) dùng cho Cách 1.\n• Access Token (bắt đầu bằng ya29...) lấy từ OAuth Playground dùng cho Cách 2.'
      );
      return;
    }

    if (token === 'demo_access_token') {
      setGmailAccessToken('demo_access_token');
      const accountName = emailHint || 'sinhvien.k18@gmail.com';
      setGmailAccount(accountName);
      await settingsService.saveSettings({ gmailAccessToken: 'demo_access_token' });
      setGoogleModalVisible(false);
      Alert.alert('Chế độ Demo kích hoạt 🎉', `Đã nạp tài khoản mẫu: ${accountName}`);
      return;
    }

    // Verify token with real Google API
    const userInfo = await fetchGoogleUserInfo(token);
    if (!userInfo?.email) {
      Alert.alert(
        'Access Token không hợp lệ ❌',
        'Google từ chối token này (Lỗi 401 Unauthorized hoặc đã hết hạn).\n\nVui lòng làm theo hướng dẫn Cách 2 trên trang OAuth Playground để lấy token bắt đầu bằng "ya29...".'
      );
      return;
    }

    setGmailAccessToken(token);
    setGmailAccount(userInfo.email);
    await settingsService.saveSettings({
      gmailAccessToken: token,
    });

    setGoogleModalVisible(false);
    Alert.alert('Thành công! 🎉', `Đã kết nối tài khoản Gmail: ${userInfo.email}`);
  };

  const handleGoogleSignOut = async () => {
    setGmailAccount(null);
    setGmailAccessToken('');
    await settingsService.saveSettings({ gmailAccessToken: '' });
    Alert.alert('Đã đăng xuất', 'Đã hủy liên kết tài khoản Gmail');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await settingsService.saveSettings({
        gmailQuery: gmailQuery.trim(),
        gmailAccessToken: gmailAccessToken.trim(),
        gmailClientId: gmailClientId.trim(),
        telegramBotToken: telegramBotToken.trim(),
        telegramChatId: telegramChatId.trim(),
        telegramNotifyEnabled,
        backgroundSyncEnabled,
        syncIntervalMinutes,
      });
      setSettings(updated);

      if (backgroundSyncEnabled) {
        await registerBackgroundSync(syncIntervalMinutes);
      } else {
        await unregisterBackgroundSync();
      }

      Alert.alert('Thành công', 'Đã lưu cấu hình ứng dụng');
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramBotToken || !telegramChatId) {
      Alert.alert(
        'Thiếu thông tin kết nối Bot',
        'Vui lòng nhập đầy đủ cả "Telegram Bot Token" và "Telegram Chat ID" trước khi bấm kiểm tra.'
      );
      return;
    }

    try {
      setTestingTelegram(true);
      const res = await testTelegramBot(telegramBotToken, telegramChatId);
      if (res.success) {
        setTelegramStatus('success');
        Alert.alert(
          'Kết nối thành công! 🎉',
          'Đã gửi tin nhắn test tới Telegram của bạn. Hãy mở ứng dụng Telegram để kiểm tra!'
        );
      } else {
        setTelegramStatus('error');
        Alert.alert(
          'Kết nối thất bại ❌',
          `${res.error}\n\nVui lòng kiểm tra lại:\n1. Bot Token có đúng định dạng 123456:ABC... không?\n2. Chat ID có đúng ID tài khoản từ @userinfobot không?\n3. Bạn đã bấm "Start" chat với bot đó chưa?`
        );
      }
    } catch (err: any) {
      setTelegramStatus('error');
      Alert.alert('Lỗi', err.message || 'Lỗi khi gửi tin nhắn tới Telegram');
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleSyncSampleData = async () => {
    try {
      setSyncingDemo(true);
      const report = await syncEngine.runSync(true); // force sample emails
      Alert.alert('Nạp dữ liệu thực tế mẫu', report.message);
      await loadSettings();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể quét dữ liệu mẫu');
    } finally {
      setSyncingDemo(false);
    }
  };

  const handleClearTransactions = () => {
    Alert.alert(
      'Xóa toàn bộ giao dịch',
      'Bạn có chắc chắn muốn xóa toàn bộ lịch sử giao dịch trong SQLite? Danh mục sẽ được giữ nguyên.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận xóa',
          style: 'destructive',
          onPress: async () => {
            await transactionRepo.clearAll();
            Alert.alert('Thành công', 'Đã xóa toàn bộ lịch sử giao dịch.');
          },
        },
      ]
    );
  };

  const handleResetDefaults = () => {
    Alert.alert(
      'Khôi phục mặc định',
      'Thao tác này sẽ đặt lại toàn bộ database và cấu hình về ban đầu.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Khôi phục',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase();
            await settingsService.resetSettings();
            await loadSettings();
            Alert.alert('Thành công', 'Đã đặt lại database và danh mục mặc định.');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* 1. Telegram Bot & MacroDroid Integration */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>1. Tự động hóa qua Telegram & MacroDroid</Text>
          <Text style={styles.iconTag}>🤖</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Bắt trọn thông báo biến động số dư từ MoMo và tất cả ngân hàng (Vietcombank, MB, Techcombank, TPBank...) khi thanh toán hoặc nhận tiền.
        </Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Bật thông báo Telegram:</Text>
          <Switch
            value={telegramNotifyEnabled}
            onValueChange={setTelegramNotifyEnabled}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={telegramNotifyEnabled ? '#2563EB' : '#F1F5F9'}
          />
        </View>

        {/* Input 1: Telegram Bot Token */}
        <Text style={styles.label}>
          🔑 Telegram Bot Token <Text style={styles.labelSub}>(Mã do @BotFather cấp):</Text>
        </Text>
        <TextInput
          style={[styles.input, styles.tokenInput]}
          value={telegramBotToken}
          onChangeText={(val) => {
            setTelegramBotToken(val);
            setTelegramStatus('idle');
          }}
          placeholder="Ví dụ: 7123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
          placeholderTextColor="#94A3B8"
          secureTextEntry
        />

        {/* Input 2: Telegram Chat ID */}
        <Text style={styles.label}>
          🆔 Telegram Chat ID / User ID <Text style={styles.labelSub}>(ID của bạn từ @userinfobot):</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={telegramChatId}
          onChangeText={(val) => {
            setTelegramChatId(val);
            setTelegramStatus('idle');
          }}
          placeholder="Ví dụ: 987654321"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
        />

        {/* Test Button & Status */}
        <TouchableOpacity
          style={[styles.testBtn, testingTelegram && styles.btnDisabled]}
          onPress={handleTestTelegram}
          disabled={testingTelegram}
        >
          {testingTelegram ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Text style={styles.testBtnText}>✈️ Kiểm tra kết nối Bot (Gửi tin nhắn test)</Text>
          )}
        </TouchableOpacity>

        {telegramStatus === 'success' && (
          <View style={styles.statusSuccessBanner}>
            <Text style={styles.statusSuccessText}>
              🟢 Bot Telegram đang hoạt động - Sẵn sàng gửi và nhận dữ liệu giao dịch!
            </Text>
          </View>
        )}

        {/* Helper guide toggle */}
        <TouchableOpacity
          style={styles.guideToggle}
          onPress={() => setShowTelegramGuide(!showTelegramGuide)}
        >
          <Text style={styles.guideToggleText}>
            {showTelegramGuide ? '▲ Đóng hướng dẫn MacroDroid' : '⚡ Xem cách cài MacroDroid tự động bắt MoMo (1 phút)'}
          </Text>
        </TouchableOpacity>

        {showTelegramGuide && (
          <View style={styles.guideBox}>
            <Text style={{ fontWeight: '700', color: '#1E293B', marginBottom: 6 }}>
              📱 Cách thiết lập MacroDroid trên điện thoại Android:
            </Text>
            <Text style={styles.guideStep}>
              <Text style={styles.stepNum}>Bước 1:</Text> Cài app <Text style={styles.boldText}>MacroDroid</Text> miễn phí từ CH Play.
            </Text>
            <Text style={styles.guideStep}>
              <Text style={styles.stepNum}>Bước 2:</Text> Tạo Macro mới:
              {'\n'}• <Text style={styles.boldText}>Trigger (Kích hoạt):</Text> Chọn <Text style={styles.codeText}>Thông báo ➔ Nhận thông báo</Text> ➔ Chọn ứng dụng <Text style={styles.boldText}>MoMo</Text> (hoặc app ngân hàng).
              {'\n'}• <Text style={styles.boldText}>Action (Hành động):</Text> Chọn <Text style={styles.codeText}>Ứng dụng ➔ Mở trang web / HTTP Request</Text>:
            </Text>
            <View style={{ backgroundColor: '#F1F5F9', padding: 8, borderRadius: 6, marginVertical: 4 }}>
              <Text style={{ fontSize: 11, fontFamily: 'monospace', color: '#0369A1' }} selectable>
                {`https://api.telegram.org/bot${telegramBotToken.trim() || '<BOT_TOKEN>'}/sendMessage?chat_id=${telegramChatId.trim() || '<CHAT_ID>'}&text={notif_text}`}
              </Text>
            </View>
            <Text style={styles.guideStep}>
              <Text style={styles.stepNum}>Bước 3:</Text> Bấm Lưu Macro. Xong! Cứ mỗi khi MoMo nổ thông báo (tiền ra hoặc tiền vào), bot Telegram sẽ tự động ghi nhận ngay!
            </Text>
          </View>
        )}
      </View>

      {/* 2. Optional Gmail Section (Collapsible) */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>2. Tùy chọn: Quét qua Gmail API</Text>
          <Text style={styles.iconTag}>📧</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Nếu bạn có email ngân hàng hoặc biên lai MoMo gửi về Gmail, bạn có thể kết nối thêm Gmail (không bắt buộc).
        </Text>

        <TouchableOpacity
          style={styles.toggleAdvancedBtn}
          onPress={() => setShowAdvancedGmail(!showAdvancedGmail)}
        >
          <Text style={styles.toggleAdvancedText}>
            {showAdvancedGmail ? '▲ Thu gọn Gmail' : '▼ Mở cài đặt Gmail (Tùy chọn)'}
          </Text>
        </TouchableOpacity>

        {showAdvancedGmail && (
          <View style={styles.advancedBox}>
            {gmailAccount ? (
              <View style={styles.accountConnectedBox}>
                <View style={styles.accountInfoRow}>
                  <Text style={styles.accountAvatar}>👤</Text>
                  <View>
                    <Text style={styles.accountName}>{gmailAccount}</Text>
                    <Text style={styles.accountStatus}>🟢 Đã kết nối Gmail</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleGoogleSignOut}>
                  <Text style={styles.logoutBtnText}>Hủy</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.googleSignInBtn}
                onPress={() => setGoogleModalVisible(true)}
              >
                <Text style={styles.googleIcon}>🔴</Text>
                <Text style={styles.googleSignInText}>Cấu hình kết nối Gmail</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* 3. Background Sync Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>3. Tự động chạy ngầm định kỳ</Text>
          <Text style={styles.iconTag}>⏱️</Text>
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Bật tác vụ ngầm (15 phút/lần):</Text>
          <Switch
            value={backgroundSyncEnabled}
            onValueChange={setBackgroundSyncEnabled}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={backgroundSyncEnabled ? '#2563EB' : '#F1F5F9'}
          />
        </View>
        <Text style={styles.hint}>
          Chạy ngầm qua WorkManager (Android) & Background Fetch (iOS), tự ngắt khi không có mạng để tiết kiệm pin.
        </Text>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.primarySaveBtn, saving && styles.btnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primarySaveBtnText}>💾 Lưu tất cả cài đặt</Text>
        )}
      </TouchableOpacity>

      {/* 4. Thử nghiệm thực tế hàng ngày */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Nạp giao dịch mẫu thực tế</Text>
        <Text style={styles.sectionDesc}>
          Nạp các giao dịch quen thuộc hàng ngày: Giữ xe 5k, Bách Hóa Xanh 42k, Xăng 50k, Cơm trưa 35k, Tiền trọ 2.5tr để kiểm tra phân loại và báo cáo Telegram.
        </Text>

        <TouchableOpacity
          style={styles.demoBtn}
          onPress={handleSyncSampleData}
          disabled={syncingDemo}
        >
          {syncingDemo ? (
            <ActivityIndicator size="small" color="#047857" />
          ) : (
            <Text style={styles.demoBtnText}>⚡ Nạp 6 giao dịch mẫu & Bắn Telegram ngay</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.dangerBtn} onPress={handleClearTransactions}>
          <Text style={styles.dangerBtnText}>🗑️ Xóa sạch lịch sử giao dịch</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetBtn} onPress={handleResetDefaults}>
          <Text style={styles.resetBtnText}>🔄 Khôi phục danh mục gốc</Text>
        </TouchableOpacity>
      </View>

      {/* Google OAuth Help / Setup Modal */}
      <Modal visible={googleModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Liên kết Google & Gmail API</Text>
            <TouchableOpacity onPress={() => setGoogleModalVisible(false)}>
              <Text style={styles.modalCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.modalSubtitle}>
              Để ứng dụng có quyền đọc email giao dịch từ MoMo (`gmail.readonly`), bạn có thể chọn 1 trong các cách sau:
            </Text>

            {/* Option A: Google Cloud Client ID */}
            <View style={styles.optionBox}>
              <Text style={styles.optionTitle}>Cách 1: Nhập Google Client ID để đăng nhập OAuth</Text>
              <Text style={styles.optionDesc}>
                Lấy từ Google Cloud Console (APIs & Services ➔ Credentials ➔ OAuth Client ID).
              </Text>
              <TextInput
                style={styles.input}
                value={gmailClientId}
                onChangeText={setGmailClientId}
                placeholder="Ví dụ: 123456789-xyz.apps.googleusercontent.com"
                placeholderTextColor="#94A3B8"
              />
              <View style={{ marginTop: 8, padding: 8, backgroundColor: '#F1F5F9', borderRadius: 8 }}>
                <Text style={{ fontSize: 11, color: '#475569', fontWeight: '600' }}>
                  📌 Redirect URI (dán vào Authorized redirect URIs):
                </Text>
                <Text style={{ fontSize: 11, color: '#0284C7', fontFamily: 'monospace', marginTop: 2 }} selectable>
                  {getGoogleRedirectUri()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.oauthActionBtn}
                onPress={() => {
                  if (!gmailClientId.trim()) {
                    Alert.alert('Chưa có Client ID', 'Vui lòng dán Client ID hoặc dùng Cách 2 bên dưới.');
                    return;
                  }
                  handleStartGoogleOAuth();
                }}
              >
                <Text style={styles.oauthActionBtnText}>Tiến hành đăng nhập Google</Text>
              </TouchableOpacity>
            </View>

            {/* Option B: Direct Access Token */}
            <View style={styles.optionBox}>
              <Text style={styles.optionTitle}>Cách 2: Dán Access Token trực tiếp</Text>
              <Text style={styles.optionDesc}>
                Lấy Access Token nhanh từ Google OAuth Playground (`https://developers.google.com/oauthplayground`) với scope `https://www.googleapis.com/auth/gmail.readonly`.
              </Text>
              <TextInput
                style={[styles.input, styles.tokenInput]}
                value={gmailAccessToken}
                onChangeText={setGmailAccessToken}
                placeholder="ya29.a0AfH6SM..."
                placeholderTextColor="#94A3B8"
                secureTextEntry
              />
              <TouchableOpacity
                style={styles.oauthActionBtnSecondary}
                onPress={() => handleManualTokenSubmit(gmailAccessToken)}
              >
                <Text style={styles.oauthActionBtnTextSecondary}>Lưu Access Token</Text>
              </TouchableOpacity>
            </View>

            {/* Option C: Demo Mode */}
            <View style={styles.optionBox}>
              <Text style={styles.optionTitle}>Cách 3: Chế độ trải nghiệm thử nghiệm (Demo)</Text>
              <Text style={styles.optionDesc}>
                Không cần tài khoản Google Cloud, dùng ngay email giả lập để kiểm tra toàn bộ luồng bóc tách MoMo và bắn Telegram.
              </Text>
              <TouchableOpacity
                style={styles.demoActionBtn}
                onPress={() => handleManualTokenSubmit('demo_access_token', 'sinhvien.k18@gmail.com')}
              >
                <Text style={styles.demoActionBtnText}>Bật tài khoản Demo (sinhvien.k18@gmail.com)</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  iconTag: {
    fontSize: 18,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 17,
  },
  googleSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  googleIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  googleSignInText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  accountConnectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
  },
  accountInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountAvatar: {
    fontSize: 24,
    marginRight: 10,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  accountStatus: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleAdvancedBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 4,
  },
  toggleAdvancedText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  advancedBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  labelSub: {
    fontWeight: '400',
    color: '#64748B',
    fontSize: 11,
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
  tokenInput: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  hint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 15,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  testBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  testBtnText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  statusSuccessBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  statusSuccessText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  guideToggle: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 4,
  },
  guideToggleText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '600',
  },
  guideBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  guideStep: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 8,
  },
  stepNum: {
    fontWeight: '700',
    color: '#2563EB',
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  codeText: {
    fontFamily: 'monospace',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  primarySaveBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  primarySaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  demoBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  demoBtnText: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 13,
  },
  dangerBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  dangerBtnText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 13,
  },
  resetBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#64748B',
    fontWeight: '500',
    fontSize: 13,
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
  modalCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  modalBody: {
    padding: 16,
    paddingBottom: 40,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 16,
  },
  optionBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 10,
  },
  oauthActionBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  oauthActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  oauthActionBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  oauthActionBtnTextSecondary: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  demoActionBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  demoActionBtnText: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 13,
  },
});
