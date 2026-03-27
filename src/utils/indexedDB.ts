// Define constants here since they're not exported from useIndexedDB
const DB_NAME = 'WorkScheduleDB';

// Initialize IndexedDB database with version upgrade
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Open with version 5 to trigger upgrade and create missing stores
    const request = indexedDB.open(DB_NAME, 5);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store for user session if it doesn't exist
      if (!db.objectStoreNames.contains('userSession')) {
        const store = db.createObjectStore('userSession', { keyPath: 'key' });
        store.createIndex('value', 'value', { unique: false });
      }
      
      // Create object stores for settings and metadata
      if (!db.objectStoreNames.contains('settings')) {
        const store = db.createObjectStore('settings', { keyPath: 'key' });
        store.createIndex('value', 'value', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('metadata')) {
        const store = db.createObjectStore('metadata', { keyPath: 'key' });
        store.createIndex('value', 'value', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('schedule')) {
        const store = db.createObjectStore('schedule', { keyPath: 'key' });
        store.createIndex('value', 'value', { unique: false });
      }
    };
  });
};

// Get user session from IndexedDB
export const getUserSession = async (): Promise<any> => {
  try {
    const db = await initDB();
    
    // Check if userSession store exists
    if (!db.objectStoreNames.contains('userSession')) {
      console.warn('userSession object store not found in IndexedDB');
      return null;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSession'], 'readonly');
      const store = transaction.objectStore('userSession');
      const request = store.get('staff_session');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('Error accessing userSession store:', error);
    return null;
  }
};

// Save user session to IndexedDB
export const saveUserSession = async (session: any): Promise<void> => {
  try {
    const db = await initDB();
    
    // Check if userSession store exists
    if (!db.objectStoreNames.contains('userSession')) {
      console.warn('userSession object store not found in IndexedDB, cannot save session');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSession'], 'readwrite');
      const store = transaction.objectStore('userSession');
      const request = store.put({ key: 'staff_session', value: session });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('Error saving user session:', error);
  }
};

// Remove user session from IndexedDB
export const removeUserSession = async (): Promise<void> => {
  try {
    const db = await initDB();
    
    // Check if userSession store exists
    if (!db.objectStoreNames.contains('userSession')) {
      console.warn('userSession object store not found in IndexedDB');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSession'], 'readwrite');
      const store = transaction.objectStore('userSession');
      const request = store.delete('staff_session');

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('Error removing user session:', error);
  }
};

// Get last used ID number from IndexedDB
export const getLastUsedIdNumber = async (): Promise<string | null> => {
  try {
    const db = await initDB();
    
    // Check if userSession store exists
    if (!db.objectStoreNames.contains('userSession')) {
      console.warn('userSession object store not found in IndexedDB');
      return null;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSession'], 'readonly');
      const store = transaction.objectStore('userSession');
      const request = store.get('last_used_id_number');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('Error accessing userSession store:', error);
    return null;
  }
};

// Save last used ID number to IndexedDB
export const saveLastUsedIdNumber = async (idNumber: string): Promise<void> => {
  try {
    const db = await initDB();
    
    // Check if userSession store exists
    if (!db.objectStoreNames.contains('userSession')) {
      console.warn('userSession object store not found in IndexedDB, cannot save ID');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSession'], 'readwrite');
      const store = transaction.objectStore('userSession');
      const request = store.put({ key: 'last_used_id_number', value: idNumber });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('Error saving last used ID number:', error);
  }
};

// Remove last used ID number from IndexedDB
export const removeLastUsedIdNumber = async (): Promise<void> => {
  try {
    const db = await initDB();
    
    // Check if userSession store exists
    if (!db.objectStoreNames.contains('userSession')) {
      console.warn('userSession object store not found in IndexedDB');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSession'], 'readwrite');
      const store = transaction.objectStore('userSession');
      const request = store.delete('last_used_id_number');

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('Error removing last used ID number:', error);
  }
};

// Define the workScheduleDB object that provides the methods used by hooks
export const workScheduleDB = {
  init: initDB,
  
  // Settings-related methods
  getSetting: async <T>(key: string): Promise<T | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value as T : null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  setSetting: async <T>(key: string, value: T): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  // Metadata-related methods
  getMetadata: async <T>(key: string): Promise<T | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value as T : null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  setMetadata: async <T>(key: string, value: T): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');
      const request = store.put({ key, value });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  // Schedule-related methods
  getSchedule: async (): Promise<Record<string, string[]>> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['schedule'], 'readonly');
      const store = transaction.objectStore('schedule');
      const request = store.get('schedule_data');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value as Record<string, string[]> : {});
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  setSchedule: async (schedule: Record<string, string[]>): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['schedule'], 'readwrite');
      const store = transaction.objectStore('schedule');
      const request = store.put({ key: 'schedule_data', value: schedule });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  getSpecialDates: async (): Promise<Record<string, boolean>> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['schedule'], 'readonly');
      const store = transaction.objectStore('schedule');
      const request = store.get('special_dates');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value as Record<string, boolean> : {});
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  setSpecialDates: async (specialDates: Record<string, boolean>): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['schedule'], 'readwrite');
      const store = transaction.objectStore('schedule');
      const request = store.put({ key: 'special_dates', value: specialDates });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
};