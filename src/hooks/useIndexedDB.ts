import { useState, useEffect, useCallback } from 'react';
import { workScheduleDB } from '../utils/indexedDB';
import { DEFAULT_SHIFT_COMBINATIONS } from '../constants';

export function useIndexedDB<T>(
  key: string,
  initialValue: T,
  storageType: 'setting' | 'metadata' | 'dateNotes' = 'setting'
) {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load value from IndexedDB
  const loadValue = useCallback(async () => {
    try {

      setIsLoading(true);
      setError(null);
      
      await workScheduleDB.init();
      
      let storedValue: T | null;
      
      if (storageType === 'dateNotes') {
        // Special handling for dateNotes
        storedValue = await workScheduleDB.getDateNotes() as unknown as T;
      } else {
        storedValue = storageType === 'setting' 
          ? await workScheduleDB.getSetting<T>(key)
          : await workScheduleDB.getMetadata<T>(key);
      }
      

      
      if (storedValue !== null) {
        // Special handling for workSettings to ensure shift combinations are present
        if (key === 'workSettings' && typeof storedValue === 'object' && storedValue !== null) {
          const settings = storedValue as any;
          
          // Only fix missing shift combinations if they're actually missing
          if (!settings.shiftCombinations || settings.shiftCombinations.length === 0) {

            const fixedSettings = {
              ...settings,
              shiftCombinations: DEFAULT_SHIFT_COMBINATIONS
            };
            
            // Save the fixed settings back to IndexedDB
            await workScheduleDB.setSetting(key, fixedSettings as T);
            setValue(fixedSettings as T);

          } else {
            setValue(storedValue);

          }
        } else {
          setValue(storedValue);

        }
      } else {
        // If no stored value, use the initial value and save it

        setValue(initialValue);
        
        if (storageType === 'dateNotes') {
          await workScheduleDB.setDateNotes(initialValue as unknown as Record<string, string>);
        } else if (storageType === 'setting') {
          await workScheduleDB.setSetting(key, initialValue);
        } else {
          await workScheduleDB.setMetadata(key, initialValue);
        }

      }
    } catch (err) {

      setError(err instanceof Error ? err.message : 'Unknown error');
      // On error, still set the initial value so the app doesn't break
      setValue(initialValue);
    } finally {
      setIsLoading(false);
    }
  }, [key, storageType, JSON.stringify(initialValue)]); // Include serialized initialValue

  // Load initial value from IndexedDB
  useEffect(() => {
    loadValue();
  }, [loadValue]);

  // Update value and save to IndexedDB
  const updateValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
    let valueToStore: T = value; // Initialize with current value as fallback
    
    try {
      setError(null);
      valueToStore = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(value) 
        : newValue;
      

      setValue(valueToStore);
      
      // Ensure database is initialized before saving
      await workScheduleDB.init();
      
      if (storageType === 'dateNotes') {
        await workScheduleDB.setDateNotes(valueToStore as unknown as Record<string, string>);
      } else if (storageType === 'setting') {
        await workScheduleDB.setSetting(key, valueToStore);
      } else {
        await workScheduleDB.setMetadata(key, valueToStore);
      }

      
      // Add a small delay to ensure data is persisted on iPhone
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {

      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // On iPhone, sometimes we need to retry
      if (err instanceof Error && err.message.includes('Transaction')) {

        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          if (storageType === 'dateNotes') {
            await workScheduleDB.setDateNotes(valueToStore as unknown as Record<string, string>);
          } else if (storageType === 'setting') {
            await workScheduleDB.setSetting(key, valueToStore);
          } else {
            await workScheduleDB.setMetadata(key, valueToStore);
          }

          setError(null);
        } catch (retryErr) {

        }
      }
    }
  }, [key, value, storageType]);

  return [value, updateValue, { isLoading, error, refresh: loadValue }] as const;
}

export function useScheduleData() {
  const [schedule, setScheduleState] = useState<Record<string, string[]>>({});
  const [specialDates, setSpecialDatesState] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    try {

      setIsLoading(true);
      setError(null);
      
      await workScheduleDB.init();
      
      const [scheduleData, specialDatesData] = await Promise.all([
        workScheduleDB.getSchedule(),
        workScheduleDB.getSpecialDates()
      ]);
      
      setScheduleState(scheduleData);
      setSpecialDatesState(specialDatesData);

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateSchedule = useCallback(async (newSchedule: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => {
    let scheduleToStore: Record<string, string[]>;
    
    try {
      setError(null);
      scheduleToStore = typeof newSchedule === 'function' 
        ? newSchedule(schedule) 
        : newSchedule;
      
      setScheduleState(scheduleToStore);
      
      // Ensure database is initialized
      await workScheduleDB.init();
      await workScheduleDB.setSchedule(scheduleToStore);

      
      // Add delay for iPhone persistence
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {

      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Retry logic for iPhone
      if (err instanceof Error && err.message.includes('Transaction')) {

        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryData = typeof newSchedule === 'function' 
            ? newSchedule(schedule) 
            : newSchedule;
          await workScheduleDB.setSchedule(retryData);

          setError(null);
        } catch (retryErr) {

        }
      }
    }
  }, [schedule]);

  const updateSpecialDates = useCallback(async (newSpecialDates: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => {
    let specialDatesToStore: Record<string, boolean>;
    
    try {
      setError(null);
      specialDatesToStore = typeof newSpecialDates === 'function' 
        ? newSpecialDates(specialDates) 
        : newSpecialDates;
      
      setSpecialDatesState(specialDatesToStore);
      
      // Ensure database is initialized
      await workScheduleDB.init();
      await workScheduleDB.setSpecialDates(specialDatesToStore);

      
      // Add delay for iPhone persistence
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (err) {

      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Retry logic for iPhone
      if (err instanceof Error && err.message.includes('Transaction')) {

        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryData = typeof newSpecialDates === 'function' 
            ? newSpecialDates(specialDates) 
            : newSpecialDates;
          await workScheduleDB.setSpecialDates(retryData);

          setError(null);
        } catch (retryErr) {

        }
      }
    }
  }, [specialDates]);

  return {
    schedule,
    specialDates,
    setSchedule: updateSchedule,
    setSpecialDates: updateSpecialDates,
    isLoading,
    error,
    refreshData: loadData // Export the refresh function
  };
}
