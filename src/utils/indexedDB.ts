import { DEFAULT_SHIFT_COMBINATIONS } from '../constants';

interface DBSchema {
  schedule: {
    key: string;
    value: {
      date: string;
      shifts: string[];
    };
  };
  specialDates: {
    key: string;
    value: {
      date: string;
      isSpecial: boolean;
    };
  };
  settings: {
    key: string;
    value: any;
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: any;
    };
  };
  monthlySalaries: {
    key: string;
    value: {
      monthKey: string;
      salary: number;
    };
  };
  dateNotes: {
    key: string;
    value: {
      date: string;
      note: string;
    };
  };
  userSessions: {
    key: string;
    value: {
      userId: string;
      idNumber: string;
      surname?: string;
      name?: string;
      isAdmin: boolean;
    };
  };
}

class WorkScheduleDB {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'WorkScheduleDB';
  private readonly version = 6; // Incremented to apply new schema
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise;
    }
    
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if IndexedDB is available (important for iPhone)
      if (!window.indexedDB) {
        console.error('❌ IndexedDB not supported');
        reject(new Error('IndexedDB not supported'));
        return;
      }
      
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('❌ Failed to open IndexedDB:', request.error);
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('🔧 Database upgrade needed, version:', event.oldVersion, '->', event.newVersion);

        // Create object stores
        if (!db.objectStoreNames.contains('schedule')) {
          db.createObjectStore('schedule', { keyPath: 'date' });
        }

        if (!db.objectStoreNames.contains('specialDates')) {
          db.createObjectStore('specialDates', { keyPath: 'date' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('monthlySalaries')) {
          db.createObjectStore('monthlySalaries', { keyPath: 'monthKey' });
        }

        if (!db.objectStoreNames.contains('dateNotes')) {
          db.createObjectStore('dateNotes', { keyPath: 'date' });
        }

        if (!db.objectStoreNames.contains('userSessions')) {
          db.createObjectStore('userSessions', { keyPath: 'userId' });
        }
      };
      
      // Add timeout for iPhone compatibility
      setTimeout(() => {
        if (!this.db) {
          console.error('❌ IndexedDB initialization timeout');
          reject(new Error('Database initialization timeout'));
        }
      }, 10000); // 10 second timeout
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      // Database is not initialized, need to reopen
      console.warn('⚠️ Database not available, reopening...');
      this.db = null;
      this.initPromise = null;
      await this.init();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async getSchedule(): Promise<Record<string, string[]>> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['schedule'], 'readonly');
      const store = transaction.objectStore('schedule');
      const request = store.getAll();

      request.onsuccess = () => {
        const result: Record<string, string[]> = {};
        request.result.forEach((item: { date: string; shifts: string[] }) => {
          result[item.date] = item.shifts;
        });
        resolve(result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get schedule'));
      };
    });
  }

  async setSchedule(schedule: Record<string, string[]>): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['schedule'], 'readwrite');
      const store = transaction.objectStore('schedule');

      // Add transaction error handling
      transaction.onerror = () => {
        console.error('❌ Transaction error:', transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };

      // Clear existing data
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        // Add new data
        let pendingOperations = 0;
        let completedOperations = 0;
        let hasError = false;
        
        Object.entries(schedule).forEach(([date, shifts]) => {
          if (shifts.length > 0) {
            pendingOperations++;
            const addRequest = store.add({ date, shifts });
            
            addRequest.onsuccess = () => {
              completedOperations++;
              if (completedOperations === pendingOperations && !hasError) {
                // All operations completed
              }
            };
            
            addRequest.onerror = () => {
              if (!hasError) {
                hasError = true;
                console.error(`❌ Failed to add schedule for ${date}:`, addRequest.error);
                reject(new Error(`Failed to add schedule for ${date}: ${addRequest.error}`));
              }
            };
          }
        });
        
        // If no data to save, resolve immediately
        if (pendingOperations === 0) {
          console.log('✅ No schedule data to save');
        }
      };

      clearRequest.onerror = () => {
        console.error('❌ Failed to clear schedule:', clearRequest.error);
        reject(new Error(`Failed to clear schedule: ${clearRequest.error}`));
      };
    });
  }

  async getSpecialDates(): Promise<Record<string, boolean>> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['specialDates'], 'readonly');
      const store = transaction.objectStore('specialDates');
      const request = store.getAll();

      request.onsuccess = () => {
        const result: Record<string, boolean> = {};
        request.result.forEach((item: { date: string; isSpecial: boolean }) => {
          result[item.date] = item.isSpecial;
        });
        resolve(result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get special dates'));
      };
    });
  }

  async setSpecialDates(specialDates: Record<string, boolean>): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['specialDates'], 'readwrite');
      const store = transaction.objectStore('specialDates');

      // Add transaction error handling
      transaction.onerror = () => {
        console.error('❌ Special dates transaction error:', transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };

      // Clear existing data
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        // Add new data
        let pendingOperations = 0;
        let completedOperations = 0;
        let hasError = false;
        
        Object.entries(specialDates).forEach(([date, isSpecial]) => {
          if (isSpecial) {
            pendingOperations++;
            const addRequest = store.add({ date, isSpecial });
            
            addRequest.onsuccess = () => {
              completedOperations++;
              if (completedOperations === pendingOperations && !hasError) {
                // All operations completed
              }
            };
            
            addRequest.onerror = () => {
              if (!hasError) {
                hasError = true;
                console.error(`❌ Failed to add special date for ${date}:`, addRequest.error);
                reject(new Error(`Failed to add special date for ${date}: ${addRequest.error}`));
              }
            };
          }
        });

        // If no data to save, resolve immediately
        if (pendingOperations === 0) {
          // No special dates to save
        }
      };

      clearRequest.onerror = () => {
        console.error('❌ Failed to clear special dates:', clearRequest.error);
        reject(new Error(`Failed to clear special dates: ${clearRequest.error}`));
      };
    });
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result ? request.result.value : null;
        
        // Special handling for workSettings to ensure shift combinations are present
        if (key === 'workSettings' && result && typeof result === 'object') {
          if (!result.shiftCombinations || result.shiftCombinations.length === 0) {
            const fixedResult = {
              ...result,
              shiftCombinations: DEFAULT_SHIFT_COMBINATIONS
            };
            
            // Save the fixed version back to the database
            this.setSetting(key, fixedResult).catch(err => 
              console.error('Failed to save fixed settings:', err)
            );
            
            resolve(fixedResult);
            return;
          }
        }
        
        resolve(result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get setting: ${key}`));
      };
    });
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      // Add transaction error handling
      transaction.onerror = () => {
        console.error(`❌ Settings transaction error for "${key}":`, transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      const request = store.put({ key, value });

      request.onsuccess = () => {
        // Success
      };

      request.onerror = () => {
        console.error(`❌ Failed to set setting "${key}":`, request.error);
        reject(new Error(`Failed to set setting: ${key} - ${request.error}`));
      };
    });
  }

  async getMetadata<T>(key: string): Promise<T | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result ? request.result.value : null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get metadata: ${key}`));
      };
    });
  }

  async setMetadata<T>(key: string, value: T): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');
      
      transaction.onerror = () => {
        console.error(`❌ Metadata transaction error for "${key}":`, transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      const request = store.put({ key, value });

      request.onsuccess = () => {
        // Success
      };

      request.onerror = () => {
        console.error(`❌ Failed to set metadata "${key}":`, request.error);
        reject(new Error(`Failed to set metadata: ${key} - ${request.error}`));
      };
    });
  }

  async getDateNotes(): Promise<Record<string, string>> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['dateNotes'], 'readonly');
      const store = transaction.objectStore('dateNotes');
      const request = store.getAll();

      request.onsuccess = () => {
        const result: Record<string, string> = {};
        request.result.forEach((item: { date: string; note: string }) => {
          result[item.date] = item.note;
        });
        resolve(result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get date notes'));
      };
    });
  }

  async setDateNotes(dateNotes: Record<string, string>): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['dateNotes'], 'readwrite');
      const store = transaction.objectStore('dateNotes');

      transaction.onerror = () => {
        console.error('❌ Date notes transaction error:', transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };

      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        let pendingOperations = 0;
        let completedOperations = 0;
        let hasError = false;
        
        Object.entries(dateNotes).forEach(([date, note]) => {
          if (note) {
            pendingOperations++;
            const addRequest = store.add({ date, note });
            
            addRequest.onsuccess = () => {
              completedOperations++;
              if (completedOperations === pendingOperations && !hasError) {
                // All operations completed
              }
            };
            
            addRequest.onerror = () => {
              if (!hasError) {
                hasError = true;
                console.error(`❌ Failed to add date note for ${date}:`, addRequest.error);
                reject(new Error(`Failed to add date note for ${date}: ${addRequest.error}`));
              }
            };
          }
        });

        if (pendingOperations === 0) {
          // No date notes to save
        }
      };

      clearRequest.onerror = () => {
        console.error('❌ Failed to clear date notes:', clearRequest.error);
        reject(new Error(`Failed to clear date notes: ${clearRequest.error}`));
      };
    });
  }
}

export const workScheduleDB = new WorkScheduleDB();

// Legacy functions for backward compatibility
export const initDB = (): Promise<IDBDatabase> => {
  return workScheduleDB.init().then(() => (workScheduleDB as any).db);
};
