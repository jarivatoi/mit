import { supabase } from '../lib/supabase';
import { RosterEntry, RosterFormData } from '../types/roster';

export const fetchRosterEntries = async (): Promise<RosterEntry[]> => {
  if (!supabase) {
    console.error('⚠️ Supabase not available - check your configuration');
    throw new Error('Supabase not configured. Please set up your Supabase credentials in the .env file.');
  }

  try {
    console.log('🔄 Fetching roster entries from Supabase...');
    const { data, error } = await supabase
      .from('roster_entries')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching roster entries:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('✅ Successfully fetched roster entries:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ Network error fetching roster entries:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error: Unable to connect to database. Please check your internet connection and Supabase configuration.');
  }
};

export const addRosterEntry = async (formData: RosterFormData, editorName: string): Promise<RosterEntry> => {
  if (!supabase) {
    throw new Error('Database not available. Please check your connection.');
  }

  try {
    console.log('💾 Adding roster entry to Supabase:', formData);
    
    const now = new Date();
    const timestamp = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    const entryData = {
      date: formData.date,
      shift_type: formData.shiftType,
      assigned_name: formData.assignedName,
      last_edited_by: editorName,
      last_edited_at: timestamp,
      change_description: formData.changeDescription || null
    };

    const { data, error } = await supabase
      .from('roster_entries')
      .insert([entryData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding roster entry:', error);
      throw new Error(`Failed to add roster entry: ${error.message}`);
    }

    console.log('✅ Successfully added roster entry:', data);
    
    // Dispatch event for calendar synchronization with detailed logging
    const syncEvent = {
      date: formData.date,
      shiftType: formData.shiftType,
      assignedName: formData.assignedName,
      editorName: editorName,
      action: 'added'
    };
    window.dispatchEvent(new CustomEvent('rosterCalendarSync', {
      detail: syncEvent
    }));
    
    return data;
  } catch (error) {
    console.error('❌ Network error adding roster entry:', error);
    // Re-throw with more specific error message
    if (error instanceof Error) {
      throw new Error(`Import failed: ${error.message}`);
    }
    throw new Error('Import failed: Network or database error');
  }
};

export const updateRosterEntry = async (id: string, formData: RosterFormData, editorName: string): Promise<RosterEntry> => {
  if (!supabase) {
    throw new Error('Supabase not available. Please configure your Supabase credentials in .env file or src/lib/supabase.ts');
  }

  try {
    console.log('🔄 Updating roster entry in Supabase:', { id, formData });
    
    // First, get the current entry to check for existing change descriptions
    const { data: currentEntry, error: fetchError } = await supabase
      .from('roster_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching current entry:', fetchError);
      throw new Error(`Failed to fetch current entry: ${fetchError.message}`);
    }

    // CRITICAL: Check if this is a name change that should trigger removal from calendar
    const isNameChange = currentEntry.assigned_name !== formData.assignedName;
    const oldAssignedName = currentEntry.assigned_name;
    
    console.log('🔍 UPDATE: Name change detection:', {
      oldName: oldAssignedName,
      newName: formData.assignedName,
      isNameChange,
      editorName
    });
    const now = new Date();
    const timestamp = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    // Handle change description with original PDF tracking
    let newChangeDescription = formData.changeDescription;
    
    // If this is the first edit from a PDF import, preserve the original assignment
    if (currentEntry.change_description === 'Imported from PDF') {
      newChangeDescription = `${formData.changeDescription} (Original PDF: ${currentEntry.assigned_name})`;
    } else if (currentEntry.change_description && currentEntry.change_description.includes('(Original PDF:')) {
      // For subsequent edits, preserve the existing original PDF info
      const existingOriginal = currentEntry.change_description.match(/\(Original PDF: ([^)]+)\)/);
      if (existingOriginal) {
        newChangeDescription = `${formData.changeDescription} (Original PDF: ${existingOriginal[1]})`;
      }
    }
    
    const updateData = {
      date: formData.date,
      shift_type: formData.shiftType,
      assigned_name: formData.assignedName,
      last_edited_by: editorName,
      last_edited_at: timestamp,
      change_description: newChangeDescription || null,
      text_color: formData.textColor || null
    };

    const { data, error } = await supabase
      .from('roster_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating roster entry:', error);
      throw new Error(`Failed to update roster entry: ${error.message}`);
    }

    console.log('✅ Successfully updated roster entry:', data);
    
    // CRITICAL: If this is a name change, dispatch REMOVAL event for the old name first
    if (isNameChange) {
      console.log('🗑️ UPDATE: Dispatching removal event for old name:', oldAssignedName);
      const removalEvent = {
        date: formData.date,
        shiftType: formData.shiftType,
        assignedName: oldAssignedName, // Use the OLD name for removal
        editorName: editorName,
        action: 'removed'
      };
      window.dispatchEvent(new CustomEvent('rosterCalendarSync', {
        detail: removalEvent
      }));
      console.log('✅ UPDATE: Removal event dispatched for:', oldAssignedName);
      
      // Small delay to ensure removal is processed first
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Dispatch event for calendar synchronization with detailed logging
    const syncEvent = {
      date: formData.date,
      shiftType: formData.shiftType,
      assignedName: formData.assignedName,
      editorName: editorName,
      action: 'updated'
    };
    window.dispatchEvent(new CustomEvent('rosterCalendarSync', {
      detail: syncEvent
    }));
    console.log('✅ UPDATE: Addition event dispatched for:', formData.assignedName);
    
    return data;
  } catch (error) {
    console.error('❌ Network error updating roster entry:', error);
    throw error;
  }
};

export const deleteRosterEntry = async (id: string): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase not available. Please configure your Supabase credentials in .env file or src/lib/supabase.ts');
  }

  try {
    console.log('🗑️ Deleting roster entry from Supabase:', id);
    
    // Get the entry details before deletion for sync
    const { data: entryToDelete, error: fetchError } = await supabase
      .from('roster_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching entry before deletion:', fetchError);
      throw new Error(`Failed to fetch entry before deletion: ${fetchError.message}`);
    }

    const { error } = await supabase
      .from('roster_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting roster entry:', error);
      throw new Error(`Failed to delete roster entry: ${error.message}`);
    }

    console.log('✅ Successfully deleted roster entry:', id);
    
    // Dispatch event for calendar synchronization with removal action
    if (entryToDelete) {
      console.log('🔄 Dispatching rosterCalendarSync event for removal:', {
        date: entryToDelete.date,
        shiftType: entryToDelete.shift_type,
        assignedName: entryToDelete.assigned_name,
        editorName: entryToDelete.last_edited_by || 'Unknown',
        action: 'removed'
      });
      
      const syncEvent = {
        date: entryToDelete.date,
        shiftType: entryToDelete.shift_type,
        assignedName: entryToDelete.assigned_name,
        editorName: entryToDelete.last_edited_by || 'Unknown',
        action: 'removed'
      };
      window.dispatchEvent(new CustomEvent('rosterCalendarSync', {
        detail: syncEvent
      }));
      
      console.log('✅ rosterCalendarSync event dispatched for removal');
    }
  } catch (error) {
    console.error('❌ Network error deleting roster entry:', error);
    throw error;
  }
};

export const clearAllRosterEntries = async (): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase not available. Please configure your Supabase credentials in .env file or src/lib/supabase.ts');
  }

  try {
    console.log('🗑️ Clearing ALL roster entries from Supabase...');
    
    // First, get count of entries to be deleted
    const { count, error: countError } = await supabase
      .from('roster_entries')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting entry count:', countError);
    } else {
      console.log(`📊 Found ${count} entries to delete`);
    }
    
    const { error } = await supabase
      .from('roster_entries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows (using a condition that matches all)

    if (error) {
      console.error('❌ Error clearing all roster entries:', error);
      throw new Error(`Failed to clear all roster entries: ${error.message}`);
    }

    console.log(`✅ Successfully cleared all ${count || 'unknown number of'} roster entries`);
  } catch (error) {
    console.error('❌ Network error clearing all roster entries:', error);
    throw error;
  }
};

export const clearMonthRosterEntries = async (year: number, month: number): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase not available. Please configure your Supabase credentials in .env file or src/lib/supabase.ts');
  }

  try {
    // Create date range for the specific month (correctly calculate last day)
    const startDate = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
    // Calculate the last day of the month correctly
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${(month + 1).toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    console.log(`🗑️ Clearing roster entries for ${month + 1}/${year} from Supabase...`);
    console.log(`📅 Date range: ${startDate} to ${endDate}`);
    
    // First, get count of entries to be deleted
    const { count, error: countError } = await supabase
      .from('roster_entries')
      .select('*', { count: 'exact', head: true })
      .gte('date', startDate)
      .lte('date', endDate);
    
    if (countError) {
      console.error('❌ Error getting month entry count:', countError);
    } else {
      console.log(`📊 Found ${count} entries to delete for ${month + 1}/${year}`);
    }
    
    const { error } = await supabase
      .from('roster_entries')
      .delete()
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      console.error('❌ Error clearing month roster entries:', error);
      throw new Error(`Failed to clear month roster entries: ${error.message}`);
    }

    console.log(`✅ Successfully cleared ${count || 'unknown number of'} roster entries for ${month + 1}/${year}`);
  } catch (error) {
    console.error('❌ Network error clearing month roster entries:', error);
    throw error;
  }
};

export const updateAllStaffRemarksForDate = async (date: string, info: string, editorName: string): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase not available. Please configure your Supabase credentials in .env file or src/lib/supabase.ts');
  }

  try {
    console.log(`📝 Updating all staff remarks for ${date} with info: "${info}"`);
    
    const now = new Date();
    const timestamp = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    // Get all entries for this date
    const { data: dateEntries, error: fetchError } = await supabase
      .from('roster_entries')
      .select('*')
      .eq('date', date);

    if (fetchError) {
      console.error('❌ Error fetching entries for date:', fetchError);
      throw new Error(`Failed to fetch entries for date: ${fetchError.message}`);
    }

    if (!dateEntries || dateEntries.length === 0) {
      console.log(`ℹ️ No entries found for date ${date}`);
      return;
    }

    console.log(`📝 Found ${dateEntries.length} entries to update for ${date}`);

    // Update each entry's change_description to include special date info
    for (const entry of dateEntries) {
      let newChangeDescription = entry.change_description || '';
      
      // Remove any existing special date info
      newChangeDescription = newChangeDescription.replace(/Special Date: [^;]*;?\s*/g, '');
      
      // Add new special date info if provided
      if (info.trim()) {
        const specialInfo = `Special Date: ${info.trim()}`;
        newChangeDescription = newChangeDescription ? 
          `${specialInfo}; ${newChangeDescription}` : 
          specialInfo;
      }
      
      const { error: updateError } = await supabase
        .from('roster_entries')
        .update({
          change_description: newChangeDescription || null,
          last_edited_by: editorName,
          last_edited_at: timestamp
        })
        .eq('id', entry.id);

      if (updateError) {
        console.error(`❌ Error updating entry ${entry.id}:`, updateError);
        throw new Error(`Failed to update entry: ${updateError.message}`);
      }
    }

    console.log(`✅ Successfully updated ${dateEntries.length} entries for ${date}`);
  } catch (error) {
    console.error('❌ Network error updating staff remarks:', error);
    throw error;
  }
};