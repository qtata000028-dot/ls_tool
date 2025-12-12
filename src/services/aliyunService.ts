import { supabase } from './supabaseClient';
import { dataService } from './dataService';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface VLMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<{ image?: string; text?: string }>;
}

interface AliyunConfig {
  apiKey: string;
  appId: string;
}

class AliyunService {
  /**
   * 从数据库获取配置
   * - 兼容 value 是 jsonb 对象 / string(JSON) 两种情况
   */
  private async getConfig(): Promise<AliyunConfig> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'aliyun_config')
      .single();

    if (error || !data || data.value == null) {
      console.error('Failed to fetch aliyun_config:', error);
      throw new Error('系统配置缺失：未找到阿里云 API 配置 (key: aliyun_config)。请联系管理员。');
    }

    let config: any = data.value;

    // 如果 value 存的是字符串 JSON（常见于 text）
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        throw new Error('系统配置无效：aliyun_config 不是有效的 JSON。');
      }
    }

    if (!config?.apiKey || !config?.appId) {
      throw new Error('系统配置无效：aliyun_config 缺少 apiKey 或 appId。');
    }

    return config as AliyunConfig;
  }

  /**
   * 仅用于前置检查：是否具备调用极速 ASR 的配置
   * 防止在无配置环境中盲目录音后才发现无法识别，影响体验
   */
  async isFastAsrAvailable(): Promise<boolean> {
    try {
      await this.getConfig();
      return true;
    } catch (err) {
      console.warn('Fast ASR unavailable:', err);
      return false;
    }
  }

  /**
   * 极速语音转写 (使用阿里云最新流式识别接口)
   * 备注：通过 Vite/Vercel 代理 /aliyun-api 转发，无需暴露真实域名
   */
  async fastSpeechToText(
    audioBlob: Blob,
    onPartial: (text: string) => void,
    onFinal: (text: string) => void
  ) {
    const config = await this.getConfig();

    // 官方建议使用 stream/v1/audio/recognition，模型取默认极速版本
    const url = `/aliyun-api/stream/v1/audio/recognition`;

    this.logUsage('qwen-asr-pro');

    // 根据 blob 类型推断格式（避免 webm 却写 wav）
    const mime = (audioBlob?.type || '').toLowerCase();
    const ext =
      mime.includes('wav') ? 'wav' :
      mime.includes('mp3') ? 'mp3' :
      mime.includes('m4a') ? 'm4a' :
      mime.includes('aac') ? 'aac' :
      mime.includes('ogg') ? 'ogg' :
      mime.includes('webm') ? 'webm' :
      'webm';

    const form = new FormData();
    form.append('file', audioBlob, `speech.${ext}`);

    // 你之前用 paraformer-2，这里保持不变
    form.append('model', 'paraformer-2');
    form.append('format', ext);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: form,
      });

      if (!response.ok) await this.handleError(response);
      if (!response.body) throw new Error('No response body');

      await this.processStream(response.body, (json) => {
        const text = json?.output?.text || json?.result || json?.payload?.result || '';
        const isFinal = json?.output?.completed === true || json?.is_final === true;

        if (text) {
          onPartial(text);
          if (isFinal) onFinal(text);
        }
      });
    } catch (error) {
      console.error('Aliyun ASR Error:', error);
      throw error;
    }
  }

  private async logUsage(model: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await dataService.logActivity(user.id, 'ai_call', model, { provider: 'aliyun' });
      }
    } catch (e) {
      console.warn('Log failed', e);
    }
  }

  /**
   * 调用阿里云百炼应用 API (流式 - 文本)
   * 使用 /aliyun-api 前缀，由 Vercel 或 Vite 代理转发
   */
  async chatStream(messages: ChatMessage[], onChunk: (text: string) => void) {
    const config = await this.getConfig();
    const url = `/aliyun-api/api/v1/apps/${config.appId}/completion`;

    const prompt = messages[messages.length - 1]?.content ?? '';

    this.logUsage('aliyun-rag-bailian');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'enable',
        },
        body: JSON.stringify({
          input: { prompt },
          parameters: { incremental_output: true },
          debug: {},
        }),
      });

      if (!response.ok) await this.handleError(response);
      if (!response.body) throw new Error('No response body');

      await this.processStream(response.body, (json) => {
        const content = json.output?.text || '';
        if (content) onChunk(content);
      });
    } catch (error) {
      console.error('Aliyun Service Error:', error);
      throw error;
    }
  }

  /**
   * 调用通义千问 Qwen-VL 视觉模型 (流式 - 多模态)
   * 使用 /aliyun-api 前缀，由 Vercel 或 Vite 代理转发
   */
  async chatVLStream(messages: VLMessage[], onChunk: (text: string) => void) {
    const config = await this.getConfig();
    const url = `/aliyun-api/api/v1/services/aigc/multimodal-generation/generation`;

    const MODEL_NAME = 'qwen-vl-max';
    this.logUsage(MODEL_NAME);

    console.log(`Calling Aliyun VL API (${MODEL_NAME}) via Vercel Proxy...`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'enable',
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          input: { messages },
          parameters: {
            incremental_output: true,
            result_format: 'message',
          },
        }),
      });

      if (!response.ok) await this.handleError(response);
      if (!response.body) throw new Error('No response body');

      await this.processStream(response.body, (json) => {
        const content = json.output?.choices?.[0]?.message?.content?.[0]?.text || '';
        if (content) onChunk(content);
      });
    } catch (error) {
      console.error('Aliyun VL Error Details:', error);
      throw error;
    }
  }

  // --- Helper Methods ---

  private asyn
