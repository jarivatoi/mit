import { supabase } from '../lib/supabase';

export interface StaffMember {
  id: string;
  code: string;
  name: string;
  title: string;
  salary: number;
  employee_id: string;
  first_name: string;
  surname: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_updated_by: string;
}

export const fetchStaffMembers = async (): Promise<StaffMember[]> => {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .order('surname', { ascending: true });

    if (error) {
      return [];
    }

    return data || [];
  } catch (error) {
    return [];
  }
};

export const addStaffMember = async (staffData: Omit<StaffMember, 'id' | 'created_at' | 'updated_at'>, editorName: string): Promise<StaffMember> => {
  if (!supabase) {
    throw new Error('Database not available.');
  }

  try {
    const entryData = {
      ...staffData,
      last_updated_by: editorName
    };

    const { data, error } = await supabase
      .from('staff_members')
      .upsert([entryData], { onConflict: 'code' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add staff member: ${error.message}`);
    }

    // If this is a base name (not containing (R)), also create the corresponding (R) variant
    if (data && !data.name.includes('(R)')) {
      const rVariantName = `${data.name}(R)`;
      const rVariantCode = `${data.code}R`;
      
      // Create the (R) variant with modified code
      const rVariantData = {
        code: rVariantCode,
        name: rVariantName,
        title: data.title,
        salary: data.salary,
        employee_id: data.employee_id,
        first_name: data.first_name,
        surname: data.surname,
        is_active: true,
        last_updated_by: editorName
      };
      
      const { data: rVariantResult, error: rVariantError } = await supabase
        .from('staff_members')
        .upsert([rVariantData], { onConflict: 'code' })
        .select()
        .single();

      if (rVariantError) {
        // Don't throw error here as we still want to return the main staff member
      }
    }
    
    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent('staffRealtimeUpdate', {
      detail: { action: 'added', staff: data }
    }));
    
    return data;
  } catch (error) {
    throw error;
  }
};

export const updateStaffMember = async (id: string, staffData: Partial<StaffMember>, editorName: string): Promise<StaffMember> => {
  if (!supabase) {
    throw new Error('Database not available.');
  }

  try {
    const updateData = {
      ...staffData,
      last_updated_by: editorName,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('staff_members')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update staff member: ${error.message}`);
    }

    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent('staffRealtimeUpdate', {
      detail: data
    }));
    
    return data;
  } catch (error) {
    throw error;
  }
};

export const deleteStaffMember = async (id: string, editorName: string): Promise<void> => {
  if (!supabase) {
    throw new Error('Database not available.');
  }

  try {
    // First, get the staff member to be deleted
    const { data: staffToDelete, error: fetchError } = await supabase
      .from('staff_members')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch staff member: ${fetchError.message}`);
    }

    // Permanently delete the main staff member
    const { data, error } = await supabase
      .from('staff_members')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete staff member: ${error.message}`);
    }

    // If this is a base name (not containing (R)), also delete the corresponding (R) variant
    if (staffToDelete && !staffToDelete.name.includes('(R)')) {
      const rVariantName = `${staffToDelete.name}(R)`;
      
      // Check if the (R) variant exists using maybeSingle() which returns null if no record found
      const { data: existingRVariant, error: checkError } = await supabase
        .from('staff_members')
        .select('*')
        .eq('name', rVariantName)
        .maybeSingle();
      
      if (!checkError && existingRVariant) {
        // Permanently delete the (R) variant
        await supabase
          .from('staff_members')
          .delete()
          .eq('name', rVariantName)
          .select()
          .single();
      }
    }
    
    // If this is an (R) variant, also delete the corresponding base name
    else if (staffToDelete && staffToDelete.name.includes('(R)')) {
      const baseName = staffToDelete.name.replace('(R)', '');
      
      // Check if the base name exists using maybeSingle() which returns null if no record found
      const { data: existingBase, error: checkError } = await supabase
        .from('staff_members')
        .select('*')
        .eq('name', baseName)
        .maybeSingle();
      
      if (!checkError && existingBase) {
        // Permanently delete the base name
        await supabase
          .from('staff_members')
          .delete()
          .eq('name', baseName)
          .select()
          .single();
      }
    }
    
    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent('staffRealtimeUpdate', {
      detail: { action: 'deleted', id, deletedStaff: data }
    }));
    
  } catch (error) {
    throw error;
  }
};

