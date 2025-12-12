import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { aliyunService } from '../services/aliyunService';
import { dataService } from '../services/dataService'; 
import { 
  ArrowLeft, Search, Loader2, RefreshCw, 
  Copy, Eye, EyeOff, Edit2, X, 
  Filter, ChevronDown, Check,
  BarChart3, PieChart, TrendingUp, BrainCircuit, Terminal, Code2, Lock, TableProperties,
  Cpu, Activity, Zap, Layers, Network, Fingerprint, Database, Share2, Sparkles,
  AlertTriangle, Target, Lightbulb, Radar, LineChart, ShieldAlert, CheckCircle2,
  Briefcase, Calendar
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
  insight?: string; // NEW: AI insight for specific chart
}

// UPGRADED AI REPORT INTERFACE
interface AIReport {
  summary: string;
  charts: ChartConfig[];
  risks: Array<{ title: string; level: 'high' | 'medium' | 'low'; desc: string }>;
  suggestions: Array<{ title: string; action: string; priority?: string }>;
  prediction: string; 
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
  
  // Dynamic Schema State
  const [dataSchema, setDataSchema] = useState<Record<string, string>>({});
  
  // States
  const [visiblePhones, setVisiblePhones] = useState<Set<string>>(new Set());
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSchemaOpen, setIsSchemaOpen] = useState(false);
  const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
  const [keyword, setKeyword] = useState('');
  const [selectedDept, setSelectedDept] = useState<string | number>('');

  // BI Dashboard State (Dynamic)
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiReportConfig, setAiReportConfig] = useState<AIReport | null>(null);
  
  // Recruitment Trend Data (Calculated)
  const [recruitmentTrend, setRecruitmentTrend] = useState<{year: string, count: number}[]>([]);

  // Smart Preset Queries & Data Quality
  const smartQueryPresets = useMemo(() => [
    { label: '学历与岗位匹配度', query: '分析各部门学历结构与核心岗位匹配度，并标记风险部门' },
    { label: '离职与绩效预警', query: '结合入职年限和状态，识别离职风险最高的部门及原因' },
    { label: '人才补给缺口', query: '根据近五年入职趋势，预测明年需要补充的人才岗位与数量' },
    { label: '电话/信息缺失修复', query: '找出信息缺失严重的部门并给出数据治理优先级' },
  ], []);

  const dataQualityMetrics = useMemo(() => {
    const total = employees.length || 1;
    const phoneFilled = employees.filter(e => !!e.p_emp_phone).length;
    const degreeFilled = employees.filter(e => !!e.p_emp_degree).length;
    const joinDateFilled = employees.filter(e => !!e.P_emp_workJoindt).length;

    return [
      {
        title: '联系方式完整度',
        value: Math.round((phoneFilled / total) * 100),
        desc: `${phoneFilled}/${total} 有电话记录`,
        accent: 'from-emerald-500/20 to-emerald-500/0',
      },
      {
        title: '学历信息完整度',
        value: Math.round((degreeFilled / total) * 100),
        desc: `${degreeFilled}/${total} 有学历`,
        accent: 'from-blue-500/20 to-blue-500/0',
      },
      {
        title: '入职时间覆盖度',
        value: Math.round((joinDateFilled / total) * 100),
        desc: `${joinDateFilled}/${total} 有入职日期`,
        accent: 'from-amber-500/20 to-amber-500/0',
      },
    ];
  }, [employees]);

  // Local heuristic insights for a smarter-looking analysis UI
  const localInsights = useMemo(() => {
    if (!employees.length) return [];

    const deptCounts = employees.reduce<Record<string, number>>((acc, emp) => {
      const name = departments.find(d => String(d.Departmentid) === String(emp.Departmentid))?.departmentname || '未知部门';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    const sortedDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
    const topDept = sortedDept[0];

    const genderCounts = employees.reduce<Record<string, number>>((acc, emp) => {
      const g = emp.P_emp_sex || '未知';
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {});
    const male = genderCounts['男'] || 0;
    const female = genderCounts['女'] || 0;
    const genderGap = Math.abs(male - female);

    const latestTrend = recruitmentTrend[recruitmentTrend.length - 1];
    const prevTrend = recruitmentTrend[recruitmentTrend.length - 2];
    const trendDelta = latestTrend && prevTrend ? latestTrend.count - prevTrend.count : 0;

    const lowQualityField = dataQualityMetrics.find(m => m.value < 70);

    const insights: Array<{ title: string; desc: string; tag: string }> = [];

    if (topDept) {
      insights.push({
        title: `${topDept[0]} 人才集中`,
        desc: `当前人数 ${topDept[1]}，可重点关注梯队与继任规划。`,
        tag: '编制结构'
      });
    }

    if (genderGap > Math.max(male, female) * 0.2) {
      insights.push({
        title: '性别结构存在偏差',
        desc: `男:女 = ${male}:${female}，建议在下轮招聘中平衡结构。`,
        tag: '多元平衡'
      });
    }

    if (latestTrend) {
      insights.push({
        title: '入职趋势即时提醒',
        desc: trendDelta >= 0
          ? `较上一期 +${trendDelta} 人，保持增长势头需同步招聘配额。`
          : `较上一期 ${trendDelta} 人，需评估部门招聘停滞原因。`,
        tag: '趋势监测'
      });
    }

    if (lowQualityField) {
      insights.push({
        title: `${lowQualityField.title} 质量偏低`,
        desc: `${lowQualityField.desc}，完善后分析可信度更高。`,
        tag: '数据治理'
      });
    }

    return insights.slice(0, 4);
  }, [employees, departments, recruitmentTrend, dataQualityMetrics]);

  const baselineStats = useMemo(() => {
    const total = employees.length;
    const deptTotal = new Set(employees.map(emp => String(emp.Departmentid))).size || departments.length;
    const lastTrend = recruitmentTrend[recruitmentTrend.length - 1];
    const recentHires = lastTrend?.count || 0;
    const missingPhones = employees.filter(e => !e.p_emp_phone).length;

    const tenureYears = employees
      .map(emp => {
        if (!emp.P_emp_workJoindt) return null;
        const joined = new Date(emp.P_emp_workJoindt);
        if (isNaN(joined.getTime())) return null;
        return (Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24 * 365);
      })
      .filter((n): n is number => n !== null);
    const avgTenure = tenureYears.length
      ? Math.round((tenureYears.reduce((a, b) => a + b, 0) / tenureYears.length) * 10) / 10
      : 0;

    return { total, deptTotal, recentHires, missingPhones, avgTenure };
  }, [employees, departments, recruitmentTrend]);

  const deptSnapshots = useMemo(() => {
    const map: Record<string, { count: number; male: number; female: number; degreeFilled: number }> = {};

    employees.forEach(emp => {
      const deptName = departments.find(d => String(d.Departmentid) === String(emp.Departmentid))?.departmentname || '未知部门';
      if (!map[deptName]) {
        map[deptName] = { count: 0, male: 0, female: 0, degreeFilled: 0 };
      }
      map[deptName].count += 1;
      if (emp.P_emp_sex === '男') map[deptName].male += 1;
      if (emp.P_emp_sex === '女') map[deptName].female += 1;
      if (emp.p_emp_degree) map[deptName].degreeFilled += 1;
    });

    return Object.entries(map)
      .map(([deptName, info]) => ({
        deptName,
        ...info,
        degreeCoverage: info.count ? Math.round((info.degreeFilled / info.count) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [employees, departments]);

  // --- CINEMATIC LOADING STATES ---
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [codeStream, setCodeStream] = useState(""); 
  const [processedCount, setProcessedCount] = useState(0); 
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
      // 1. Fetch Dynamic Schema (Dictionary)
      const schema = await dataService.getDataDictionary('p_employeetab');
      setDataSchema(schema);

      // 2. Fetch Real Data
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

      const safeEmps = Array.isArray(empData) ? empData : [];
      setEmployees(safeEmps);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      
      // Calculate Trends immediately
      const trendMap: Record<string, number> = {};
      safeEmps.forEach((e: Employee) => {
          if (e.P_emp_workJoindt) {
              const year = e.P_emp_workJoindt.split('T')[0].substring(0, 4); // Extract Year
              if (year && !isNaN(Number(year))) {
                  trendMap[year] = (trendMap[year] || 0) + 1;
              }
          }
      });
      // Convert to array and sort by year
      const trendArray = Object.entries(trendMap)
          .map(([year, count]) => ({ year, count }))
          .sort((a, b) => a.year.localeCompare(b.year))
          .slice(-5); // Last 5 years
      
      setRecruitmentTrend(trendArray);

      // If triggered by AI, start the dynamic analysis using the LOADED schema
      if (triggerParams?.mode === 'analysis') {
         setIsAnalysisOpen(true);
         // Pass the schema explicitly to ensure it's available
         setTimeout(() => {
             generateDynamicAnalysis(
                 triggerParams.query, 
                 safeEmps, 
                 Array.isArray(deptData) ? deptData : [],
                 schema,
                 trendArray
             );
         }, 500);
      }

    } catch (err: any) {
      console.error(err);
      setError(`数据加载失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- AI Dynamic Logic ---
  const generateDynamicAnalysis = async (
      userQuery: string, 
      currentEmployees: Employee[], 
      currentDepts: Department[],
      currentSchema?: Record<string, string>, // Optional injection for initial load
      trendData?: {year: string, count: number}[]
  ) => {
      setIsAiGenerating(true);
      setAiReportConfig(null);
      setTerminalLines([]);
      setCodeStream("");
      setProcessedCount(0);

      const activeSchema = currentSchema || dataSchema;

      // --- 1. Start Visual "Data Ingestion" Counter ---
      let currentCount = 0;
      const targetCount = currentEmployees.length || 150; 
      
      const ingestionInterval = setInterval(() => {
          if (currentCount < targetCount) {
             const step = Math.ceil((targetCount - currentCount) / 10);
             currentCount += Math.max(1, step);
             if (currentCount > targetCount) currentCount = targetCount;
             setProcessedCount(currentCount);
          }
      }, 50);

      // --- 2. "High-End" Technical Logs (Chinese) ---
      const technicalPhrases = [
          "正在解析数据字典元数据 (Schema Parsing)...",
          "建立高维向量索引 (Vector Indexing)...",
          "检测数据异常值与离群点 (Outlier Detection)...",
          "计算部门人效比 (Efficiency Ratio)...",
          "预测人才流失概率 (Churn Prediction)...",
          "加载阿里云 Qwen-Max 专家模型权重...",
          "生成战略决策建议 (Strategic Output)...",
          "执行多维交叉分析 (Cross-Tabulation)...",
          "构建风险评估矩阵...",
          "启用实时决策引擎..."
      ];
      
      const keepAliveInterval = setInterval(() => {
          if (Math.random() > 0.6) {
              const phrase = technicalPhrases[Math.floor(Math.random() * technicalPhrases.length)];
              // Add a random hex address for "Matrix" feel
              const hexAddr = `0x${Math.floor(Math.random()*16777215).toString(16).toUpperCase().padStart(6, '0')}`;
              setTerminalLines(prev => {
                  const newLogs = [...prev, `[KERNEL][${hexAddr}] ${phrase}`];
                  return newLogs.slice(-8); 
              });
          }
      }, 600);

      setTerminalLines(prev => [...prev, `[SYSTEM] 初始化量子加密通道 (Aliyun-Qwen-Max)...`]);
      
      const schemaKeys = Object.keys(activeSchema).length > 0 
          ? JSON.stringify(activeSchema) 
          : "Schema loading...";

      setTerminalLines(prev => [...prev, `[DATA] 成功加载 Schema 定义: ${Object.keys(activeSchema).length} 个字段映射.`]);

      try {
        const deptMappingSample = currentDepts.slice(0, 15).map(d => `${d.Departmentid}:${d.departmentname}`).join(",");
        const trendString = trendData ? JSON.stringify(trendData) : "No trend data";

        const systemPrompt = `
Context: HR Dashboard Data for a professional enterprise.
Data Schema: ${schemaKeys}.
Dept Mapping: ${deptMappingSample}.
Recruitment Trend (Year: Count): ${trendString}.

Query: "${userQuery}"

Task: Act as a Chief Data Scientist. Analyze the data deeply.
CRITICAL: 
1. Correlate metrics (e.g. "Does High Degree count in Dept X explain low recruitment?").
2. For "insight", give a specific 1-sentence analysis for that specific chart.
3. For the Bar Chart, ensure you analyze distinct values properly.

Return JSON Format:
{
  "summary": "Deep executive summary (Chinese). Mention specific departments or metrics. Be professional.",
  "charts": [
    { 
      "id": "c1", 
      "type": "stat|pie|bar", 
      "title": "Label", 
      "field": "column_name", 
      "operation": "count|distinct",
      "insight": "Specific analysis of this chart's data (e.g. '研发部高学历人才集中，建议关注留存')"
    }
  ],
  "risks": [
    { "title": "Short Risk Title", "level": "high|medium", "desc": "Detailed explanation based on data." }
  ],
  "suggestions": [
     { "title": "Action Title", "action": "Specific actionable advice.", "priority": "P0|P1" }
  ],
  "prediction": "Predict future based on the provided Recruitment Trend data. (e.g. '基于2023-2024年数据，招聘放缓...')"
}`;
        
        let fullResponse = "";
        
        await aliyunService.chatStream([{ role: 'system', content: systemPrompt }], (chunk) => {
            fullResponse += chunk;
            setCodeStream(prev => prev + chunk);
        });

        if (!fullResponse) throw new Error("Empty response from AI Gateway.");

        setTerminalLines(prev => [...prev, `[SUCCESS] 接收到结构化 Payload. 启动全息渲染引擎...`]);

        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const config = JSON.parse(jsonMatch[0]);
            await new Promise(r => setTimeout(r, 800)); // Delay for dramatic effect
            setAiReportConfig(config);
        } else {
            throw new Error("Invalid JSON signature in response.");
        }

      } catch (e: any) {
          console.error("AI Gen Error", e);
          setTerminalLines(prev => [...prev, `[ERROR] ${e.message}`]);
          
          const fallbackConfig: AIReport = {
              summary: "云端连接不稳定，已自动切换至本地离线分析模式。",
              charts: [
                  { id: 'fb1', type: 'stat', title: '总员工数', field: 'P_emp_no', operation: 'count', insight: '数据总览' },
                  { id: 'fb2', type: 'pie', title: '性别分布', field: 'P_emp_sex', insight: '性别比例相对均衡' },
                  { id: 'fb3', type: 'bar', title: '部门分布', field: 'Departmentid', insight: '核心部门人数占比较高' }
              ],
              risks: [{ title: "数据同步延迟", level: "low", desc: "本地数据可能非最新版本。" }],
              suggestions: [{ title: "检查网络", action: "请确认服务器连接状态。" }],
              prediction: "无法预测趋势 (离线模式)"
          };
          setTimeout(() => setAiReportConfig(fallbackConfig), 2000);

      } finally {
          clearInterval(ingestionInterval);
          clearInterval(keepAliveInterval);
          setProcessedCount(targetCount); 
          setIsAiGenerating(false);
      }
  };

  useEffect(() => {
      if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      if (codeContainerRef.current) codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
  }, [terminalLines, codeStream]);

  useEffect(() => {
    const shouldAnalyze = aiParams?.mode === 'analysis';
    loadData(aiParams);
  }, [aiParams]);

  // --- Data Aggregation ---
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

  const runPresetAnalysis = (query: string) => {
    setIsAnalysisOpen(true);
    generateDynamicAnalysis(query, employees, departments, dataSchema, recruitmentTrend);
  };

  const deptOptions = [{ value: '', label: '所有部门' }, ...departments.map(d => ({ value: d.Departmentid, label: d.departmentname }))];
  const editDeptOptions = departments.map(d => ({ value: d.Departmentid, label: d.departmentname }));
  const statusOptions = [{ value: '正式', label: '正式员工' }, { value: '试用', label: '试用期' }, { value: '离职', label: '已离职' }];

  // Visualization Colors
  const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];

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
                  onClick={() => setIsSchemaOpen(true)} 
                  className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-all border border-white/10"
                  title="查看数据字典 (AI 知识库)"
               >
                  <TableProperties size={14} /> 字段字典
               </button>

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

         {/* 4. NEW: Schema Reference Modal */}
         {isSchemaOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setIsSchemaOpen(false)} />
               <div className="relative w-full max-w-lg bg-[#0F1629] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                           <TableProperties size={18} />
                        </div>
                        <div>
                           <h3 className="font-bold text-white text-base">数据字典 (AI 知识库)</h3>
                           <p className="text-xs text-slate-400">AI 已自动学习以下字段定义</p>
                        </div>
                     </div>
                     <button onClick={() => setIsSchemaOpen(false)} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"><X size={18}/></button>
                  </div>
                  
                  <div className="max-h-[60vh] overflow-y-auto">
                    {Object.keys(dataSchema).length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-sm">
                           <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50"/>
                           正在从云端加载数据定义...
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                           <thead className="bg-black/20 text-xs text-slate-500 uppercase font-medium">
                              <tr>
                                 <th className="px-6 py-3 border-b border-white/5">数据库列名</th>
                                 <th className="px-6 py-3 border-b border-white/5">业务含义</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-white/5 text-sm">
                              {Object.entries(dataSchema).map(([col, desc]) => (
                                 <tr key={col} className="hover:bg-white/[0.02]">
                                    <td className="px-6 py-3 font-mono text-indigo-300">{col}</td>
                                    <td className="px-6 py-3 text-slate-300">{desc}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                    )}
                  </div>
                  
                  <div className="p-4 border-t border-white/5 bg-black/20 text-xs text-slate-500 flex items-center gap-2">
                     <Sparkles size={12} className="text-blue-400" />
                     <span>您可以使用自然语言直接询问这些字段，例如：“分析一下学历分布”。</span>
                  </div>
               </div>
            </div>
         )}

         {/* 5. DYNAMIC BI Dashboard (Analysis Mode) - ADVANCED BENTO GRID UPGRADE */}
         {isAnalysisOpen && (
            <div className="absolute inset-0 z-50 bg-[#020617] flex flex-col animate-in slide-in-from-bottom-10 duration-500">
               
               {/* Grid Background Effect */}
               <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/50 to-[#020617] pointer-events-none"></div>

               {/* Header */}
               <div className="h-20 px-8 border-b border-white/10 flex items-center justify-between bg-white/[0.01] relative z-10">
                  <div className="flex items-center gap-4">
                     <div className="relative group">
                        <div className="absolute -inset-2 bg-indigo-500/20 rounded-full blur-xl group-hover:bg-indigo-500/40 transition-all"></div>
                        <div className="relative p-3 rounded-xl bg-[#0F1629] border border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                            <BrainCircuit size={24} className={isAiGenerating ? "animate-pulse" : ""} />
                        </div>
                     </div>
                     <div>
                        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                           AI 智能决策中枢
                           <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">QWEN-MAX</span>
                        </h2>
                        <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-1">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                           {isAiGenerating ? "PERFORMING DEEP ANALYSIS..." : (aiParams?.query || "实时分析会话")}
                        </p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                     {!isAiGenerating && (
                       <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
                          <Share2 size={14} /> 导出报表
                       </button>
                     )}
                     <button onClick={() => setIsAnalysisOpen(false)} className="p-3 rounded-full bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-slate-400 transition-all border border-white/5 hover:border-red-500/20">
                        <X size={20} />
                     </button>
                  </div>
               </div>

               {/* Content */}
               <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10 custom-scrollbar">
                  
                  {isAiGenerating ? (
                      <div className="h-full flex flex-col items-center justify-center p-4">
                         {/* SCI-FI LOADING TERMINAL */}
                         <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* Left: Terminal Log */}
                            <div className="col-span-1 bg-black/80 border border-emerald-500/30 rounded-xl shadow-[0_0_50px_rgba(16,185,129,0.05)] overflow-hidden font-mono text-xs relative h-96 flex flex-col group">
                                <div className="absolute top-0 inset-x-0 h-[1px] bg-emerald-500/50 shadow-[0_0_10px_#10b981]"></div>
                                <div className="bg-emerald-950/30 px-4 py-3 border-b border-emerald-500/20 flex items-center justify-between">
                                    <span className="text-emerald-400 flex items-center gap-2 font-bold tracking-wider">
                                        <Terminal size={14} /> SYSTEM_KERNEL_LOG
                                    </span>
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500/20"></div>
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
                                    </div>
                                </div>
                                <div ref={logContainerRef} className="flex-1 overflow-y-auto p-5 text-emerald-500/90 space-y-1.5 custom-scrollbar font-mono leading-relaxed">
                                    {terminalLines.map((line, i) => (
                                       <div key={i} className="pl-2 border-l-2 border-emerald-500/20 hover:border-emerald-400/80 hover:bg-emerald-500/5 transition-colors">
                                           <span className="opacity-40 mr-3 text-[10px]">{new Date().toLocaleTimeString()}</span>
                                           {line}
                                       </div>
                                    ))}
                                    <div className="animate-pulse text-emerald-400 pl-2">_</div>
                                </div>
                                {/* Scanning line effect */}
                                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent animate-[scan_3s_linear_infinite] opacity-50"></div>
                            </div>

                            {/* Right: Data Ingestion & Code Stream */}
                            <div className="col-span-1 space-y-6">
                                {/* 1. Data Ingestion Counter */}
                                <div className="bg-[#0F1629]/50 border border-blue-500/30 rounded-xl p-6 relative overflow-hidden backdrop-blur-md">
                                   <div className="flex justify-between items-end mb-4 relative z-10">
                                      <div className="flex flex-col">
                                         <span className="text-blue-400 font-mono text-xs mb-1 flex items-center gap-2"><Database size={12}/> DATA_INGESTION_RATE</span>
                                         <span className="text-white font-bold text-3xl font-mono tracking-tighter">
                                            {processedCount.toString().padStart(4, '0')} <span className="text-sm text-slate-500 font-normal">/ {employees.length || 150} rows</span>
                                         </span>
                                      </div>
                                      <Activity className="text-blue-500 animate-pulse" />
                                   </div>
                                   {/* Progress Bar */}
                                   <div className="w-full bg-blue-950/50 h-1.5 rounded-full overflow-hidden relative z-10">
                                      <div 
                                        className="h-full bg-blue-500 shadow-[0_0_15px_#3b82f6]" 
                                        style={{ width: `${Math.min(100, (processedCount / (employees.length || 150)) * 100)}%` }}
                                      ></div>
                                   </div>
                                   {/* Background Glow */}
                                   <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-blue-500/20 blur-[50px] rounded-full"></div>
                                </div>

                                {/* 2. Code Stream Window */}
                                <div className="bg-[#050505] border border-white/10 rounded-xl flex-1 h-60 flex flex-col overflow-hidden relative shadow-inner">
                                   <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                                      <span className="text-[10px] text-slate-400 flex items-center gap-2 uppercase tracking-wider">
                                         <Code2 size={12} /> Live_Payload_Stream
                                      </span>
                                      <Lock size={10} className="text-indigo-500"/>
                                   </div>
                                   <div ref={codeContainerRef} className="flex-1 p-4 overflow-y-auto font-mono text-[11px] text-indigo-300/90 leading-relaxed opacity-90">
                                      <pre className="whitespace-pre-wrap break-all">
                                         {codeStream || <span className="animate-pulse text-slate-600">Waiting for stream...</span>}
                                         <span className="inline-block w-2 h-4 bg-indigo-500 ml-1 animate-pulse align-middle"></span>
                                      </pre>
                                   </div>
                                </div>
                            </div>
                         </div>
                      </div>
                  ) : aiReportConfig ? (
                      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">

                        {/* SMART ACTIONS BAR */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                           <div className="lg:col-span-2 p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-2 text-xs font-bold text-indigo-200">
                                 <Sparkles size={14}/> 智能问法推荐
                              </div>
                              {smartQueryPresets.map(preset => (
                                 <button
                                   key={preset.label}
                                   onClick={() => runPresetAnalysis(preset.query)}
                                   className="px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-100 border border-indigo-500/30 text-[11px] hover:bg-indigo-500/20 transition-colors"
                                 >
                                    {preset.label}
                                 </button>
                              ))}
                           </div>
                           <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                              <Radar className="text-emerald-400" size={18}/>
                              <div className="text-xs text-slate-300 leading-relaxed">
                                 实时调优：点击推荐问法可快速生成深度分析，结合数据字典自动匹配字段，提升“智能感”。
                              </div>
                           </div>
                        </div>

                        {/* 1. EXECUTIVE SUMMARY (TYPEWRITER EFFECT) */}
                        <div className="relative p-8 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-900 border border-white/10 overflow-hidden shadow-2xl">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                            <div className="relative z-10 flex gap-6">
                               <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 h-fit shrink-0">
                                  <Sparkles size={32} />
                               </div>
                               <div className="flex-1">
                                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                     <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                                     Executive Insight
                                  </h3>
                                  <p className="text-white text-lg leading-relaxed font-light font-sans tracking-wide">
                                    {aiReportConfig.summary}
                                  </p>
                              </div>
                           </div>
                        </div>

                        {/* 1.25 LOCAL HEURISTIC INSIGHTS */}
                        {localInsights.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {localInsights.map(item => (
                              <div key={item.title} className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-[11px] text-indigo-200 uppercase tracking-widest">
                                  <Radar size={14} />
                                  本地即时洞察
                                </div>
                                <div className="text-sm text-white font-bold flex items-center gap-2">
                                  <span className="px-2 py-1 rounded-full bg-indigo-500/10 text-[11px] text-indigo-200 border border-indigo-500/30">{item.tag}</span>
                                  {item.title}
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 1.5 DATA QUALITY SNAPSHOT */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           {dataQualityMetrics.map(metric => (
                              <div key={metric.title} className="p-4 rounded-2xl bg-[#0F1629]/60 border border-white/10 relative overflow-hidden">
                                 <div className={`absolute inset-0 bg-gradient-to-br ${metric.accent} blur-3xl opacity-30`}></div>
                                 <div className="relative z-10 space-y-2">
                                    <div className="text-xs text-slate-400 flex items-center gap-2">
                                       <ShieldAlert size={14} className="text-indigo-400"/>
                                       数据质量雷达
                                    </div>
                                    <div className="text-sm font-bold text-white">{metric.title}</div>
                                    <div className="text-3xl font-mono text-indigo-300 flex items-baseline gap-2">
                                       {metric.value}%
                                       <span className="text-[10px] text-slate-400">{metric.desc}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">用于判断分析可信度，建议优先补齐低覆盖字段。</p>
                                 </div>
                              </div>
                           ))}
                        </div>

                        {/* 2. BENTO GRID LAYOUT */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* COL 1: Key Metrics & Trend Prediction */}
                            <div className="lg:col-span-1 space-y-6">
                                {/* Simulated Trend Card */}
                                <div className="p-6 rounded-3xl bg-[#0F1629]/60 backdrop-blur-xl border border-white/5 relative overflow-hidden group">
                                   <div className="flex items-center justify-between mb-4">
                                      <h4 className="text-sm font-bold text-white flex items-center gap-2"><LineChart size={16} /> 趋势预测 (Trend)</h4>
                                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">AI 预测</span>
                                   </div>
                                   {/* Real trend data visualization */}
                                   <div className="h-32 flex items-end gap-1 mb-4">
                                      {recruitmentTrend.length > 0 ? (
                                         recruitmentTrend.map((t, i) => {
                                             const max = Math.max(...recruitmentTrend.map(x => x.count));
                                             const h = (t.count / max) * 100;
                                             return (
                                                 <div key={t.year} className="flex-1 flex flex-col items-center justify-end group/bar gap-2" style={{ height: '100%' }}>
                                                     <div className="w-full bg-gradient-to-t from-emerald-500/20 to-emerald-500/80 rounded-t-sm relative transition-all duration-500" style={{ height: `${h}%` }}>
                                                        <div className="absolute top-0 w-full h-[2px] bg-emerald-400 shadow-[0_0_10px_#34d399]"></div>
                                                     </div>
                                                     <span className="text-[10px] text-slate-500">{t.year}</span>
                                                 </div>
                                             );
                                         })
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">暂无趋势数据</div>
                                      )}
                                   </div>
                                   <p className="text-xs text-slate-300 leading-relaxed border-t border-white/5 pt-3">
                                      {aiReportConfig.prediction || "AI 模型分析显示，下季度各部门人才密度将呈现稳步上升趋势。"}
                                   </p>
                                </div>

                                {/* Risk Radar List */}
                                <div className="p-6 rounded-3xl bg-[#0F1629]/60 backdrop-blur-xl border border-white/5 relative">
                                   <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><ShieldAlert size={16} className="text-amber-500" /> 风险预警 (Risks)</h4>
                                   <div className="space-y-3">
                                      {aiReportConfig.risks?.slice(0, 3).map((risk, i) => (
                                         <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-colors">
                                            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                               <div className="text-xs font-bold text-amber-200">{risk.title}</div>
                                               <div className="text-[10px] text-amber-500/80 mt-1">{risk.desc}</div>
                                            </div>
                                         </div>
                                      )) || <div className="text-xs text-slate-500">暂无高风险项</div>}
                                   </div>
                                </div>
                            </div>

                            {/* COL 2: Main Charts (Pie/Donut) */}
                            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {aiReportConfig.charts
                                   .filter(c => c.type !== 'stat')
                                   .slice(0, 4) // Show max 4 charts
                                   .map((chart, idx) => {
                                       const data = getAggregatedData(chart) as {name: string, value: number}[];
                                       const total = data.reduce((acc, curr) => acc + curr.value, 0);

                                       return (
                                          <div key={chart.id} style={{ animationDelay: `${idx * 150}ms` }} className="bg-[#1E293B]/40 backdrop-blur-md p-6 rounded-3xl border border-white/5 flex flex-col animate-in zoom-in-95 relative overflow-hidden group">
                                              {/* Hover Glow */}
                                              <div className="absolute -inset-px bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                                              <div className="relative z-10 mb-6 flex items-center justify-between">
                                                 <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                                     {chart.type === 'pie' ? <PieChart size={16} className="text-purple-400"/> : <BarChart3 size={16} className="text-blue-400"/>}
                                                     {chart.title}
                                                 </h3>
                                              </div>

                                              <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
                                                 {chart.type === 'pie' ? (
                                                     // --- CONIC GRADIENT DONUT ---
                                                     <div className="flex items-center gap-6 w-full justify-center">
                                                         <div className="relative w-32 h-32 shrink-0">
                                                             <div 
                                                                 className="w-full h-full rounded-full animate-[spin_3s_ease-out]"
                                                                 style={{
                                                                     background: `conic-gradient(
                                                                         ${data.map((d, i) => {
                                                                             const start = data.slice(0, i).reduce((acc, cur) => acc + cur.value, 0) / total * 100;
                                                                             const end = start + (d.value / total * 100);
                                                                             const color = CHART_COLORS[i % CHART_COLORS.length];
                                                                             return `${color} ${start}% ${end}%`;
                                                                         }).join(', ')}
                                                                     )`,
                                                                     mask: 'radial-gradient(transparent 58%, black 59%)',
                                                                     WebkitMask: 'radial-gradient(transparent 58%, black 59%)'
                                                                 }}
                                                             ></div>
                                                             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                                 <span className="text-lg font-bold text-white">{total}</span>
                                                             </div>
                                                         </div>
                                                         <div className="flex flex-col gap-1.5 min-w-[100px]">
                                                             {data.slice(0, 4).map((item, i) => (
                                                                 <div key={i} className="flex items-center justify-between text-[11px]">
                                                                     <div className="flex items-center gap-2">
                                                                         <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}></div>
                                                                         <span className="text-slate-300 truncate max-w-[60px]">{item.name}</span>
                                                                     </div>
                                                                     <span className="font-mono text-slate-500">{Math.round(item.value / total * 100)}%</span>
                                                                 </div>
                                                             ))}
                                                         </div>
                                                     </div>
                                                 ) : (
                                                     // --- MULTI-COLOR BAR CHART ---
                                                     <div className="w-full space-y-3">
                                                         {data.slice(0, 5).map((item, i) => {
                                                             const color = CHART_COLORS[i % CHART_COLORS.length];
                                                             return (
                                                                 <div key={item.name} className="group/bar">
                                                                     <div className="flex justify-between text-[10px] mb-1">
                                                                         <span className="text-slate-300">{item.name}</span>
                                                                         <span className="text-white font-mono">{item.value}</span>
                                                                     </div>
                                                                     <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                                                                         <div 
                                                                             style={{ 
                                                                                 width: `${total > 0 ? (item.value / data[0].value) * 100 : 0}%`, 
                                                                                 transitionDelay: `${i * 100}ms`,
                                                                                 backgroundColor: color 
                                                                             }}
                                                                             className="h-full relative transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                                                                         ></div>
                                                                     </div>
                                                                 </div>
                                                             );
                                                         })}
                                                     </div>
                                                 )}
                                              </div>

                                              {/* AI Insight Footer */}
                                              {chart.insight && (
                                                  <div className="mt-4 pt-3 border-t border-white/5 flex gap-2 items-start">
                                                      <Briefcase size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                                                      <p className="text-[10px] text-indigo-200/80 leading-relaxed">{chart.insight}</p>
                                                  </div>
                                              )}
                                          </div>
                                       )
                                   })
                                }
                                
                                {/* Strategic Actions Card (Replaces extra charts) */}
                                <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-indigo-500/20 flex flex-col relative overflow-hidden">
                                   <div className="absolute top-0 right-0 p-4 opacity-10"><Lightbulb size={64} className="text-white"/></div>
                                   <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4 relative z-10"><Target size={16} className="text-indigo-400"/> 决策建议 (Actions)</h3>
                                   <div className="flex-1 space-y-3 relative z-10">
                                      {aiReportConfig.suggestions?.slice(0, 3).map((sugg, i) => (
                                         <div key={i} className="flex gap-3 group cursor-pointer">
                                            <div className="mt-1 w-4 h-4 rounded-full border border-indigo-400/50 flex items-center justify-center shrink-0 group-hover:bg-indigo-500 transition-colors">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover:bg-white"></div>
                                            </div>
                                            <div>
                                               <div className="flex items-center gap-2">
                                                   <div className="text-xs font-bold text-indigo-100 group-hover:text-white transition-colors">{sugg.title}</div>
                                                   {sugg.priority && <span className="text-[9px] px-1.5 py-0.5 bg-indigo-500/20 rounded text-indigo-300 border border-indigo-500/30">{sugg.priority}</span>}
                                               </div>
                                               <p className="text-[10px] text-indigo-300/80 mt-1 leading-relaxed">{sugg.action}</p>
                                            </div>
                                         </div>
                                      ))}
                                   </div>
                                </div>

                            </div>
                        </div>

                      </div>
                  ) : (
                      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-r from-[#0b1224] via-[#111c33] to-[#0d1a2b] border border-white/10 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.8)]">
                           <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(79,70,229,0.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.18),transparent_30%)]" />
                           <div className="relative flex items-start justify-between gap-4 flex-wrap">
                              <div className="space-y-2">
                                 <div className="flex items-center gap-2 text-sm text-indigo-200 font-semibold">
                                    <Sparkles size={16}/> 本地即时洞察
                                 </div>
                                 <p className="text-white text-lg leading-relaxed max-w-3xl">
                                    还未连接云端也能秒级看懂数据：我们根据现有字段生成了离线分析、数据质量和部门画像，帮助你快速找到问题入口。
                                 </p>
                              </div>
                              <button
                                onClick={() => generateDynamicAnalysis(aiParams?.query || '综合人力画像', employees, departments, dataSchema, recruitmentTrend)}
                                className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/60 to-blue-500/60 border border-indigo-400/40 text-white text-xs hover:from-indigo-500 hover:to-blue-500 transition-all shadow-lg shadow-indigo-900/40 flex items-center gap-2"
                              >
                                 <RefreshCw size={14}/> 一键云端深析
                              </button>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                              {[{ label: '在册员工', value: baselineStats.total, hint: '当前总样本量', color: 'from-emerald-500/20 via-emerald-500/10 to-emerald-500/5' },
                                { label: '覆盖部门', value: baselineStats.deptTotal, hint: '涉及的部门数', color: 'from-blue-500/20 via-blue-500/10 to-blue-500/5' },
                                { label: '近一年入职', value: baselineStats.recentHires, hint: '最新年份的新增', color: 'from-indigo-500/20 via-indigo-500/10 to-indigo-500/5' },
                                { label: '电话缺失', value: baselineStats.missingPhones, hint: '待补充联系方式', color: 'from-amber-500/20 via-amber-500/10 to-amber-500/5' }
                              ].map(item => (
                                <div key={item.label} className={`p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm relative overflow-hidden`}> 
                                   <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-60`} />
                                   <div className="relative">
                                     <div className="text-xs text-slate-400 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
                                        {item.label}
                                     </div>
                                     <div className="text-2xl font-bold text-white mt-1">{item.value}</div>
                                     <div className="text-[11px] text-slate-300/80">{item.hint}</div>
                                   </div>
                                </div>
                              ))}
                           </div>

                           <div className="relative mt-4 text-xs text-slate-300 flex items-center gap-2">
                              <Activity size={12}/> 平均任职时长约 <span className="text-indigo-100 font-semibold">{baselineStats.avgTenure} 年</span>，可对比各部门梯队稳定性。
                           </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                           <div className="lg:col-span-2 p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                 <BarChart3 size={16} className="text-blue-400"/> 部门画像快照
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 {deptSnapshots.map(dept => (
                                    <div key={dept.deptName} className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-2">
                                       <div className="flex items-center justify-between">
                                          <div className="text-white font-semibold">{dept.deptName}</div>
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-200">{dept.count} 人</span>
                                       </div>
                                       <div className="text-[11px] text-slate-400">男 {dept.male} / 女 {dept.female}</div>
                                       <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                          <Database size={12} className="text-indigo-400"/> 学历完备度
                                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                             <div className="h-full bg-indigo-500" style={{ width: `${dept.degreeCoverage}%` }}></div>
                                          </div>
                                          <span className="text-indigo-200 font-mono">{dept.degreeCoverage}%</span>
                                       </div>
                                    </div>
                                 ))}
                                 {!deptSnapshots.length && (
                                    <div className="col-span-full text-xs text-slate-500">暂无部门画像数据，请先加载员工信息。</div>
                                 )}
                              </div>
                           </div>

                           <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                 <ShieldAlert size={16} className="text-amber-400"/> 数据质量速览
                              </div>
                              <div className="space-y-3">
                                 {dataQualityMetrics.map(metric => (
                                    <div key={metric.title} className="p-3 rounded-xl bg-black/30 border border-white/5">
                                       <div className="flex items-center justify-between">
                                          <div className="text-sm text-white">{metric.title}</div>
                                          <span className="text-[11px] text-indigo-200 font-mono">{metric.value}%</span>
                                       </div>
                                       <div className="text-[11px] text-slate-500 mt-1">{metric.desc}</div>
                                       <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                                          <div className={`h-full bg-gradient-to-r from-indigo-500 to-blue-500`} style={{ width: `${metric.value}%` }}></div>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>

                        {localInsights.length > 0 && (
                           <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-3">
                              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                 <Sparkles size={16} className="text-emerald-400"/> 本地启发式洞察
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 {localInsights.map(item => (
                                    <div key={item.title} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                       <div className="flex items-center justify-between mb-2">
                                          <div className="text-white font-semibold">{item.title}</div>
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">{item.tag}</span>
                                       </div>
                                       <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}
                      </div>
                  )}
               </div>
            </div>
         )}
    </div>
  );
};

export default ToolsPlatform;