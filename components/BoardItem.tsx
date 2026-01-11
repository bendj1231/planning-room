
import React, { useState, useRef, useEffect } from 'react';
import { ComponentType, BoardItem as IBoardItem } from '../types';
import { Link2, Plus, Layout, Lightbulb, Sparkles } from 'lucide-react';
import { ITEM_DIMENSIONS } from '../constants';

interface Props {
  item: IBoardItem;
  scale: number;
  boardSize: { width: number; height: number };
  onUpdate: (id: string, updates: Partial<IBoardItem>) => void;
  onDelete: (id: string) => void;
  onStartConnect: (id: string, e: React.MouseEvent) => void;
  onEndConnect: (id: string) => void;
  isConnecting: boolean;
  isConnectionStart?: boolean;
  isStringMode: boolean;
  onItemClick: (id: string) => void;
  onItemDoubleClick: (id: string) => void;
  onContextMenu: (id: string, e: React.MouseEvent) => void;
  onExitFocus?: () => void;
  
  isFocused?: boolean;
  isBlurred?: boolean;
  onAddRelated?: (sourceId: string, type: ComponentType) => void;
}

export const BoardItem: React.FC<Props> = ({ 
  item, 
  scale,
  boardSize,
  onUpdate, 
  onDelete, 
  onStartConnect, 
  onEndConnect,
  isConnecting,
  isConnectionStart,
  isStringMode,
  onItemClick,
  onItemDoubleClick,
  onContextMenu,
  onExitFocus,
  isFocused,
  isBlurred,
  onAddRelated
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, itemX: 0, itemY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();

    // In string mode or if blurred (not focused), we just want to click/select, not drag immediately
    if (isStringMode || isBlurred) return;

    if ((e.target as HTMLElement).closest('.no-drag')) return;
    
    setIsDragging(true);
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      itemX: item.x,
      itemY: item.y
    };
  };

  // Self-Correction: Ensure items are always within bounds if board size changes
  useEffect(() => {
    const dim = ITEM_DIMENSIONS[item.type] || { w: 200, h: 200 };
    const maxX = boardSize.width - dim.w;
    const maxY = boardSize.height - dim.h;
    
    let newX = item.x;
    let newY = item.y;
    let changed = false;

    if (item.x > maxX) { newX = maxX; changed = true; }
    if (item.y > maxY) { newY = maxY; changed = true; }
    if (item.x < 0) { newX = 0; changed = true; }
    if (item.y < 0) { newY = 0; changed = true; }

    if (changed) {
      onUpdate(item.id, { x: newX, y: newY });
    }
  }, [boardSize.width, boardSize.height, item.x, item.y, item.type, item.id, onUpdate]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const dx = (e.clientX - dragStart.current.mouseX) / scale;
      const dy = (e.clientY - dragStart.current.mouseY) / scale;

      const dim = ITEM_DIMENSIONS[item.type] || { w: 200, h: 200 };
      const maxX = boardSize.width - dim.w;
      const maxY = boardSize.height - dim.h;

      onUpdate(item.id, {
        x: Math.max(0, Math.min(maxX, dragStart.current.itemX + dx)),
        y: Math.max(0, Math.min(maxY, dragStart.current.itemY + dy))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, item.id, item.type, onUpdate, scale, boardSize]);

  // Disable pointer events on text area when NOT focused to allow dragging by clicking text
  const textAreaPointerEvents = (isStringMode || !isFocused) ? 'pointer-events-none' : 'pointer-events-auto';

  // Handle Enter to exit focus (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onExitFocus?.();
    }
  };

  const renderContent = () => {
    const commonClasses = "transition-all duration-300 transform-gpu perspective-1000 group-hover:translate-z-12";
    const contactShadow = "absolute inset-0 bg-black/40 blur-[4px] -z-10 translate-y-1 translate-x-1 scale-[0.98]";

    switch (item.type) {
      case ComponentType.OBJECTIVE:
        return (
          <div className="relative group/objective">
            <div className={contactShadow}></div>
            <div 
              className={`${commonClasses} w-52 h-36 p-5 flex flex-col items-center justify-center text-center relative rounded-sm group-hover:shadow-[15px_25px_45px_rgba(0,0,0,0.55)]`}
              style={{ 
                  backgroundColor: item.color || '#F3F4F6', 
                  clipPath: 'polygon(0% 0%, 100% 0%, 100% 92%, 92% 100%, 0% 100%)',
                  boxShadow: 'inset 0 0 60px rgba(0,0,0,0.15), 4px 6px 18px rgba(0,0,0,0.35)',
                  transform: 'rotateX(2deg) rotateY(-2deg)'
              }}
            >
              <div className="absolute inset-0 opacity-15 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>
              <div className="absolute top-3 left-3 right-3 border-b border-black/10 text-[9px] uppercase font-bold tracking-widest text-black/50">Objective Paper</div>
              <textarea
                value={item.text}
                onChange={(e) => onUpdate(item.id, { text: e.target.value })}
                onKeyDown={handleKeyDown}
                onMouseDown={(e) => e.stopPropagation()} 
                className={`bg-transparent border-none w-full h-full resize-none focus:outline-none font-marker text-slate-900 text-lg text-center mt-4 leading-tight placeholder:text-black/20 ${textAreaPointerEvents}`}
                placeholder="Primary Goal..."
              />
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-black/20"></div>
            </div>
          </div>
        );
      case ComponentType.TASK:
        return (
          <div className="relative group/task perspective-1000">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 w-8 h-8 pointer-events-none">
                <div className="w-6 h-6 bg-gradient-to-tr from-red-800 via-red-500 to-red-300 rounded-full shadow-[0_4px_8px_rgba(0,0,0,0.6)] border-b-2 border-red-900 relative">
                    <div className="absolute top-1 left-1.5 w-1.5 h-1.5 bg-white/60 rounded-full blur-[0.5px]"></div>
                </div>
                <div className="w-2 h-2 bg-black/80 mx-auto -mt-1 rounded-full blur-[1.5px] opacity-60"></div>
                <div className="absolute top-6 left-6 w-3 h-3 bg-black/40 rounded-full blur-[4px]"></div>
            </div>
            
            <div className={contactShadow}></div>
            <div className={`${commonClasses} w-44 h-44 bg-[#fff9c4] p-5 shadow-[8px_12px_25px_rgba(0,0,0,0.4)] hover:shadow-[12px_24px_50px_rgba(0,0,0,0.45)] relative overflow-hidden`}
                 style={{ 
                    backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0.08) 100%)',
                    backgroundSize: '100% 24px, 100% 100%',
                    transform: 'rotateX(-2deg) rotateY(1deg)'
                 }}>
              <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-black/5 to-transparent pointer-events-none"></div>
              <div className="absolute bottom-0 right-0 w-10 h-10 bg-gradient-to-tl from-black/15 to-transparent"></div>
              <div className="absolute bottom-[-3px] right-[-3px] w-6 h-6 bg-[#f0e68c] shadow-[-3px_-3px_6px_rgba(0,0,0,0.15)] rotate-45"></div>

              <textarea
                value={item.text}
                onChange={(e) => onUpdate(item.id, { text: e.target.value })}
                onKeyDown={handleKeyDown}
                onMouseDown={(e) => e.stopPropagation()}
                className={`bg-transparent border-none w-full h-full resize-none focus:outline-none font-handwriting text-slate-800 text-xl leading-[24px] pt-1 placeholder:text-slate-400 ${textAreaPointerEvents}`}
                placeholder="Write task..."
              />
            </div>
          </div>
        );
      case ComponentType.IDEA:
        return (
          <div className="relative group/idea">
            <div className={contactShadow}></div>
            <div className={`${commonClasses} w-60 h-16 bg-[#fafafa] shadow-[2px_3px_10px_rgba(0,0,0,0.15)] flex items-center justify-center px-4 relative hover:shadow-[4px_6px_20px_rgba(0,0,0,0.2)]`}
                 style={{ 
                    backgroundImage: 'linear-gradient(to bottom, #ffffff 0%, #f0f0f0 100%)',
                    transform: 'rotateX(0deg) rotateY(0deg)' 
                 }}>
               <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-5 bg-white/30 shadow-[0_1px_1px_rgba(0,0,0,0.1)] border border-white/40 transform -rotate-1 skew-x-12 backdrop-blur-[2px]"></div>

               <textarea
                value={item.text}
                onChange={(e) => onUpdate(item.id, { text: e.target.value })}
                onKeyDown={handleKeyDown}
                onMouseDown={(e) => e.stopPropagation()}
                className={`bg-transparent border-none w-full h-full resize-none focus:outline-none font-casual text-zinc-700 text-xl text-center py-4 leading-none placeholder:text-zinc-300 ${textAreaPointerEvents}`}
                placeholder="Idea strip..."
              />
            </div>
          </div>
        );
      case ComponentType.GOAL:
        return (
          <div className="relative group/goal">
            <div className={contactShadow}></div>
            <div className={`${commonClasses} w-56 h-40 bg-white p-5 shadow-[10px_20px_40px_rgba(0,0,0,0.45)] relative flex flex-col border border-slate-200 group-hover:translate-z-20`}
                 style={{ transform: 'rotateX(1deg) rotateY(3deg)' }}>
              <div className="absolute top-0 left-0 right-0 h-4 flex overflow-hidden">
                  {Array.from({length: 20}).map((_, i) => (
                      <div key={i} className={`flex-1 h-full ${i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-200'}`}></div>
                  ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-4 flex overflow-hidden">
                  {Array.from({length: 20}).map((_, i) => (
                      <div key={i} className={`flex-1 h-full ${i % 2 === 0 ? 'bg-zinc-200' : 'bg-zinc-900'}`}></div>
                  ))}
              </div>
              
              <div className="my-auto text-center px-2 py-4 border-2 border-dashed border-zinc-300 rounded relative overflow-hidden">
                <div className="absolute inset-0 shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] pointer-events-none"></div>
                <span className="text-[10px] text-zinc-400 font-bold block mb-1 tracking-[0.2em] uppercase">Phase Finish</span>
                <textarea
                  value={item.text}
                  onChange={(e) => onUpdate(item.id, { text: e.target.value })}
                  onKeyDown={handleKeyDown}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`bg-transparent border-none w-full h-full resize-none focus:outline-none font-marker text-zinc-900 text-xl text-center uppercase tracking-tight placeholder:text-zinc-200 ${textAreaPointerEvents}`}
                  placeholder="Mission Goal..."
                />
              </div>
            </div>
          </div>
        );
    }
  };

  const getRingClass = () => {
    if (!isConnecting) return '';
    if (isConnectionStart) return 'ring-4 ring-amber-500 rounded-lg shadow-[0_0_20px_rgba(245,158,11,0.5)]'; // Distinct start style
    return 'ring-4 ring-blue-500/50 rounded-lg hover:ring-blue-500 cursor-crosshair'; // Potential target style
  };

  // Focus Styles
  const getFocusStyle = () => {
    if (isFocused) {
      return {
        zIndex: 60, // Increased to sit above the z-40 dim layer
        transform: `translate3d(0, 0, 50px) scale(1.15) rotate(${item.rotation}deg)`,
        filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.9))'
      };
    }
    if (isBlurred) {
      return {
        filter: 'blur(4px) grayscale(80%) opacity(0.4)',
        pointerEvents: 'none' as const,
        transform: `scale(0.95) rotate(${item.rotation}deg)`
      };
    }
    return {
       transform: `rotate(${item.rotation}deg)`
    };
  };

  // Quick Add Action Buttons for Focused Item
  const renderQuickAdd = () => {
    if (!isFocused || !onAddRelated) return null;

    // Determine what can be added based on current item type
    return (
        <div className="no-drag absolute -right-16 top-0 flex flex-col gap-2 animate-in slide-in-from-left-4 fade-in duration-300">
             {/* Objective can spawn Task or Idea */}
             {item.type === ComponentType.OBJECTIVE && (
                 <>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddRelated(item.id, ComponentType.TASK); }}
                        className="w-12 h-12 rounded-full bg-yellow-100/10 backdrop-blur-md border border-yellow-200/30 flex items-center justify-center text-yellow-200 hover:bg-yellow-400 hover:text-black transition-all hover:scale-110 shadow-lg group relative"
                        title="Add Linked Task"
                    >
                        <Plus size={20} className="absolute group-hover:scale-0 transition-transform"/>
                        <Layout size={20} className="absolute scale-0 group-hover:scale-100 transition-transform"/>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddRelated(item.id, ComponentType.IDEA); }}
                        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all hover:scale-110 shadow-lg group relative"
                        title="Add Linked Idea"
                    >
                        <Plus size={20} className="absolute group-hover:scale-0 transition-transform"/>
                        <Lightbulb size={20} className="absolute scale-0 group-hover:scale-100 transition-transform"/>
                    </button>
                 </>
             )}

             {/* Task can spawn Idea */}
             {item.type === ComponentType.TASK && (
                 <button 
                    onClick={(e) => { e.stopPropagation(); onAddRelated(item.id, ComponentType.IDEA); }}
                    className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all hover:scale-110 shadow-lg group relative"
                    title="Add Linked Idea"
                >
                    <Plus size={20} className="absolute group-hover:scale-0 transition-transform"/>
                    <Lightbulb size={20} className="absolute scale-0 group-hover:scale-100 transition-transform"/>
                </button>
             )}

             {/* Generic Add for others */}
             {(item.type === ComponentType.IDEA || item.type === ComponentType.GOAL) && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onAddRelated(item.id, ComponentType.TASK); }}
                    className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all hover:scale-110 shadow-lg group relative"
                    title="Add Linked Task"
                >
                    <Plus size={20} className="absolute group-hover:scale-0 transition-transform"/>
                    <Layout size={20} className="absolute scale-0 group-hover:scale-100 transition-transform"/>
                </button>
             )}
        </div>
    );
  };

  return (
    <div
      className={`absolute transition-all duration-500 ease-out ${getRingClass()} ${isStringMode ? 'cursor-crosshair' : (isFocused ? 'cursor-default' : 'cursor-grab active:cursor-grabbing')}`}
      style={{
        left: item.x,
        top: item.y,
        ...getFocusStyle()
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={() => isConnecting && onEndConnect(item.id)}
      onClick={(e) => {
        e.stopPropagation();
        onItemClick(item.id);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Prevent text selection highlight on double click
        if (window.getSelection) {
          window.getSelection()?.removeAllRanges();
        }
        onItemDoubleClick(item.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(item.id, e);
      }}
    >
      {/* Delete button (hidden if blurred) */}
      {!isBlurred && (
          <button 
            onClick={() => onDelete(item.id)}
            onMouseDown={(e) => e.stopPropagation()} 
            className="no-drag absolute -right-3 -top-3 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-30 hover:bg-red-700 shadow-[0_4px_10px_rgba(0,0,0,0.5)] hover:scale-110 active:scale-90"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
      )}

      {/* Connection Drag Handle (Only show if not in string mode AND not focused/blurred) */}
      {!isStringMode && !isFocused && !isBlurred && (
        <div 
          onMouseDown={(e) => onStartConnect(item.id, e)}
          className="no-drag absolute -bottom-4 -right-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_15px_rgba(59,130,246,0.5)] border-2 border-white/20 cursor-crosshair hover:scale-110 active:scale-90 transition-all z-40 opacity-0 group-hover:opacity-100"
          title="Drag to connect"
        >
          <Link2 size={18} />
        </div>
      )}

      <div className="group">
        {renderContent()}
      </div>

      {renderQuickAdd()}
    </div>
  );
};
