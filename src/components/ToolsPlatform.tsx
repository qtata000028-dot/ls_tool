import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { ArrowLeft, Database, Search, AlertCircle, Loader2, Table, Terminal, RefreshCw } from 'lucide-react';

interface ToolsPlatformProps {
  onBack: () => void;
}

const ToolsPlatform: React.FC<ToolsPlatformProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // --- 核心逻辑：加载员工数据 ---
  const loadEmployeeData = async () => {
    setLoading(true);
    setError(null);
    setData([]);

    try {
      // 1. 查配置：适配您的表结构 (config_name, api_url, api_token)
      const { data: configData, error: configError } = await supabase
        .from('app_configs')
        .select('api_url, api_token')
        .eq('config_name', 'local_sql_server')
        .single();

      if (configError || !configData) {
        throw new Error("配置缺失：无法在 app_configs 表中找到 config_name = 'local_sql_server' 的数据。");
      }

      // 直接从列中获取，不再解构 JSON
      let { api_url, api_token } = configData;

      if (!api_url || !api_token) {
        throw new Error("配置无效：数据库中 api_url 或 api_token 字段为空。");
      }

      // 自动补全 URL 路径逻辑
      // 1. 去除首尾空格
      let targetUrl = api_url.trim();
      // 2. 去除末尾斜杠 (如果存在)
      if (targetUrl.endsWith('/')) {
        targetUrl = targetUrl.slice(0, -1);
      }
      // 3. 如果未包含后缀，则追加
      if (!targetUrl.endsWith('/api/sql/execute')) {
        targetUrl += '/api/sql/execute';
      }

      // 2. 查数据：调用外部接口
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Token: api_token,
          Sql: "select * from p_employeetab" // 您指定的 SQL
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`请求失败 (${response.status}): ${errText.slice(0, 100)}...`);
      }

      const result = await response.json();

      // 兼容接口返回：可能是数组，也可能是 { data: [...] }
      const rows = Array.isArray(result) ? result : (result.data || []);

      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("查询成功，但未返回任何数据行。");
      }

      // 3. 渲染准备：提取表头
      const tableHeaders = Object.keys(rows[0]);
      setHeaders(tableHeaders);
      setData(rows);

    } catch (err: any) {
      console.error("Tools Load Error:", err);
      setError(err.message || "未知错误，请检查网络或控制台日志");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[85vh] w-full max-w-[1600px] mx-auto rounded-[24px] overflow-hidden bg-[#020617] border border-white/10 shadow-2xl backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-500 flex-col">
      
      {/* Header */}
      <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between bg-[#0F1629]/50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
            <ArrowLeft size={20}/>
          </button>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Database className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">员工数据查询</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span className="text-[10px] text-blue-400/80 uppercase tracking-wider">SQL Data Connector</span>
            </div>
          </div>
        </div>

        <button 
          onClick={loadEmployeeData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? '查询中...' : '刷新数据'}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden p-6 relative bg-[#020617]/80">
        
        {/* Empty State */}
        {!loading && data.length === 0 && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 border border-white/5 shadow-[0_0_30px_rgba(30,41,59,0.5)]">
              <Terminal className="w-8 h-8 opacity-50" />
            </div>
            <p className="text-sm font-medium text-slate-400">准备就绪</p>
            <p className="text-xs opacity-50 mt-1 font-mono">点击右上角按钮获取 p_employeetab 表数据</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 flex items-start gap-3 mb-4 animate-in slide-in-from-top-2 shadow-lg shadow-red-900/10">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold mb-1">查询出错</p>
              <p className="opacity-80 font-mono text-xs break-all">{error}</p>
            </div>
          </div>
        )}

        {/* Data Table (ERP Style) */}
        {data.length > 0 && (
          <div className="h-full rounded-xl border border-white/10 overflow-auto bg-[#0F1629]/40 backdrop-blur-md shadow-inner custom-scrollbar">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#1E293B] border-b border-white/10 shadow-sm">
                  {headers.map((header, idx) => (
                    <th key={idx} className="px-4 py-3 text-xs font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap border-r border-white/5 last:border-r-0 bg-[#1E293B]">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((row, rowIndex) => (
                  <tr 
                    key={rowIndex} 
                    className="group hover:bg-blue-500/10 transition-colors even:bg-white/[0.02]"
                  >
                    {headers.map((header, colIndex) => (
                      <td key={`${rowIndex}-${colIndex}`} className="px-4 py-2.5 text-slate-300 whitespace-nowrap border-r border-white/5 last:border-r-0 font-mono text-xs group-hover:text-white">
                        {String(row[header] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      {data.length > 0 && (
        <div className="h-8 border-t border-white/5 bg-[#0F1629] px-4 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            STATUS: READY
          </span>
          <span>ROWS: {data.length}</span>
        </div>
      )}
    </div>
  );
};

export default ToolsPlatform;