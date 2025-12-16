import { supabase } from './supabaseClient';

export const APP_CONFIG_NAME = 'local_sql_server';

export function buildAsrWsUrl(apiUrl: string) {
  const base = (apiUrl || '').trim().replace(/\/+$/, '');
  return base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/ws/asr';
}

export interface ApiConfig {
  apiUrl: string;
  apiToken: string;
  asrWsUrl: string;
}

export async function fetchAppConfig(): Promise<ApiConfig> {
  const { data: configData, error } = await supabase
    .from('app_configs')
    .select('api_url, api_token')
    .eq('config_name', APP_CONFIG_NAME)
    .single();

  if (error || !configData?.api_url) throw new Error('配置缺失 (local_sql_server)');

  let rawApiUrl = String((configData as any).api_url || '').trim();
  if (!rawApiUrl) throw new Error('api_url 为空');
  const sanitized = rawApiUrl.replace(/\/+$/, '');
  const apiUrl = sanitized.endsWith('/api/sql/execute') ? sanitized : `${sanitized}/api/sql/execute`;
  const apiToken = String((configData as any).api_token || '');
  const asrWsUrl = buildAsrWsUrl(rawApiUrl);

  return { apiUrl, apiToken, asrWsUrl };
}
