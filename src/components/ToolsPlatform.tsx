
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ArrowLeft, Search, Loader2, RefreshCw, 
  Copy, Eye, EyeOff, Edit2, X, 
  User as UserIcon, Building2, Save, Filter,
  ChevronDown, Check
} from 'lucide-react';

// --- 类型定义 ---
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
}

// --- 自定义下拉框组件 (Custom Select) ---
interface Option {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: Option[];
  placeholder?: string;
  icon?: React.ElementType;
  className?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, placeholder = "请选择", icon: Icon, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find(opt => String(opt.value) === String(value))?.label || placeholder;

  // 点击外部关闭
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

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 overflow-hidden bg-[#1E293B] border border-white/10 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
           <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent py-1">
              {options.length > 0 ? (
                options.map((opt) => (
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

// --- 主组件 ---

const ToolsPlatform: React.FC<ToolsPlatformProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // 交互状态
  const [visiblePhones, setVisiblePhones] = useState<Set<string>>(new Set());
  
  // 弹窗编辑状态
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
  
  // 筛选条件 (极简：仅搜索 + 部门)
  const [keyword, setKeyword] = useState('');
  const [selectedDept, setSelectedDept] = useState<string | number>('');

  // 获取 API 配置
  const getApiConfig = async () => {
    const { data: configData, error: configError } = await supabase
        .from('app_configs')
        .select('api_url, api_token')
        .eq('config_name', 'local_sql_server')
        .single();

    if (configError || !configData?.api_url) {
      throw new Error("配置缺失 (local_sql_server)");
    }

    let { api_url, api_token } = configData;
    api_url = api_url.trim();
    if (api_url.endsWith('/')) api_url = api_url.slice(0, -1);
    if (!api_url.endsWith('/api/sql/execute')) api_url += '/api/sql/execute';

    return { api_url, api_token };
  };

  // 加载数据
  const loadData = async () => {
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

    } catch (err: any) {
      console.error(err);
      setError(`数据加载失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- 逻辑处理 ---
  const togglePhoneVisibility = (id: string) => {
    const newSet = new Set(visiblePhones);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setVisiblePhones(newSet);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openEditor = (emp: Employee) => {
    setCurrentEmp({ ...emp });
    setIsEditorOpen(true);
  };

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
      const matchKeyword = !keyword || 
        emp.employeename?.includes(keyword) || 
        emp.P_emp_no?.includes(keyword);
      const matchDept = !selectedDept || String(emp.Departmentid) === String(selectedDept);
      return matchKeyword && matchDept;
    });
  }, [employees, keyword, selectedDept]);

  const getDeptName = (id: string | number) => {
    return departments.find(d => String(d.Departmentid) === String(id))?.departmentname || `${id}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '正式': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case '试用': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case '离职': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  // 生成选项数据
  const deptOptions = [
    { value: '', label: '所有部门' },
    ...departments.map(d => ({ value: d.Departmentid, label: d.departmentname }))
  ];

  const editDeptOptions = departments.map(d => ({ value: d.Departmentid, label: d.departmentname }));
  
  const statusOptions = [
    { value: '正式', label: '正式员工' },
    { value: '试用', label: '试用期' },
    { value: '离职', label: '已离职' },
  ];

  return (
    // 大容器，保持在页面内，不覆盖全屏
    <div className="w-full h-[85vh] max-w-[1600px] mx-auto bg-[#0F1629]/80 backdrop-blur-2xl border border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500">
         
         {/* 1. 顶部栏 (简单清爽) */}
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
               {/* 自定义部门筛选 */}
               <div className="w-[160px]">
                  <CustomSelect 
                    icon={Filter}
                    value={selectedDept}
                    onChange={(val) => setSelectedDept(val)}
                    options={deptOptions}
                    placeholder="部门筛选"
                  />
               </div>

               {/* 搜索 */}
               <div className="relative group w-64">
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

               <button 
                  onClick={loadData}
                  disabled={loading}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="刷新数据"
               >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
               </button>
            </div>
         </div>

         {/* 2. 表格区域 */}
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
                             <tr 
                                key={row.P_emp_no} 
                                onDoubleClick={() => openEditor(row)}
                                className="group hover:bg-white/[0.03] transition-colors cursor-pointer"
                             >
                                <td className="sticky left-0 z-10 px-6 py-3 bg-[#0F1629] group-hover:bg-[#131b2e] border-r border-white/5 transition-colors">
                                   <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                                         {row.webbmp ? (
                                             <img src={row.webbmp} alt={row.employeename} className="w-full h-full object-cover" />
                                         ) : (
                                             <span className="text-xs font-bold text-slate-400">{row.employeename?.[0] || 'U'}</span>
                                         )}
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
                                <td className="px-6 py-3 text-slate-300">
                                   {getDeptName(row.Departmentid)}
                                </td>
                                <td className="px-6 py-3">
                                   <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${getStatusColor(row.P_emp_Status)}`}>
                                      {row.P_emp_Status}
                                   </span>
                                </td>
                                <td className="px-6 py-3 text-slate-400 font-mono text-xs">
                                   <div className="flex items-center gap-2">
                                      {isPhoneVisible ? row.p_emp_phone : (row.p_emp_phone ? row.p_emp_phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '-')}
                                      <button onClick={(e) => { e.stopPropagation(); togglePhoneVisibility(row.P_emp_no); }} className="p-1 hover:text-white text-slate-600">
                                         {isPhoneVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                                      </button>
                                   </div>
                                </td>
                                <td className="px-6 py-3 text-slate-400 text-xs">
                                   {row.P_emp_workJoindt ? row.P_emp_workJoindt.split('T')[0] : '-'}
                                </td>
                                <td className="sticky right-0 z-10 px-6 py-3 bg-[#0F1629] group-hover:bg-[#131b2e] border-l border-white/5 text-right transition-colors">
                                   <button 
                                      onClick={() => openEditor(row)} 
                                      className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                                   >
                                      <Edit2 size={16} />
                                   </button>
                                </td>
                             </tr>
                          );
                      })
                  )}
               </tbody>
            </table>
         </div>

         {/* 3. 极简编辑弹窗 */}
         {isEditorOpen && currentEmp && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
               <div 
                  className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
                  onClick={() => setIsEditorOpen(false)}
               />
               
               <div className="relative w-full max-w-2xl bg-[#0F1629] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 overflow-hidden">
                           {currentEmp.webbmp ? (
                              <img src={currentEmp.webbmp} className="w-full h-full object-cover" />
                           ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">{currentEmp.employeename?.[0] || 'U'}</div>
                           )}
                        </div>
                        <div>
                           <h3 className="font-bold text-white text-base">编辑员工信息</h3>
                           <p className="text-xs text-slate-400">工号: {currentEmp.P_emp_no}</p>
                        </div>
                     </div>
                     <button onClick={() => setIsEditorOpen(false)} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"><X size={18}/></button>
                  </div>

                  {/* Form Body - Simple Grid */}
                  <div className="p-6 grid grid-cols-2 gap-x-6 gap-y-5">
                     <div className="col-span-1 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">姓名</label>
                        <input 
                           type="text" 
                           value={currentEmp.employeename}
                           onChange={e => setCurrentEmp({...currentEmp, employeename: e.target.value})}
                           className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                        />
                     </div>
                     <div className="col-span-1 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">联系电话</label>
                        <input 
                           type="text" 
                           value={currentEmp.p_emp_phone}
                           onChange={e => setCurrentEmp({...currentEmp, p_emp_phone: e.target.value})}
                           className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                        />
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
                        <input 
                           type="text" 
                           value={currentEmp.p_emp_degree}
                           onChange={e => setCurrentEmp({...currentEmp, p_emp_degree: e.target.value})}
                           className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                        />
                     </div>

                     <div className="col-span-1 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">所属部门</label>
                        <CustomSelect 
                           value={currentEmp.Departmentid}
                           onChange={val => setCurrentEmp({...currentEmp, Departmentid: val})}
                           options={editDeptOptions}
                           placeholder="选择部门"
                        />
                     </div>
                     <div className="col-span-1 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">员工状态</label>
                        <CustomSelect 
                           value={currentEmp.P_emp_Status}
                           onChange={val => setCurrentEmp({...currentEmp, P_emp_Status: String(val)})}
                           options={statusOptions}
                           placeholder="选择状态"
                        />
                     </div>
                     
                     <div className="col-span-2 space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">入职日期</label>
                        <input 
                           type="date" 
                           value={currentEmp.P_emp_workJoindt ? currentEmp.P_emp_workJoindt.split('T')[0] : ''}
                           onChange={e => setCurrentEmp({...currentEmp, P_emp_workJoindt: e.target.value})}
                           className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                        />
                     </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end gap-3">
                     <button 
                        onClick={() => setIsEditorOpen(false)}
                        className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                     >
                        取消
                     </button>
                     <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
                     >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        保存更改
                     </button>
                  </div>
               </div>
            </div>
         )}
    </div>
  );
};

export default ToolsPlatform;
