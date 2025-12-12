
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
   */
  private async getConfig(): Promise<AliyunConfig> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'aliyun_config')
      .single();

    if (error || !data || !data.value) {
      console.error("Failed to fetch aliyun_config:", error);
      throw new Error("系统配置缺失：未找到阿里云 API 配置 (key: aliyun_config)。请联系管理员。");
    }

    const config = data.value;
    if (!config.apiKey || !config.appId) {
      throw new Error("系统配置无效：aliyun_config 缺少 apiKey 或 appId。");
    }

    return config as AliyunConfig;
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

    const form = new FormData();
    form.append('file', audioBlob, 'speech.webm');
    form.append('model', 'paraformer-2');
    form.append('format', 'wav');

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
      console.warn("Log failed", e);
    }
  }

  /**
   * 调用阿里云百炼应用 API (流式 - 文本)
   * 使用 /aliyun-api 前缀，由 Vercel 或 Vite 代理转发
   */
  async chatStream(messages: ChatMessage[], onChunk: (text: string) => void) {
    const config = await this.getConfig();
    // 原始地址: https://dashscope.aliyuncs.com/api/v1/apps/...
    // 代理地址: /aliyun-api/api/v1/apps/...
    const url = `/aliyun-api/api/v1/apps/${config.appId}/completion`;
    
    const prompt = messages[messages.length - 1].content;

    this.logUsage('aliyun-rag-bailian');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'enable',
        },
        body: JSON.stringify({
          input: { prompt: prompt },
          parameters: { incremental_output: true },
          debug: {}
        }),
      });

      if (!response.ok) await this.handleError(response);
      if (!response.body) throw new Error("No response body");

      await this.processStream(response.body, (json) => {
         // App Completion output format
         const content = json.output?.text || "";
         if (content) onChunk(content);
      });

    } catch (error) {
      console.error("Aliyun Service Error:", error);
      throw error;
    }
  }

  /**
   * 调用通义千问 Qwen-VL 视觉模型 (流式 - 多模态)
   * 使用 /aliyun-api 前缀，由 Vercel 或 Vite 代理转发
   */
  async chatVLStream(messages: VLMessage[], onChunk: (text: string) => void) {
    const config = await this.getConfig();
    
    // 原始地址: https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
    // 代理地址: /aliyun-api/api/v1/services/aigc/multimodal-generation/generation
    const url = `/aliyun-api/api/v1/services/aigc/multimodal-generation/generation`;

    // 使用 qwen-vl-max (目前最强版本)
    const MODEL_NAME = "qwen-vl-max"; 

    this.logUsage(MODEL_NAME);

    console.log(`Calling Aliyun VL API (${MODEL_NAME}) via Vercel Proxy...`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'enable',
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          input: { messages: messages },
          parameters: { 
            incremental_output: true,
            result_format: "message" 
          }
        }),
      });

      if (!response.ok) {
        await this.handleError(response);
      }
      if (!response.body) throw new Error("No response body");

      await this.processStream(response.body, (json) => {
         // VL Generation output format
         const content = json.output?.choices?.[0]?.message?.content?.[0]?.text || "";
         if (content) onChunk(content);
      });

    } catch (error) {
      console.error("Aliyun VL Error Details:", error);
      throw error;
    }
  }

  // --- Helper Methods ---

  private async handleError(response: Response) {
    let errorMessage = `API 请求失败 (${response.status})`;
    
    if (response.status === 504) {
      throw new Error("请求超时：服务器响应时间过长 (504)。图片可能太大，或 AI 正在深度思考。");
    }

    try {
      const errorText = await response.text();
      console.error("API Error Response Body:", errorText);
      const errJson = JSON.parse(errorText);
      errorMessage = errJson.message || errJson.code || response.statusText;
    } catch (e) {
      // Ignore json parse error
    }
    throw new Error(errorMessage);
  }

  private async processStream(body: ReadableStream<Uint8Array>, callback: (json: any) => void) {
      const reader = body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        const lines = buffer.split("\n");
        if (buffer.endsWith("\n")) {
            buffer = "";
        } else {
            buffer = lines.pop() || ""; 
        }

        for (const line of lines) {
          if (line.startsWith("data:")) {
             const dataStr = line.slice(5).trim();
             if (dataStr === "" || dataStr === "[DONE]") continue;
             try {
               const json = JSON.parse(dataStr);
               if (json.code && json.message) {
                 throw new Error(json.message);
               }
               callback(json);
             } catch (e) {
                if (e instanceof Error && e.message.includes('Unexpected')) {
                    // Ignore parse error for partial json
                } else {
                    throw e;
                }
             }
          }
        }
      }
  }
}

export const aliyunService = new AliyunService();
