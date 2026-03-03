import { useMemo } from 'react';
import { DaySchedule, Settings, SpecialDates } from '../types';

export const useScheduleCalculations = (
  schedule: DaySchedule,
  settings: Settings,
  specialDates: SpecialDates,
  currentDate?: Date,
  refreshKey?: number, // Add refresh key parameter
  monthlySalary?: number // Add monthly salary parameter
) => {
  const { totalAmount, monthToDateAmount } = useMemo(() => {
    // Determine effective salary: use monthlySalary if set (> 0),
    // otherwise use global basicSalary ONLY for current year (NOT past or future)
    const today = new Date();
    const viewingYear = currentDate ? currentDate.getFullYear() : today.getFullYear();
    const actualCurrentYear = today.getFullYear();
    const isFutureYear = viewingYear > actualCurrentYear;
    const isPastYear = viewingYear < actualCurrentYear;

    // Only apply global salary to current year's unedited months
    // Past years must have explicit monthly salaries or remain at 0
    // Future years always remain at 0 unless explicitly set
    const shouldUseGlobalSalary = (monthlySalary === undefined || monthlySalary === null || monthlySalary === 0)
                                  && !isFutureYear
                                  && !isPastYear;
    const effectiveSalary = monthlySalary && monthlySalary > 0
      ? monthlySalary
      : (shouldUseGlobalSalary ? settings?.basicSalary || 0 : 0);

    // Recalculate hourly rate based on effective salary
    // IMPORTANT: For future years, hourly rate must also be 0 unless a monthly salary is explicitly set
    const effectiveHourlyRate = effectiveSalary > 0 ? (effectiveSalary * 12) / 52 / 40 : 0;

    console.log('🔄 Calculating amounts with data:', {
      viewingYear,
      actualCurrentYear,
      isFutureYear,
      isPastYear,
      monthlySalary,
      shouldUseGlobalSalary,
      scheduleKeys: Object.keys(schedule || {}),
      scheduleCount: Object.keys(schedule || {}).length,
      settingsBasicSalary: settings?.basicSalary,
      effectiveSalary: effectiveSalary,
      effectiveHourlyRate: effectiveHourlyRate,
      settingsHourlyRate: settings?.hourlyRate,
      settingsCombinations: settings?.shiftCombinations?.length,
      specialDatesCount: Object.keys(specialDates || {}).length,
      refreshKey
    });

    let total = 0;
    let monthToDate = 0;
    const now = new Date();

    // Get current month and year for filtering
    const currentMonth = currentDate ? currentDate.getMonth() : now.getMonth();
    const currentYear = currentDate ? currentDate.getFullYear() : now.getFullYear();
    
    // Early return if no schedule data or settings
    if (!schedule || Object.keys(schedule).length === 0) {
      console.log('❌ No schedule data available');
      return { totalAmount: 0, monthToDateAmount: 0 };
    }
    
    if (!settings || !settings.shiftCombinations || settings.shiftCombinations.length === 0) {
      console.log('❌ No settings or shift combinations available');
      return { totalAmount: 0, monthToDateAmount: 0 };
    }

    console.log('✅ Processing schedule entries...');
    
    Object.entries(schedule).forEach(([dateKey, dayShifts]) => {
      if (!dayShifts || dayShifts.length === 0) return;
      
      console.log(`📅 Processing date ${dateKey} with shifts:`, dayShifts);
      
      // Parse the date to check if it belongs to the current month/year
      const workDate = new Date(dateKey);
      const workMonth = workDate.getMonth();
      const workYear = workDate.getFullYear();
      
      // Only include dates from the currently viewed month/year
      if (workMonth !== currentMonth || workYear !== currentYear) {
        console.log(`⏭️ Skipping ${dateKey} - not in current month/year`);
        return;
      }
      
      // Check if this date is marked as special
      const isSpecialDate = specialDates && specialDates[dateKey] === true;
      const dayOfWeek = workDate.getDay();
      
      console.log(`📊 Date ${dateKey}: dayOfWeek=${dayOfWeek}, isSpecial=${isSpecialDate}`);
      
      // Calculate each shift individually for proper amount calculation
      dayShifts.forEach(shiftId => {
        console.log(`💰 Calculating shift: ${shiftId}`);
        
        // Find the shift combination - handle single shifts and combinations
        let combination = settings.shiftCombinations.find(combo => {
          const comboKey = combo.id.replace(/AM/g, '9-4'); // Handle AM alias
          return comboKey === shiftId;
        });
        
        if (combination && effectiveHourlyRate) {
          const shiftAmount = combination.hours * effectiveHourlyRate;
          total += shiftAmount;
          
          console.log(`💰 Found single shift ${combination.combination} (${combination.hours}h) = Rs ${shiftAmount.toFixed(2)}`);
          
          // Check if this date should be included in month-to-date calculation
          // Modified logic: Include today's shifts based on shift end time
          if (workMonth === now.getMonth() && workYear === now.getFullYear()) {
            const workDay = workDate.getDate();
            const today = now.getDate();
            
            // If it's a previous day, always include - EXCEPT for night shifts which have special handling
            if (workDay < today) {
              // Special handling ONLY for night shifts on previous days
              let includePreviousDayShift = true;
              if (shiftId === 'N') {
                // For night shifts on previous days, we still need to check the cutoff time
                // Night shift starts on workDate and ends at 9 AM the next day
                const workDateObj = new Date(workDate);
                const cutoffDate = new Date(workDateObj);
                cutoffDate.setDate(cutoffDate.getDate() + 1); // Next day
                cutoffDate.setHours(9, 0, 0, 0); // 9:00 AM
                
                // Include if current time is past the cutoff
                includePreviousDayShift = now >= cutoffDate;
              }
              
              if (includePreviousDayShift) {
                monthToDate += shiftAmount;
                console.log(`📈 Added to month-to-date (previous day): Rs ${shiftAmount.toFixed(2)}`);
              }
            } 
            // If it's today, include based on shift end time
            else if (workDay === today) {
              // Get current time components
              const currentHour = now.getHours();
              const currentMinute = now.getMinutes();
              
              // Determine shift end time based on shift type
              let shiftEndTimeHour = 0;
              switch(shiftId) {
                case '9-4':
                  shiftEndTimeHour = 16; // 4 PM
                  break;
                case '4-10':
                  shiftEndTimeHour = 22; // 10 PM
                  break;
                case '12-10':
                  shiftEndTimeHour = 22; // 10 PM
                  break;
                case 'N':
                  shiftEndTimeHour = 9; // 9 AM (next day)
                  break;
                default:
                  shiftEndTimeHour = 16; // Default to 4 PM
              }
              
              // Special handling for night shift (ends next day)
              let includeShift = false;
              if (shiftId === 'N') {
                // Night shift starts on workDate and ends at 9 AM the next day
                // So we should include it in month-to-date only after 9 AM the next day
                const workDateObj = new Date(workDate);
                const cutoffDate = new Date(workDateObj);
                cutoffDate.setDate(cutoffDate.getDate() + 1); // Next day
                cutoffDate.setHours(9, 0, 0, 0); // 9:00 AM
                
                // Include if current time is past the cutoff
                includeShift = now >= cutoffDate;
              } else {
                // Other shifts end on the same day
                includeShift = (currentHour > shiftEndTimeHour) || 
                              (currentHour === shiftEndTimeHour && currentMinute >= 0);
              }
              
              if (includeShift) {
                monthToDate += shiftAmount;
                console.log(`📈 Added to month-to-date (today, shift ended): Rs ${shiftAmount.toFixed(2)}`);
              } else {
                console.log(`⏭️ Not adding to month-to-date (today, shift not ended yet): ${shiftId}`);
              }
            }
          }
        } else {
          console.log(`❌ No single shift combination found for ${shiftId}`);
        }
      });
      
      // Also check for multi-shift combinations (for backward compatibility)
      if (dayShifts.length > 1) {
        const sortedShifts = [...dayShifts].sort();
        const combinationKey = sortedShifts.join('+');
        
        console.log(`🔍 Looking for multi-shift combination: ${combinationKey}`);
        
        const multiCombination = settings.shiftCombinations.find(combo => {
          const comboKey = combo.id.replace(/AM/g, '9-4');
          return comboKey === combinationKey;
        });
        
        if (multiCombination && effectiveHourlyRate) {
          // Subtract individual shift amounts already added
          const individualTotal = dayShifts.reduce((sum, shiftId) => {
            const singleCombo = settings.shiftCombinations.find(combo => combo.id === shiftId);
            return sum + (singleCombo ? singleCombo.hours * effectiveHourlyRate : 0);
          }, 0);
          
          const multiAmount = multiCombination.hours * effectiveHourlyRate;
          const difference = multiAmount - individualTotal;
          
          total += difference;
          
          console.log(`💰 Found multi-combination ${multiCombination.combination}, adjusting by Rs ${difference.toFixed(2)}`);
          
          // Apply same logic for month-to-date calculation with multi-shifts
          if (workMonth === now.getMonth() && workYear === now.getFullYear()) {
            const workDay = workDate.getDate();
            const today = now.getDate();
            
            // If it's a previous day, always include - EXCEPT for night shifts which have special handling
            if (workDay < today) {
              // Special handling ONLY for multi-shifts containing night shifts on previous days
              let includePreviousDayMultiShift = true;
              if (dayShifts.includes('N')) {
                // For night shifts on previous days, we still need to check the cutoff time
                // Night shift starts on workDate and ends at 9 AM the next day
                const workDateObj = new Date(workDate);
                const cutoffDate = new Date(workDateObj);
                cutoffDate.setDate(cutoffDate.getDate() + 1); // Next day
                cutoffDate.setHours(9, 0, 0, 0); // 9:00 AM
                
                // Include if current time is past the cutoff
                includePreviousDayMultiShift = now >= cutoffDate;
              }
              
              if (includePreviousDayMultiShift) {
                monthToDate += difference;
              }
            } 
            // If it's today, include based on shift end time (improved logic)
            else if (workDay === today) {
              // For multi-shift combinations:
              // Each shift in the combination should be evaluated independently
              // The combination is included only when ALL shifts in it can be included
              let includeMultiShift = true;
              
              // Check each shift in the combination
              for (const shiftId of dayShifts) {
                if (shiftId === 'N') {
                  // Night shift condition - must be after 9 AM the following day
                  const workDateObj = new Date(workDate);
                  const cutoffDate = new Date(workDateObj);
                  cutoffDate.setDate(cutoffDate.getDate() + 1); // Next day
                  cutoffDate.setHours(9, 0, 0, 0); // 9:00 AM
                  
                  if (now < cutoffDate) {
                    includeMultiShift = false;
                    break;
                  }
                } else {
                  // Regular shift condition - must be after its end time
                  let shiftEndTimeHour = 0;
                  switch(shiftId) {
                    case '9-4':
                      shiftEndTimeHour = 16; // 4 PM
                      break;
                    case '4-10':
                      shiftEndTimeHour = 22; // 10 PM
                      break;
                    case '12-10':
                      shiftEndTimeHour = 22; // 10 PM
                      break;
                    default:
                      shiftEndTimeHour = 16; // Default to 4 PM
                  }
                  
                  const currentHour = now.getHours();
                  const currentMinute = now.getMinutes();
                  
                  if (!((currentHour > shiftEndTimeHour) || 
                        (currentHour === shiftEndTimeHour && currentMinute >= 0))) {
                    includeMultiShift = false;
                    break;
                  }
                }
              }
              
              if (includeMultiShift) {
                monthToDate += difference;
                console.log(`📈 Added multi-shift to month-to-date: Rs ${difference.toFixed(2)}`);
              }
            }
          }
        }
      }
    });
    
    console.log(`🎯 Final totals: Monthly=${total.toFixed(2)}, MTD=${monthToDate.toFixed(2)}`);
    
    return { totalAmount: total, monthToDateAmount: monthToDate };
  }, [
    schedule,
    settings,
    specialDates,
    currentDate,
    refreshKey,
    monthlySalary,
    // Add these to ensure recalculation when data structure changes
    JSON.stringify(schedule),
    JSON.stringify(settings),
    JSON.stringify(specialDates)
  ]);

  return { totalAmount, monthToDateAmount };
}; 