import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { syncEngine } from './syncEngine';
import { settingsService } from './settingsService';

export const BACKGROUND_SYNC_TASK_NAME = 'EXPENSE_TRACKER_BACKGROUND_SYNC_TASK';

/**
 * Define the background task executed by WorkManager (Android) / Background Fetch (iOS)
 */
if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
      try {
        const settings = await settingsService.getSettings();
        if (!settings.backgroundSyncEnabled) {
          return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        console.log('[BackgroundSync] Running scheduled background email sync...');
        const report = await syncEngine.runSync();

        if (report.newTransactionsCount > 0) {
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } else {
          return BackgroundFetch.BackgroundFetchResult.NoData;
        }
      } catch (error) {
        console.error('[BackgroundSync] Task failed with error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  } catch (e) {
    console.warn('[BackgroundSync] Failed to define background task:', e);
  }
}

/**
 * Register background periodic sync with the system
 */
export async function registerBackgroundSync(intervalMinutes: number = 15): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK_NAME);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK_NAME, {
      minimumInterval: intervalMinutes * 60, // in seconds
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log(`[BackgroundSync] Registered periodic sync every ${intervalMinutes} minutes`);
    return true;
  } catch (err) {
    console.warn('[BackgroundSync] Failed to register background task:', err);
    return false;
  }
}

/**
 * Unregister background periodic sync
 */
export async function unregisterBackgroundSync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK_NAME);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
      console.log('[BackgroundSync] Unregistered background sync task');
    }
    return true;
  } catch (err) {
    console.warn('[BackgroundSync] Failed to unregister task:', err);
    return false;
  }
}

/**
 * Check registration status
 */
export async function getBackgroundSyncStatus(): Promise<BackgroundFetch.BackgroundFetchStatus | null> {
  if (Platform.OS === 'web') return null;
  return await BackgroundFetch.getStatusAsync();
}
