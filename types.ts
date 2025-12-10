export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  key: string;
  value: any;
  description: string | null;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  user_id: string | null;
  action_type: string;
  target_element: string | null;
  metadata: any | null;
  created_at: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string | null;
  priority: string;
  is_active: boolean;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email?: string;
  profile?: Profile;
}

export interface Module {
  id: string;
  key: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  icon: string | null;
  path: string | null;
  status: string;
  created_at?: string;
}

export interface DashboardStats {
  aiCalls: number;
  moduleClicks: number;
}