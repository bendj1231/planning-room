
import React, { useState, useEffect } from 'react';
import { BoardType, GraphicsQuality } from '../types';
import { BOARD_THEMES } from '../constants';
import { Settings, Plus, Upload, Clock, ChevronRight, FileText, ChevronDown, Monitor, Layout, ArrowRight } from 'lucide-react';

interface RecentProject {
  id: string;
  title: string;
  boardType: BoardType;
  lastModified: number;
  itemCount: number;
  data: any; // Storing full data for this demo to allow reloading
}

interface DashboardProps {
  quality: GraphicsQuality;
  onNewProject: () => void;
  onLoadProject: (data: any) => void;
  recentProjects: RecentProject[];
  onOpenSettings: () => void; // For graphics settings
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  quality, 
  onNewProject, 
  onLoadProject, 
  recentProjects,
  onOpenSettings
}) => {
  const [platformTheme, setPlatformTheme] = useState<BoardType>(BoardType.BLUEPRINT);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAnimateIn(true);
  }, []);

  const theme = BOARD_THEMES[platformTheme];
  const isLow = quality === 'LOW';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        onLoadProject(json);
      } catch (err) {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`relative w-full h-full flex items-center justify-center transition-all duration-700 ${animateIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
      
      {/* The Platform Board Background */}
      <div 
        className={`absolute inset-4 md:inset-12 rounded-3xl shadow-2xl overflow-hidden border-[12px] ${theme.border} ${theme.bg} transition-colors duration-500`}
        style={{
             boxShadow: isLow ? 'none' : 'inset 0 0 150px rgba(0,0,0,0.5), 0 30px 60px rgba(0,0,0,0.5)',
        }}
      >
         {/* Texture */}
         <div 
            className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply" 
            style={{ backgroundImage: theme.texture, backgroundSize: theme.textureSize || 'auto' }}
         />
         
         {/* Header Title */}
         <div className="absolute top-16 left-0 w-full text-center z-10">
             <div className="inline-block relative p-6 transform -rotate-1">
                 {!isLow && <div className="absolute inset-0 bg-white/5 backdrop-blur-sm rounded-lg shadow-lg -z-10 transform rotate-1"></div>}
                 <h1 className="font-marker text-6xl md:text-8xl text-white/90 drop-shadow-xl tracking-wider">
                    Planning Board
                 </h1>
                 <p className="font-mono text-white/50 tracking-[0.3em] uppercase mt-4 text-sm">Operation Command Center</p>
             </div>
         </div>

         {/* Center Controls */}
         <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-8">
             
             {/* Action Strips */}
             <div className="flex flex-col gap-4 w-full max-w-md perspective-1000">
                 
                 {/* Create New */}
                 <button 
                    onClick={onNewProject}
                    className="group relative h-20 bg-yellow-100 hover:bg-yellow-50 transition-all duration-300 transform hover:-translate-y-1 hover:scale-105 shadow-lg hover:shadow-2xl flex items-center px-6 overflow-hidden cursor-pointer"
                    style={{ 
                        clipPath: 'polygon(2% 0%, 98% 0%, 100% 100%, 0% 100%)',
                        animation: 'slideInLeft 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
                        opacity: 0,
                        animationDelay: '0.1s'
                    }}
                 >
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-yellow-400/50"></div>
                    <div className="w-12 h-12 rounded-full bg-yellow-400/20 flex items-center justify-center mr-6 group-hover:scale-110 transition-transform">
                        <Plus className="text-yellow-700" size={24} />
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="font-marker text-2xl text-slate-800">New Operation</span>
                        <span className="font-handwriting text-slate-500 text-lg">Start a fresh plan...</span>
                    </div>
                    <ArrowRight className="ml-auto text-slate-300 group-hover:text-slate-800 transition-colors" />
                 </button>

                 {/* Load Existing */}
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative h-20 bg-blue-50 hover:bg-white transition-all duration-300 transform hover:-translate-y-1 hover:scale-105 shadow-lg hover:shadow-2xl flex items-center px-6 overflow-hidden cursor-pointer"
                    style={{ 
                        clipPath: 'polygon(0% 0%, 100% 0%, 98% 100%, 2% 100%)',
                        animation: 'slideInRight 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
                        opacity: 0,
                        animationDelay: '0.2s'
                    }}
                 >
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-blue-400/50"></div>
                    <div className="w-12 h-12 rounded-full bg-blue-400/20 flex items-center justify-center mr-6 group-hover:scale-110 transition-transform">
                        <Upload className="text-blue-700" size={24} />
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="font-marker text-2xl text-slate-800">Load Archives</span>
                        <span className="font-handwriting text-slate-500 text-lg">Open .json file...</span>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".json" />
                 </button>

             </div>

             {/* Recent Projects List */}
             {recentProjects.length > 0 && (
                 <div className="w-full max-w-4xl mt-8">
                     <h3 className="text-white/40 font-mono uppercase tracking-widest text-center mb-6 text-sm">Recent Operations</h3>
                     <div className="flex flex-wrap justify-center gap-4">
                         {recentProjects.map((proj, i) => (
                             <button
                                key={proj.id}
                                onClick={() => onLoadProject(proj.data)}
                                className="group relative w-48 h-48 bg-[#fdfbf7] shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 hover:rotate-1 flex flex-col p-4 text-left overflow-hidden"
                                style={{
                                    animation: 'fadeInUp 0.5s ease-out forwards',
                                    opacity: 0,
                                    animationDelay: `${0.3 + (i * 0.1)}s`
                                }}
                             >
                                 <div className="absolute top-0 left-0 w-full h-8 bg-black/5 border-b border-black/5"></div>
                                 <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-800 shadow-sm z-10"></div>
                                 
                                 <div className="mt-4 flex-1">
                                     <h4 className="font-marker text-lg leading-tight text-slate-800 mb-2 line-clamp-2">{proj.title}</h4>
                                     <div className="flex items-center gap-1 text-xs text-slate-400 font-mono mb-1">
                                         <Layout size={10} />
                                         <span>{proj.itemCount} Items</span>
                                     </div>
                                     <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                                         <Clock size={10} />
                                         <span>{formatDate(proj.lastModified)}</span>
                                     </div>
                                 </div>
                                 <div className="mt-auto pt-2 border-t border-dashed border-slate-200 flex justify-between items-center">
                                     <span className="text-[10px] uppercase font-bold text-slate-300">{proj.boardType}</span>
                                     <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500" />
                                 </div>
                             </button>
                         ))}
                     </div>
                 </div>
             )}
         </div>

         {/* Dashboard Settings (Top Right) */}
         <div className="absolute top-8 right-8 z-50 flex flex-col items-end">
             <div className="flex gap-2">
                 {/* Graphics Settings */}
                 <button 
                    onClick={onOpenSettings}
                    className="w-10 h-10 bg-black/20 hover:bg-black/40 text-white/70 hover:text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
                    title="Graphics Configuration"
                 >
                    <Monitor size={20} />
                 </button>

                 {/* Theme Toggle */}
                 <button 
                    onClick={() => setShowThemeMenu(!showThemeMenu)}
                    className={`h-10 px-4 bg-black/20 hover:bg-black/40 text-white/70 hover:text-white rounded-full flex items-center justify-center gap-2 backdrop-blur-sm transition-all ${showThemeMenu ? 'bg-white/10 text-white' : ''}`}
                 >
                    <Settings size={20} />
                    <span className="font-bold text-sm">Platform Style</span>
                    <ChevronDown size={14} className={`transition-transform ${showThemeMenu ? 'rotate-180' : ''}`} />
                 </button>
             </div>

             {/* Theme Dropdown */}
             <div className={`mt-2 bg-zinc-900/95 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-xl flex flex-col gap-1 min-w-[200px] transition-all origin-top-right ${showThemeMenu ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                {Object.entries(BOARD_THEMES).map(([key, t]) => (
                    <button
                        key={key}
                        onClick={() => { setPlatformTheme(key as BoardType); setShowThemeMenu(false); }}
                        className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${platformTheme === key ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                    >
                        <span>{t.label}</span>
                        {platformTheme === key && <div className="w-2 h-2 rounded-full bg-emerald-400"></div>}
                    </button>
                ))}
             </div>
         </div>
         
         {/* Footer */}
         <div className="absolute bottom-6 w-full text-center">
             <span className="text-white/20 text-[10px] font-mono tracking-widest">SYSTEM V1.2 // READY FOR INPUT</span>
         </div>
      </div>

      <style>{`
        @keyframes slideInLeft {
            from { transform: translateX(-50px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInRight {
            from { transform: translateX(50px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeInUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
