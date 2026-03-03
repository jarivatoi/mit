import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RosterEntry } from '../types/roster';

export const useRosterData = () => {
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');
  const isMountedRef = useRef(true);

  // Track mounted status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadEntries = useCallback(async () => {
    if (!supabase) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('🔄 Loading roster entries...');
      
      const { data, error: fetchError } = await supabase
        .from('roster_entries')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (isMountedRef.current) {
        setEntries(data || []);
        console.log('✅ Loaded roster entries:', data?.length || 0);
      }
    } catch (err) {
      console.error('❌ Error loading roster entries:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load roster entries');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      const { error: deleteError } = await supabase
        .from('roster_entries')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Update local state
      if (isMountedRef.current) {
        setEntries(prev => prev.filter(entry => entry.id !== id));
      }
    } catch (err) {
      console.error('❌ Error removing entry:', err);
      throw err;
    }
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    if (!supabase) {
      console.log('⚠️ Supabase not available for real-time updates');
      return;
    }

    console.log('📡 Setting up real-time subscription...');
    setRealtimeStatus('connecting');

    const channel = supabase
      .channel('roster_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'roster_entries'
        },
        (payload) => {
          try {
            console.log('📡 Real-time update received:', payload);
            
            if (!isMountedRef.current) {
              console.log('⚠️ Component unmounted, ignoring real-time update');
              return;
            }

            // Handle different types of changes
            if (payload.eventType === 'INSERT' && payload.new) {
              setEntries(prev => {
                const exists = prev.some(entry => entry.id === payload.new.id);
                if (!exists) {
                  return [payload.new as RosterEntry, ...prev];
                }
                return prev;
              });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              setEntries(prev => 
                prev.map(entry => 
                  entry.id === payload.new.id ? payload.new as RosterEntry : entry
                )
              );
            } else if (payload.eventType === 'DELETE' && payload.old) {
              setEntries(prev => 
                prev.filter(entry => entry.id !== payload.old.id)
              );
            }

            // Dispatch custom event for other components
            window.dispatchEvent(new CustomEvent('rosterRealtimeUpdate', {
              detail: payload
            }));

          } catch (error) {
            console.error('❌ Error handling real-time update:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
        
        if (isMountedRef.current) {
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('connected');
            console.log('✅ Real-time connection established');
          } else if (status === 'CHANNEL_ERROR') {
            setRealtimeStatus('error');
            console.log('❌ Real-time connection error');
          } else if (status === 'TIMED_OUT') {
            setRealtimeStatus('error');
            console.log('⏰ Real-time connection timed out');
          } else if (status === 'CLOSED') {
            setRealtimeStatus('disconnected');
            console.log('🔌 Real-time connection closed');
          }
        }
      });

    // Initial load
    loadEntries();

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up real-time subscription...');
      supabase.removeChannel(channel);
    };
  }, [loadEntries]);

  return {
    entries,
    loading,
    error,
    realtimeStatus,
    loadEntries,
    removeEntry
  };
};