import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { initDatabase } from './src/database/db';
import { settingsService } from './src/services/settingsService';
import { registerBackgroundSync } from './src/services/backgroundSync';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

type TabType = 'dashboard' | 'transactions' | 'categories' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        console.log('Initializing Expense Tracker Database...');
        // Timeout guard: never hang more than 2.5 seconds
        const initPromise = initDatabase();
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2500));
        await Promise.race([initPromise, timeoutPromise]);

        const settings = await settingsService.getSettings();
        if (settings.backgroundSyncEnabled) {
          registerBackgroundSync(settings.syncIntervalMinutes || 15).catch((err) =>
            console.warn('Background sync init warning:', err)
          );
        }

        setInitialized(true);
      } catch (e: any) {
        console.error('Initialization error:', e);
        // Even if error, still let user in so they are never blocked
        setInitialized(true);
      }
    }

    bootstrap();
  }, []);

  if (!initialized) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        {initError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorEmoji}>⚠️</Text>
            <Text style={styles.errorTitle}>Lỗi khởi động cơ sở dữ liệu</Text>
            <Text style={styles.errorMsg}>{initError}</Text>
          </View>
        ) : (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Đang khởi tạo SQLite Database...</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Top Header */}
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.appTitle}>MoMo & Bank Tracker</Text>
          <Text style={styles.appSubtitle}>Local SQLite • Telegram Real-time</Text>
        </View>
        <View style={styles.badgePrivacy}>
          <Text style={styles.badgePrivacyText}>🔒 100% Offline DB</Text>
        </View>
      </View>

      {/* Main Screen Content */}
      <View style={styles.content}>
        {activeTab === 'dashboard' && (
          <DashboardScreen onNavigateToTransactions={() => setActiveTab('transactions')} />
        )}
        {activeTab === 'transactions' && <TransactionsScreen />}
        {activeTab === 'categories' && <CategoriesScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Bottom Navigation Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={styles.tabIcon}>📊</Text>
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>
            Tổng quan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'transactions' && styles.tabItemActive]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text style={styles.tabIcon}>🧾</Text>
          <Text style={[styles.tabLabel, activeTab === 'transactions' && styles.tabLabelActive]}>
            Lịch sử
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'categories' && styles.tabItemActive]}
          onPress={() => setActiveTab('categories')}
        >
          <Text style={styles.tabIcon}>🏷️</Text>
          <Text style={[styles.tabLabel, activeTab === 'categories' && styles.tabLabelActive]}>
            Danh mục
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={styles.tabIcon}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>
            Cài đặt
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerBox: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorBox: {
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorMsg: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  appSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  badgePrivacy: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePrivacyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  content: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabItemActive: {},
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
});
