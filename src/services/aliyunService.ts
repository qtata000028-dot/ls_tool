import { supabase } from './supabaseClient';
import { dataService } from './dataService';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
   * 调用阿里云百炼应用 API (流式)
   */
  async chatStream(messages: ChatMessage[], onChunk: (text: string) => void) {
    // 1. 获取配置
    const config = await this.getConfig();

    // 2. 准备请求体 (根据阿里云百炼 API 标准)
    // 文档参考: https://help.aliyun.com/document_detail/2712576.html
    const url = `https://dashscope.aliyuncs.com/api/v1/apps/${config.appId}/completion`;
    
    // 提取最后一条用户消息作为 prompt
    const prompt = messages[messages.length - 1].content;

    // 记录调用日志 (异步记录，不阻塞主流程)
    this.logUsage('aliyun-rag-bailian');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'enable', // 开启流式 SSE
        },
        body: JSON.stringify({
          input: {
            prompt: prompt,
            // 如果需要多轮对话上下文，可以在这里扩展，目前简单起见只传 prompt
            // history: messages.slice(0, -1).map(...)
          },
          parameters: {
            incremental_output: true, // 增量输出
          },
          debug: {}
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // 尝试解析错误 JSON 以显示更友好的信息
        try {
            const errJson = JSON.parse(errorText);
            throw new Error(`API 请求失败: ${errJson.message || errJson.code || response.status}`);
        } catch (e) {
            throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
        }
      }

      if (!response.body) throw new Error("No response body");

      // 3. 处理 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        const lines = buffer.split("\n");
        // 保留最后一个可能不完整的片段
        buffer = lines.pop() || ""; 

        for (const line of lines) {
          if (line.startsWith("data:")) {
             const dataStr = line.slice(5).trim();
             if (dataStr === "" || dataStr === "[DONE]") continue;
             
             try {
               const json = JSON.parse(dataStr);
               // 百炼返回结构通常是 output.text
               const content = json.output?.text || "";
               if (content) {
                 onChunk(content);
               }
             } catch (e) {
               console.warn("Parse error", e);
             }
          }
        }
      }

    } catch (error) {
      console.error("Aliyun Service Error:", error);
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
}

export const aliyunService = new AliyunService();