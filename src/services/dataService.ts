import { supabase } from './supabaseClient';
import { Announcement, Module, DashboardStats, Profile } from '../../types';

export const dataService = {
  // --- Data Dictionary (Schema) ---
  async getDataDictionary(tableName: string = 'p_employeetab'): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('system_data_dictionary')
      .select('column_name, description')
      .eq('table_name', tableName);

    if (error) {
      console.error('Error fetching data dictionary:', error);
      return {};
    }

    // Convert to simple Key-Value pair: { "P_emp_sex": "性别", ... }
    const schemaMap: Record<string, string> = {};
    data?.forEach((row: any) => {
      schemaMap[row.column_name] = row.description;
    });
    return schemaMap;
  },

  // ... (Existing methods below) ...

  async getActiveAnnouncements(): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching announcements:', error);
      return [];
    }
    return data || [];
  },

  async getModules(): Promise<Module[]> {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching modules:', error);
      return [];
    }
    return data || [];
  },

  async logActivity(userId: string, actionType: string, targetElement: string, metadata: any = null) {
    supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action_type: actionType,
        target_element: targetElement,
        metadata: metadata
      })
      .then(({ error }) => {
        if (error) console.error('Error logging activity:', error);
      });
  },

  async getDashboardStats(userId: string): Promise<DashboardStats> {
    const { count: aiCalls, error: aiError } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'ai_call');

    const { count: moduleClicks, error: moduleError } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'module_access');

    if (aiError || moduleError) {
      console.error('Error fetching stats', aiError, moduleError);
    }

    return {
      aiCalls: aiCalls || 0,
      moduleClicks: moduleClicks || 0
    };
  },

  async getUserProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.warn('Error fetching profile:', error);
      return null;
    }
    return data;
  },

  // Compress image before upload
  async compressImage(file: File, maxWidth: number = 300, quality: number = 0.8): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Scaling logic
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Image compression failed'));
            }, 'image/jpeg', quality);
          } else {
            reject(new Error('Canvas context failed'));
          }
        };
      };
      reader.onerror = (error) => reject(error);
    });
  },

  async uploadAvatar(userId: string, file: File): Promise<string | null> {
    try {
      // 1. Compress (Avatars can be small)
      const compressedBlob = await this.compressImage(file, 300, 0.8);
      const compressedFile = new File([compressedBlob], 'avatar.jpg', { type: 'image/jpeg' });

      // 2. Upload to Storage
      const fileName = `${userId}/avatar_${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // 4. Update Profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) throw updateError;

      return publicUrl;
    } catch (error) {
      console.error("Avatar upload failed:", error);
      return null;
    }
  },

  // NEW: Upload image for AI analysis
  async uploadAnalysisImage(file: File): Promise<string | null> {
    try {
      // OPTIMIZATION STRATEGY for High Precision Counting (e.g., Wood Planks):
      // 1. Width: 1280px. 600px is too blurry for counting small objects. 1280px is optimal for Qwen-VL.
      // 2. Quality: 0.7. Good enough for edge detection, but reduces file size significantly vs 0.9.
      // Result: ~200KB-400KB file. Fast enough to avoid Vercel timeouts, detailed enough for counting.
      const compressedBlob = await this.compressImage(file, 1280, 0.7);
      const compressedFile = new File([compressedBlob], 'analysis.jpg', { type: 'image/jpeg' });

      // Upload to 'ai-vision' bucket
      const fileName = `analysis_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('ai-vision')
        .upload(fileName, compressedFile);

      if (uploadError) {
         // If token is invalid, this might fail with 401 or 403
         if (uploadError.message.includes('jwt') || uploadError.message.includes('token')) {
            throw new Error("会话过期，请刷新页面重新登录");
         }
         throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('ai-vision')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Analysis image upload failed:", error);
      return null;
    }
  }
};