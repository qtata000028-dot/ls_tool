import { supabase } from './supabaseClient';
import { Announcement, Module, DashboardStats, Profile } from '../../types';

export const dataService = {
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
      // ULTIMATE OPTIMIZATION for Vercel Hobby Plan (10s timeout):
      // Resize to 600px width and 0.5 quality.
      // This creates a tiny file (~50-80KB) which uploads instantly and downloads instantly by Aliyun.
      // Qwen-VL handles low-res images very well for general object/text recognition.
      const compressedBlob = await this.compressImage(file, 600, 0.5);
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