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
  private readonly version = 5;
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
        const oldVersion = event.oldVersion;

        // Create object stores with proper keyPath
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

        if (!db.objectStoreNames.contains('userSessions')) {
          db.createObjectStore('userSessions', { keyPath: 'userId' });
        }

        // Migration from v1 to v2+: Migrate old data structure to new structure
        if (oldVersion < 2) {
          console.log('🔄 Migrating database from v1 to v2+...');
          
          // Migrate old 'userSession' store to 'userSessions' store
          if (db.objectStoreNames.contains('userSession')) {
            try {
              const oldStore = db.transaction('userSession', 'readonly').objectStore('userSession');
              const getAllRequest = oldStore.getAll();
              getAllRequest.onsuccess = () => {
                const oldData = getAllRequest.result;
                const newStore = db.transaction('userSessions', 'readwrite').objectStore('userSessions');
                
                // Migrate each record
                oldData.forEach((item: any) => {
                  if (item.key === 'staff_session') {
                    // Migrate staff session
                    const session = item.value;
                    if (session) {
                      newStore.put({
                        userId: session.userId || session.id || 'default',
                        idNumber: session.idNumber || session.id || '',
                        surname: session.surname || '',
                        name: session.name || '',
                        isAdmin: session.isAdmin || false
                      });
                    }
                  } else if (item.key === 'last_used_id_number') {
                    // Migrate last used ID number
                    newStore.put({
                      userId: '_lastUsedIdNumber',
                      idNumber: item.value,
                      isAdmin: false
                    });
                  }
                });
              };
            } catch (error) {
              console.warn('⚠️ Could not migrate userSession store:', error);
            }
          }

          // Migrate old 'schedule' store data (single record) to new structure (individual records)
          if (db.objectStoreNames.contains('schedule')) {
            try {
              const oldStore = db.transaction('schedule', 'readonly').objectStore('schedule');
              const getRequest = oldStore.get('schedule_data');
              getRequest.onsuccess = () => {
                const scheduleData = getRequest.result?.value;
                if (scheduleData && typeof scheduleData === 'object') {
                  const newStore = db.transaction('schedule', 'readwrite').objectStore('schedule');
                  
                  // Clear old data
                  newStore.clear();
                  
                  // Add each date as a separate record
                  Object.entries(scheduleData).forEach(([date, shifts]) => {
                    if (Array.isArray(shifts) && shifts.length > 0) {
                      newStore.put({ date, shifts });
                    }
                  });
                  
                  console.log('✅ Migrated schedule data to new structure');
                }
              };
              
              // Also migrate special_dates if it exists in old store
              const getSpecialDatesRequest = oldStore.get('special_dates');
              getSpecialDatesRequest.onsuccess = () => {
                const specialDatesData = getSpecialDatesRequest.result?.value;
                if (specialDatesData && typeof specialDatesData === 'object') {
                  if (db.objectStoreNames.contains('specialDates')) {
                    const newStore = db.transaction('specialDates', 'readwrite').objectStore('specialDates');
                    
                    // Clear old data
                    newStore.clear();
                    
                    // Add each date as a separate record
                    Object.entries(specialDatesData).forEach(([date, isSpecial]) => {
                      if (isSpecial) {
                        newStore.put({ date, isSpecial });
                      }
                    });
                    
                    console.log('✅ Migrated special dates data to new structure');
                  }
                }
              };
            } catch (error) {
              console.warn('⚠️ Could not migrate schedule store:', error);
            }
          }
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
          resolve();
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
          resolve();
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
      
      // Add transaction error handling
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

  // User Session Management Functions
  async saveUserSession(session: { 
    userId: string; 
    idNumber: string; 
    surname?: string; 
    name?: string; 
    isAdmin: boolean 
  }): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSessions'], 'readwrite');
      const store = transaction.objectStore('userSessions');
      
      transaction.onerror = () => {
        console.error('❌ User session transaction error:', transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      const request = store.put(session);
      
      request.onsuccess = () => {
        // Success
      };
      
      request.onerror = () => {
        console.error('❌ Failed to save user session:', request.error);
        reject(new Error(`Failed to save user session: ${request.error}`));
      };
    });
  }

  async getUserSession(): Promise<{ 
    userId: string; 
    idNumber: string; 
    surname?: string; 
    name?: string; 
    isAdmin: boolean 
  } | null> {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve, reject) => {
        let transaction: IDBTransaction;
        try {
          transaction = db.transaction(['userSessions'], 'readonly');
        } catch (error: any) {
          // If transaction fails due to closing, reinitialize and retry once
          if (error?.message?.includes('closing') || error?.name === 'InvalidStateError') {
            console.warn('⚠️ Transaction failed, reinitializing DB...');
            this.db = null;
            this.ensureDB().then(newDb => {
              transaction = newDb.transaction(['userSessions'], 'readonly');
              const store = transaction.objectStore('userSessions');
              const request = store.getAll();
              request.onsuccess = () => {
                const sessions = request.result as Array<any>;
                const actualSessions = sessions.filter(s => s.userId !== '_lastUsedIdNumber');
                resolve(actualSessions.length > 0 ? actualSessions[0] : null);
              };
              request.onerror = () => resolve(null);
            }).catch(() => resolve(null));
            return;
          }
          reject(error);
          return;
        }
        
        const store = transaction.objectStore('userSessions');
        const request = store.getAll();
        
        request.onsuccess = () => {
          const sessions = request.result as Array<{
            userId: string;
            idNumber: string;
            surname?: string;
            name?: string;
            isAdmin: boolean;
          }>;
          
          // Filter out the special _lastUsedIdNumber entry
          const actualSessions = sessions.filter(s => s.userId !== '_lastUsedIdNumber');
          const session = actualSessions.length > 0 ? actualSessions[0] : null;
          resolve(session);
        };
        
        request.onerror = () => {
          console.error('Failed to get user session:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('getUserSession error:', error);
      return null;
    }
  }

  async removeUserSession(): Promise<void> {
    const db = await this.ensureDB();
    console.log('🗑️ Removing user session from IndexedDB');
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSessions'], 'readwrite');
      const store = transaction.objectStore('userSessions');
      
      transaction.onerror = () => {
        console.error('❌ Remove user session transaction error:', transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        console.log('✅ User session removed successfully (kept lastUsedIdNumber)');
        resolve();
      };
      
      // Get all sessions to find and preserve lastUsedIdNumber
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const sessions = getAllRequest.result || [];
        
        // Find and preserve _lastUsedIdNumber
        const lastUsedIdEntry = sessions.find(s => s.userId === '_lastUsedIdNumber');
        
        // Clear the store
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
          // Restore _lastUsedIdNumber if it existed
          if (lastUsedIdEntry) {
            store.put(lastUsedIdEntry);
            console.log('✅ Preserved lastUsedIdNumber:', lastUsedIdEntry.idNumber);
          }
        };
        
        clearRequest.onerror = () => {
          console.error('❌ Failed to clear store:', clearRequest.error);
          reject(new Error(`Failed to clear store: ${clearRequest.error}`));
        };
      };
      
      getAllRequest.onerror = () => {
        console.error('❌ Failed to get sessions:', getAllRequest.error);
        reject(new Error(`Failed to get sessions: ${getAllRequest.error}`));
      };
    });
  }

  async saveLastUsedIdNumber(idNumber: string): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSessions'], 'readwrite');
      const store = transaction.objectStore('userSessions');
      
      transaction.onerror = () => {
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      // Store as metadata in userSessions store with special key
      const request = store.put({ 
        userId: '_lastUsedIdNumber', 
        idNumber,
        isAdmin: false 
      });
      
      request.onsuccess = () => {
        // Success
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to save ID number: ${request.error}`));
      };
    });
  }

  async getLastUsedIdNumber(): Promise<string | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSessions'], 'readonly');
      const store = transaction.objectStore('userSessions');
      const request = store.get('_lastUsedIdNumber');
      
      request.onsuccess = () => {
        const result = request.result?.idNumber || null;
        resolve(result);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get last used ID number: ${request.error}`));
      };
    });
  }
}

export const workScheduleDB = new WorkScheduleDB();

// Convenience export functions for user session management
export const saveUserSession = async (session: { 
  userId: string; 
  idNumber: string; 
  surname?: string; 
  name?: string; 
  isAdmin: boolean 
}) => {
  await workScheduleDB.saveUserSession(session);
};

export const getUserSession = async () => {
  return await workScheduleDB.getUserSession();
};

export const removeUserSession = async () => {
  await workScheduleDB.removeUserSession();
};

export const saveLastUsedIdNumber = async (idNumber: string) => {
  await workScheduleDB.saveLastUsedIdNumber(idNumber);
};

export const getLastUsedIdNumber = async () => {
  return await workScheduleDB.getLastUsedIdNumber();
};