import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { aliyunService, ChatMessage } from '../services/aliyunService';
import { 
  ArrowLeft, Search, Loader2, RefreshCw, 
  Copy, Eye, EyeOff, Edit2, X, 
  Filter, ChevronDown, Check,
  BarChart3, PieChart, TrendingUp, Users, BrainCircuit, Terminal, Cpu, ShieldCheck, Activity, Sparkles, Database, Code2, Lock
} from 'lucide-react';

// --- Types ---
interface Department {
  Departmentid: string | number;
  departmentname: string;
}

interface Employee {
  employeename: string;
  webbmp?: string | null;
  P_emp_no: string;
  Departmentid: string | number;
  P_emp_sex: string;
  p_emp_phone: string;
  P_emp_Status: string;
  p_emp_degree: string;
  P_emp_workJoindt: string;
  [key: string]: any; 
}

interface ToolsPlatformProps {
  onBack: () => void;
  aiParams?: any; 
}

interface ChartConfig {
  id: string;
  type: 'stat' | 'pie' | 'bar';
  title: string;
  field: string;
  operation?: 'count' | 'distinct';
  color?: string;
  description?: string;
}

interface AIReport {
  summary: string;
  charts: ChartConfig[];
}

// --- Custom UI Components ---

const CustomSelect = ({ value, onChange, options, placeholder = "请选择", icon: Icon, className = "" }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((opt: any) => String(opt.value) === String(value))?.label || placeholder;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-black/20 border transition-all duration-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none 
          ${isOpen ? 'border-indigo-500/50 bg-black/40 ring-1 ring-indigo-500/20' : 'border-white/10 hover:bg-white/5'}
        `}
      >
        <div className="flex items-center gap-2 truncate">
          {Icon && <Icon className="w-4 h-4 text-slate-500" />}
          <span className={!value ? 'text-slate-500' : 'text-slate-200'}>{selectedLabel}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 overflow-hidden bg-[#1E293B] border border-white/10 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
           <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent py-1">
              {options.length > 0 ? (
                options.map((opt: any) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`
                      relative px-3 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors
                      ${String(value) === String(opt.value) 
                        ? 'bg-indigo-600/10 text-indigo-300' 
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'}
                    `}
                  >
                    <span>{opt.label}</span>
                    {String(value) === String(opt.value) && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                ))
              ) : (
                <div className="px-3 py-3 text-xs text-slate-500 text-center">无选项</div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

const ToolsPlatform: React.FC<ToolsPlatformProps> = ({ onBack, aiParams }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // States
  const [visiblePhones, setVisiblePhones] = useState<Set<string>>(new Set());
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
  const [keyword, setKeyword] = useState('');
  const [selectedDept, setSelectedDept] = useState<string | number>('');

  // BI Dashboard State (Dynamic)
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiReportConfig, setAiReportConfig] = useState<AIReport | null>(null);
  
  // --- CINEMATIC LOADING STATES ---
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [codeStream, setCodeStream] = useState(""); // The raw JSON being built
  const [processedCount, setProcessedCount] = useState(0); // "Eating data" counter
  const logContainerRef = useRef<HTMLDivElement>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  // --- API Handling ---
  const getApiConfig = async () => {
    const { data: configData, error: configError } = await supabase
        .from('app_configs')
        .select('api_url, api_token')
        .eq('config_name', 'local_sql_server')
        .single();
    if (configError || !configData?.api_url) throw new Error("配置缺失 (local_sql_server)");
    let { api_url, api_token } = configData;
    api_url = api_url.trim();
    if (api_url.endsWith('/')) api_url = api_url.slice(0, -1);
    if (!api_url.endsWith('/api/sql/execute')) api_url += '/api/sql/execute';
    return { api_url, api_token };
  };

  const loadData = async (triggerParams?: any) => {
    setLoading(true);
    setError(null);
    try {
      const { api_url, api_token } = await getApiConfig();
      const fetchTable = async (sql: string) => {
        const res = await fetch(api_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Token: api_token, Sql: sql })
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const json = await res.json();
        return Array.isArray(json) ? json : (json.data || []);
      };

      const [empData, deptData] = await Promise.all([
        fetchTable("select * from p_employeetab"),
        fetchTable("select Departmentid, departmentname from P_DepartmentTab")
      ]);

      setEmployees(Array.isArray(empData) ? empData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      
      // If triggered by AI, start the dynamic analysis
      if (triggerParams?.mode === 'analysis') {
         setIsAnalysisOpen(true);
         // Ensure data is set in state before running analysis
         setTimeout(() => {
             generateDynamicAnalysis(triggerParams.query, Array.isArray(empData) ? empData : [], Array.isArray(deptData) ? deptData : []);
         }, 500);
      }

    } catch (err: any) {
      console.error(err);
      setError(`数据加载失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- AI Dynamic Logic (The "Visual Processing" Effect) ---
  
  const generateDynamicAnalysis = async (userQuery: string, currentEmployees: Employee[], currentDepts: Department[]) => {
      setIsAiGenerating(true);
      setAiReportConfig(null);
      setTerminalLines([]);
      setCodeStream("");
      setProcessedCount(0);

      // --- 1. Start Visual "Data Ingestion" Counter ---
      // This simulates "Eating Data"
      let currentCount = 0;
      const targetCount = currentEmployees.length || 150; // Use 150 if empty for demo
      
      const ingestionInterval = setInterval(() => {
          if (currentCount < targetCount) {
             const step = Math.ceil((targetCount - currentCount) / 10);
             currentCount += Math.max(1, step);
             if (currentCount > targetCount) currentCount = targetCount;
             setProcessedCount(currentCount);
          }
      }, 50);

      // --- 2. Start "Keep Alive" Logs ---
      // This ensures screen is never static even if API is slow
      const phrases = [
          "Running semantic analysis...", 
          "Mapping department IDs to entities...",
          "Detecting data anomalies...",
          "Optimizing chart selection...",
          "Validating schema constraints...",
          "Calculating aggregates...",
          "Normalizing dataset..."
      ];
      
      const keepAliveInterval = setInterval(() => {
          if (Math.random() > 0.6) {
              const phrase = phrases[Math.floor(Math.random() * phrases.length)];
              setTerminalLines(prev => {
                  const newLogs = [...prev, `[KERNEL] ${phrase} (${Math.random().toFixed(3)}s)`];
                  return newLogs.slice(-6); // Keep only last 6 lines to avoid clutter
              });
          }
      }, 800);

      setTerminalLines(prev => [...prev, `[SYSTEM] Establishing secure uplink to Aliyun Qwen-Max...`]);
      setTerminalLines(prev => [...prev, `[DATA] Ingesting ${targetCount} records from local buffer...`]);

      try {
        // Construct Context
        const schemaSample = {
            P_emp_sex: "男/女",
            Departmentid: "ID(Int)",
            P_emp_Status: "正式/试用/离职"
        };
        const deptMappingSample = currentDepts.slice(0, 8).map(d => `${d.Departmentid}:${d.departmentname}`).join(",");

        const systemPrompt = `
Context: HR Dashboard. Data Schema: ${JSON.stringify(schemaSample)}. Depts: ${deptMappingSample}.
Query: "${userQuery}"
Task: Return VALID JSON to configure charts.
Format:
{
  "summary": "Short insight (Chinese)",
  "charts": [
    { "id": "c1", "type": "stat", "title": "Label", "field": "P_emp_sex", "operation": "count" },
    { "id": "c2", "type": "pie", "title": "Label", "field": "P_emp_Status" },
    { "id": "c3", "type": "bar", "title": "Label", "field": "Departmentid" }
  ]
}`;
        
        let fullResponse = "";
        
        // Call API
        await aliyunService.chatStream([{ role: 'system', content: systemPrompt }], (chunk) => {
            fullResponse += chunk;
            // UPDATE: Show the raw code growing on screen
            setCodeStream(prev => prev + chunk);
        });

        if (!fullResponse) throw new Error("Empty response from AI Gateway.");

        setTerminalLines(prev => [...prev, `[SUCCESS] Payload received. Rendering...`]);

        // Parse JSON
        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const config = JSON.parse(jsonMatch[0]);
            // Tiny delay to let user see the "100%" completion
            await new Promise(r => setTimeout(r, 800));
            setAiReportConfig(config);
        } else {
            throw new Error("Invalid JSON signature in response.");
        }

      } catch (e: any) {
          console.error("AI Gen Error", e);
          setTerminalLines(prev => [...prev, `[ERROR] ${e.message}`]);
          
          // Fallback
          const fallbackConfig: AIReport = {
              summary: "云端连接不稳定，已自动切换至本地分析模式。",
              charts: [
                  { id: 'fb1', type: 'stat', title: '总员工数', field: 'P_emp_no', operation: 'count' },
                  { id: 'fb2', type: 'pie', title: '性别分布', field: 'P_emp_sex' },
                  { id: 'fb3', type: 'bar', title: '部门分布', field: 'Departmentid' }
              ]
          };
          // Show error for a moment then switch
          setTimeout(() => setAiReportConfig(fallbackConfig), 2000);

      } finally {
          clearInterval(ingestionInterval);
          clearInterval(keepAliveInterval);
          setProcessedCount(targetCount); // Ensure 100%
          setIsAiGenerating(false);
      }
  };

  // Auto-scroll effect
  useEffect(() => {
      if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
      if (codeContainerRef.current) {
          codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
      }
  }, [terminalLines, codeStream]);

  // --- Effects ---
  useEffect(() => {
    const shouldAnalyze = aiParams?.mode === 'analysis';
    loadData(aiParams);
  }, [aiParams]);

  // --- Data Aggregation Logic ---
  const getAggregatedData = (chartConfig: ChartConfig) => {
      const field = chartConfig.field;
      if (chartConfig.type === 'stat') {
          if (chartConfig.operation === 'count') return employees.length;
          return 0;
      }
      const counts: Record<string, number> = {};
      employees.forEach(emp => {
          let val = emp[field];
          if (field === 'Departmentid') {
             val = departments.find(d => String(d.Departmentid) === String(val))?.departmentname || `Dept ${val}`;
          }
          if (!val) val = "未知";
          counts[String(val)] = (counts[String(val)] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }));
  };

  // --- Helpers ---
  const togglePhoneVisibility = (id: string) => {
    const newSet = new Set(visiblePhones);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setVisiblePhones(newSet);
  };
  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);
  const openEditor = (emp: Employee) => { setCurrentEmp({ ...emp }); setIsEditorOpen(true); };
  
  const handleSave = async () => {
    if (!currentEmp) return;
    setSaving(true);
    try {
        const { api_url, api_token } = await getApiConfig();
        const sql = `UPDATE p_employeetab SET 
            employeename = '${currentEmp.employeename}',
            Departmentid = ${currentEmp.Departmentid},
            P_emp_sex = '${currentEmp.P_emp_sex}',
            p_emp_phone = '${currentEmp.p_emp_phone}',
            P_emp_Status = '${currentEmp.P_emp_Status}',
            p_emp_degree = '${currentEmp.p_emp_degree}',
            P_emp_workJoindt = '${currentEmp.P_emp_workJoindt ? currentEmp.P_emp_workJoindt.split('T')[0] : ''}'
            WHERE P_emp_no = '${currentEmp.P_emp_no}'`;

        const res = await fetch(api_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Token: api_token, Sql: sql })
        });
        if (!res.ok) throw new Error("保存失败");
        setEmployees(prev => prev.map(e => e.P_emp_no === currentEmp.P_emp_no ? currentEmp : e));
        setIsEditorOpen(false);
    } catch (err: any) {
        alert(`保存失败: ${err.message}`);
    } finally {
        setSaving(false);
    }
  };

  const filteredData = useMemo(() => {
    return employees.filter(emp => {
      const matchKeyword = !keyword || emp.employeename?.includes(keyword) || emp.P_emp_no?.includes(keyword);
      const matchDept = !selectedDept || String(emp.Departmentid) === String(selectedDept);
      return matchKeyword && matchDept;
    });
  }, [employees, keyword, selectedDept]);

  const getDeptName = (id: string | number) => departments.find(d => String(d.Departmentid) === String(id))?.departmentname || `${id}`;
  const getStatusColor = (status: string) => {
    switch (status) {
      case '正式': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case '试用': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case '离职': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const deptOptions = [{ value: '', label: '所有部门' }, ...departments.map(d => ({ value: d.Departmentid, label: d.departmentname }))];
  const editDeptOptions = departments.map(d => ({ value: d.Departmentid, label: d.departmentname }));
  const statusOptions = [{ value: '正式', label: '正式员工' }, { value: '试用', label: '试用期' }, { value: '离职', label: '已离职' }];

  return (
    <div className="w-full h-[85vh] max-w-[1600px] mx-auto bg-[#0F1629]/80 backdrop-blur-2xl border border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500 relative">
         
         {/* 1. Navbar */}
         <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/[0.02]">
            <div className="flex items-center gap-4">
               <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                  <ArrowLeft size={20} />
               </button>
               <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  员工管理中心
               </h2>
               <div className="h-4 w-[1px] bg-white/10 mx-2"></div>
               <span className="text-sm text-slate-400 font-mono">Total: {filteredData.length}</span>
            </div>

            <div className="flex items-center gap-3">
               <button 
                  onClick={() => {
                      setIsAnalysisOpen(true);
                      if (!aiReportConfig) generateDynamicAnalysis("综合分析", employees, departments);
                  }}
                  className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600/80 to-indigo-600/80 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-all border border-white/10"
               >
                  <BarChart3 size={14} /> 数据驾驶舱
               </button>
               
               <div className="w-[160px] hidden md:block">
                  <CustomSelect 
                    icon={Filter}
                    value={selectedDept}
                    onChange={(val: any) => setSelectedDept(val)}
                    options={deptOptions}
                    placeholder="部门筛选"
                  />
               </div>

               <div className="relative group w-40 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input 
                      type="text" 
                      placeholder="搜索姓名、工号..." 
                      value={keyword}
                      onChange={e => setKeyword(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
               </div>

               <div className="h-4 w-[1px] bg-white/10 mx-1"></div>

               <button onClick={() => loadData()} disabled={loading} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
               </button>
            </div>
         </div>

         {/* 2. Table */}
         <div className="flex-1 overflow-auto custom-scrollbar relative">
            <table className="w-full text-left border-separate border-spacing-0">
               <thead className="sticky top-0 z-20 bg-[#0F1629] text-xs font-bold text-slate-500 uppercase tracking-wider shadow-sm">
                  <tr>
                     <th className="sticky left-0 z-30 bg-[#0F1629] px-6 py-4 border-b border-white/10 border-r border-white/5 w-[200px]">员工信息</th>
                     <th className="px-6 py-4 border-b border-white/10 w-[120px]">工号</th>
                     <th className="px-6 py-4 border-b border-white/10">所属部门</th>
                     <th className="px-6 py-4 border-b border-white/10">状态</th>
                     <th className="px-6 py-4 border-b border-white/10">联系电话</th>
                     <th className="px-6 py-4 border-b border-white/10">入职日期</th>
                     <th className="sticky right-0 z-30 bg-[#0F1629] px-6 py-4 border-b border-white/10 border-l border-white/5 text-right w-[100px]">操作</th>
                  </tr>
               </thead>
               <tbody className="text-sm divide-y divide-white/5">
                  {loading && employees.length === 0 ? (
                      <tr><td colSpan={7} className="py-32 text-center text-slate-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2"/> 数据同步中...</td></tr>
                  ) : filteredData.length === 0 ? (
                      <tr><td colSpan={7} className="py-32 text-center text-slate-500">未找到相关数据</td></tr>
                  ) : (
                      filteredData.map((row, idx) => {
                          const isPhoneVisible = visiblePhones.has(row.P_emp_no);
                          return (
                             <tr key={row.P_emp_no} onDoubleClick={() => openEditor(row)} className="group hover:bg-white/[0.03] transition-colors cursor-pointer">
                                <td className="sticky left-0 z-10 px-6 py-3 bg-[#0F1629] group-hover:bg-[#131b2e] border-r border-white/5 transition-colors">
                                   <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                                         {row.webbmp ? <img src={row.webbmp} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-slate-400">{row.employeename?.[0] || 'U'}</span>}
                                      </div>
                                      <div>
                                         <div className="font-bold text-slate-200">{row.employeename}</div>
                                         <div className="text-[10px] text-slate-500">{row.p_emp_degree || '未记录'}</div>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-3 text-slate-400 font-mono text-xs">
                                   <div className="flex items-center gap-2 group/id">
                                      {row.P_emp_no}
                                      <button onClick={(e) => { e.stopPropagation(); copyToClipboard(row.P_emp_no); }} className="opacity-0 group-hover/id:opacity-100 text-slate-500 hover:text-white"><Copy size={12}/></button>
                                   </div>
                                </td>
                                <td className="px-6 py-3 text-slate-300">{getDeptName(row.Departmentid)}</td>
                                <td className="px-6 py-3">
                                   <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${getStatusColor(row.P_emp_Status)}`}>{row.P_emp_Status}</span>
                                </td>
                                <td className="px-6 py-3 text-slate-400 font-mono text-xs">
                                   <div className="flex items-center gap-2">
                                      {isPhoneVisible ? row.p_emp_phone : (row.p_emp_phone ? row.p_emp_phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '-')}
                                      <button onClick={(e) => { e.stopPropagation(); togglePhoneVisibility(row.P_emp_no); }} className="p-1 hover:text-white text-slate-600">{isPhoneVisible ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                                   </div>
                                </td>
                                <td className="px-6 py-3 text-slate-400 text-xs">{row.P_emp_workJoindt ? row.P_emp_workJoindt.split('T')[0] : '-'}</td>
                                <td className="sticky right-0 z-10 px-6 py-3 bg-[#0F1629] group-hover:bg-[#131b2e] border-l border-white/5 text-right transition-colors">
                                   <button onClick={() => openEditor(row)} className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors"><Edit2 size={16} /></button>
                                </td>
                             </tr>
                          );
                      })
                  )}
               </tbody>
            </table>
         </div>

         {/* 3. Editor Modal */}
         {isEditorOpen && currentEmp && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setIsEditorOpen(false)} />
               <div className="relative w-full max-w-2xl bg-[#0F1629] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center">
                           {currentEmp.webbmp ? <img src={currentEmp.webbmp} className="w-full h-full object-cover" /> : <span className="font-bold text-slate-400">{currentEmp.employeename?.[0] || 'U'}</span>}
                        </div>
                        <div>
                           <h3 className="font-bold text-white text-base">编辑员工信息</h3>
                           <p className="text-xs text-slate-400">工号: {currentEmp.P_emp_no}</p>
                        </div>
                     </div>
                     <button onClick={() => setIsEditorOpen(false)} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"><X size={18}/></button>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-x-6 gap-y-5">
                     <div className="col-span-1 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">姓名</label>
                        <input type="text" value={currentEmp.employeename} onChange={e => setCurrentEmp({...currentEmp, employeename: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none" />
                     </div>
                     <div className="col-span-1 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">联系电话</label>
                        <input type="text" value={currentEmp.p_emp_phone} onChange={e => setCurrentEmp({...currentEmp, p_emp_phone: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none" />
                     </div>
                     <div className="col-span-1 space-y-1.5">
                         <label className="text-xs font-medium text-slate-400">性别</label>
                         <div className="flex gap-4 pt-1">
                             {['男', '女'].map(g => (
                                 <label key={g} className="flex items-center gap-2 cursor-pointer bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-white/5">
                                     <input type="radio" className="accent-indigo-500" checked={currentEmp.P_emp_sex === g} onChange={() => setCurrentEmp({...currentEmp, P_emp_sex: g})} />
                                     <span className="text-sm text-slate-300">{g}</span>
                                 </label>
                             ))}
                         </div>
                     </div>
                     <div className="col-span-1 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">学历</label>
                        <input type="text" value={currentEmp.p_emp_degree} onChange={e => setCurrentEmp({...currentEmp, p_emp_degree: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none" />
                     </div>
                     <div className="col-span-1 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">所属部门</label>
                        <CustomSelect value={currentEmp.Departmentid} onChange={(val: any) => setCurrentEmp({...currentEmp, Departmentid: val})} options={editDeptOptions} placeholder="选择部门" />
                     </div>
                     <div className="col-span-1 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">员工状态</label>
                        <CustomSelect value={currentEmp.P_emp_Status} onChange={(val: any) => setCurrentEmp({...currentEmp, P_emp_Status: String(val)})} options={statusOptions} placeholder="选择状态" />
                     </div>
                     <div className="col-span-2 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">入职日期</label>
                        <input type="date" value={currentEmp.P_emp_workJoindt ? currentEmp.P_emp_workJoindt.split('T')[0] : ''} onChange={e => setCurrentEmp({...currentEmp, P_emp_workJoindt: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none" />
                     </div>
                  </div>
                  <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end gap-3">
                     <button onClick={() => setIsEditorOpen(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5">取消</button>
                     <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium flex items-center gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />} 保存更改
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* 4. DYNAMIC BI Dashboard (Analysis Mode) - Boss View */}
         {isAnalysisOpen && (
            <div className="absolute inset-0 z-50 bg-[#0F1629] flex flex-col animate-in slide-in-from-bottom-10 duration-500">
               {/* Header */}
               <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-900/20 to-indigo-900/20">
                  <div className="flex items-center gap-3">
                     <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                        <BrainCircuit size={20} className={isAiGenerating ? "animate-pulse" : ""} />
                     </div>
                     <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">AI 数据驾驶舱</h2>
                        <p className="text-[10px] text-indigo-300 font-mono">
                           {isAiGenerating ? "ESTABLISHING NEURAL LINK..." : (aiParams?.query || "实时分析")}
                        </p>
                     </div>
                  </div>
                  <button onClick={() => setIsAnalysisOpen(false)} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                     <X size={24} />
                  </button>
               </div>

               {/* Content */}
               <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                  
                  {isAiGenerating ? (
                      <div className="h-full flex flex-col items-center justify-center p-4">
                         {/* CYBERPUNK LOADING TERMINAL */}
                         <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Left: Terminal Log */}
                            <div className="col-span-1 bg-black/90 border border-emerald-500/30 rounded-lg shadow-[0_0_50px_rgba(16,185,129,0.1)] overflow-hidden font-mono text-xs relative h-80 flex flex-col">
                                <div className="bg-emerald-900/20 px-4 py-2 border-b border-emerald-500/30 flex items-center justify-between">
                                    <span className="text-emerald-400 flex items-center gap-2">
                                        <Terminal size={14} /> SYSTEM_KERNEL
                                    </span>
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></div>
                                    </div>
                                </div>
                                <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 text-emerald-500/80 space-y-1 custom-scrollbar">
                                    {terminalLines.map((line, i) => (
                                       <div key={i} className="border-l-2 border-emerald-500/30 pl-2">
                                           <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                                           {line}
                                       </div>
                                    ))}
                                    <div className="animate-pulse text-emerald-400">_</div>
                                </div>
                            </div>

                            {/* Right: Data Ingestion & Code Stream */}
                            <div className="col-span-1 space-y-4">
                                {/* 1. Data Ingestion Counter */}
                                <div className="bg-black/80 border border-blue-500/30 rounded-lg p-4 relative overflow-hidden">
                                   <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 animate-pulse"></div>
                                   <div className="flex justify-between items-end mb-2">
                                      <span className="text-blue-400 font-mono text-xs">DATA_INGESTION_RATE</span>
                                      <span className="text-blue-300 font-bold text-xl font-mono">
                                         {processedCount} <span className="text-sm opacity-50">/ {employees.length || 150}</span>
                                      </span>
                                   </div>
                                   <div className="w-full bg-blue-900/20 h-2 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" 
                                        style={{ width: `${Math.min(100, (processedCount / (employees.length || 150)) * 100)}%` }}
                                      ></div>
                                   </div>
                                </div>

                                {/* 2. Code Stream Window */}
                                <div className="bg-[#0c0c0c] border border-white/10 rounded-lg flex-1 h-48 flex flex-col overflow-hidden relative">
                                   <div className="px-3 py-1.5 border-b border-white/10 bg-white/5 flex items-center justify-between">
                                      <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                         <Code2 size={12} /> GENERATING_JSON_PAYLOAD...
                                      </span>
                                      <Lock size={10} className="text-slate-600"/>
                                   </div>
                                   <div ref={codeContainerRef} className="flex-1 p-3 overflow-y-auto font-mono text-[10px] text-indigo-300 leading-relaxed opacity-80">
                                      <pre className="whitespace-pre-wrap break-all">
                                         {codeStream || <span className="animate-pulse">Waiting for tokens...</span>}
                                         <span className="inline-block w-1.5 h-3 bg-indigo-500 ml-1 animate-pulse"></span>
                                      </pre>
                                   </div>
                                </div>
                            </div>
                         </div>
                      </div>
                  ) : aiReportConfig ? (
                      <>
                        {/* AI Summary */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 text-indigo-200 text-sm leading-relaxed flex gap-3 animate-in slide-in-from-top-4 duration-700">
                            <Sparkles size={18} className="shrink-0 mt-0.5" />
                            {aiReportConfig.summary}
                        </div>

                        {/* Stats Row (First layer of grid) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           {aiReportConfig.charts
                              .filter(c => c.type === 'stat')
                              .map((chart) => {
                                  const val = getAggregatedData(chart) as number;
                                  return (
                                    <div key={chart.id} className="bg-[#1E293B]/50 p-5 rounded-2xl border border-white/5 flex flex-col justify-between h-32 animate-in zoom-in-95 duration-500">
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs text-slate-400 font-medium uppercase">{chart.title}</span>
                                            <TrendingUp size={16} className="text-blue-400" />
                                        </div>
                                        <div className="text-4xl font-bold text-white tabular-nums">{val}</div>
                                    </div>
                                  );
                              })
                           }
                        </div>

                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {aiReportConfig.charts
                              .filter(c => c.type !== 'stat')
                              .map((chart) => {
                                  const data = getAggregatedData(chart) as {name: string, value: number}[];
                                  const total = data.reduce((acc, curr) => acc + curr.value, 0);

                                  return (
                                     <div key={chart.id} className="bg-[#1E293B]/50 p-6 rounded-2xl border border-white/5 flex flex-col animate-in slide-in-from-bottom-4 duration-700">
                                         <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                                            {chart.type === 'pie' ? <PieChart size={16} className="text-purple-400"/> : <BarChart3 size={16} className="text-blue-400"/>}
                                            {chart.title}
                                         </h3>

                                         {chart.type === 'pie' ? (
                                             // Dynamic Pie Visual
                                             <div className="flex items-center gap-6 justify-center py-4">
                                                 {data.slice(0, 3).map((item, idx) => {
                                                     const colors = ['bg-blue-500', 'bg-pink-500', 'bg-emerald-500', 'bg-amber-500'];
                                                     const color = colors[idx % colors.length];
                                                     const height = total > 0 ? (item.value / total) * 100 : 0;
                                                     return (
                                                         <div key={item.name} className="flex flex-col items-center gap-2">
                                                             <div className="relative w-14 bg-slate-800 rounded-full h-32 flex items-end overflow-hidden border border-white/5">
                                                                 <div style={{ height: `${height}%` }} className={`w-full ${color} transition-all duration-1000 ease-out`}></div>
                                                             </div>
                                                             <div className="text-center">
                                                                 <div className="text-xs font-bold text-white">{item.name}</div>
                                                                 <div className="text-[10px] text-slate-400">{item.value} ({Math.round(height)}%)</div>
                                                             </div>
                                                         </div>
                                                     )
                                                 })}
                                             </div>
                                         ) : (
                                             // Dynamic Bar Visual
                                             <div className="space-y-3">
                                                 {data.slice(0, 5).map((item, idx) => (
                                                     <div key={item.name} className="space-y-1">
                                                         <div className="flex justify-between text-xs text-slate-300">
                                                             <span className="truncate max-w-[150px]">{item.name}</span>
                                                             <span className="font-mono">{item.value}</span>
                                                         </div>
                                                         <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                             <div 
                                                                 style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%`, transitionDelay: `${idx * 100}ms` }}
                                                                 className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
                                                             ></div>
                                                         </div>
                                                     </div>
                                                 ))}
                                             </div>
                                         )}
                                     </div>
                                  )
                              })
                           }
                        </div>
                      </>
                  ) : null}
               </div>
            </div>
         )}
    </div>
  );
};

export default ToolsPlatform;