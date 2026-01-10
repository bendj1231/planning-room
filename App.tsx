
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RoomEnvironment } from './components/RoomEnvironment';
import { BoardItem } from './components/BoardItem';
import { ConnectionLines } from './components/ConnectionLines';
import { BoardType, ComponentType, BoardItem as IBoardItem, Point, ConnectionType } from './types';
import { BOARD_THEMES, INITIAL_ITEMS, ITEM_DIMENSIONS } from './constants';
import { Plus, Layout, Palette, Sparkles, ZoomIn, ZoomOut, Maximize, Lightbulb, Link, Trash2, Download, Upload } from 'lucide-react';

const App: React.FC = () => {
  const [items, setItems] = useState<IBoardItem[]>(INITIAL_ITEMS);
  const [boardType, setBoardType] = useState<BoardType>(BoardType.CARDBOARD);
  const [activeStringType, setActiveStringType] = useState<ConnectionType>(ConnectionType.DEFAULT);
  const [projectTitle, setProjectTitle] = useState("Operation: Skyline");
  
  // Board Dimensions State - Fixed Large Landscape Map
  const [boardSize] = useState({ width: 3400, height: 2200 });

  // String Mode State
  const [isStringMode, setIsStringMode] = useState(false);

  // Focus Mode State
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, sourceId: string, targetId: string } | null>(null);

  // View State (Zoom & Pan)
  // Start zoomed out (0.6) to show more of the map initially
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.6 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ mouseX: 0, mouseY: 0, viewX: 0, viewY: 0 });
  
  // 3D Tilt State
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  
  // Connection state
  const [activeConnection, setActiveConnection] = useState<{ fromId: string; current: Point; type: ConnectionType } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close context menu on global click
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Sync active connection color with spool selection
  useEffect(() => {
    setActiveConnection(prev => prev ? { ...prev, type: activeStringType } : null);
  }, [activeStringType]);

  const handleUpdateItem = useCallback((id: string, updates: Partial<IBoardItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    setItems(prev => prev
      .filter(item => item.id !== id)
      .map(item => ({
        ...item,
        connections: item.connections.filter(c => c.targetId !== id) // Remove dead connections
      }))
    );
    if (focusedItemId === id) setFocusedItemId(null);
  }, [focusedItemId]);

  const handleConnectionContextMenu = (e: React.MouseEvent, sourceId: string, targetId: string) => {
    e.preventDefault(); // Prevent native browser menu
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      sourceId,
      targetId
    });
  };

  const handleChangeConnectionColor = (newType: ConnectionType | 'DELETE') => {
    if (!contextMenu) return;

    if (newType === 'DELETE') {
      setItems(prev => prev.map(item => {
        if (item.id === contextMenu.sourceId) {
          return {
            ...item,
            connections: item.connections.filter(c => c.targetId !== contextMenu.targetId)
          };
        }
        return item;
      }));
    } else {
      setItems(prev => prev.map(item => {
        if (item.id === contextMenu.sourceId) {
          return {
            ...item,
            connections: item.connections.map(c => 
              c.targetId === contextMenu.targetId ? { ...c, type: newType } : c
            )
          };
        }
        return item;
      }));
    }
    setContextMenu(null);
  };

  // --- File Operations ---

  const handleSaveBoard = () => {
    const payload = {
      title: projectTitle,
      boardType,
      items
    };
    
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Sanitize title for filename
    const filename = projectTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') || 'planning-board';
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadBoardClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        const parsed = JSON.parse(result);
        
        // Handle legacy array format
        if (Array.isArray(parsed)) {
          const isValid = parsed.every(item => item.id && item.type);
          if (isValid) {
            setItems(parsed);
          } else {
            alert('Invalid legacy board file format.');
          }
        } 
        // Handle new object format
        else if (parsed && typeof parsed === 'object') {
          if (parsed.title) setProjectTitle(parsed.title);
          if (parsed.boardType && BOARD_THEMES[parsed.boardType as BoardType]) {
            setBoardType(parsed.boardType as BoardType);
          }
          if (Array.isArray(parsed.items)) {
             setItems(parsed.items);
          }
        }
      } catch (err) {
        console.error("Failed to parse board file", err);
        alert('Failed to parse file.');
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- Collision Detection Helpers ---

  const hasCollision = (x: number, y: number, w: number, h: number, existingItems: IBoardItem[]) => {
    const buffer = 30; // Spacing buffer
    return existingItems.some(item => {
        const dim = ITEM_DIMENSIONS[item.type] || { w: 200, h: 200 };
        return (
            x < item.x + dim.w + buffer &&
            x + w + buffer > item.x &&
            y < item.y + dim.h + buffer &&
            y + h + buffer > item.y
        );
    });
  };

  const findFreePosition = (
    preferredX: number, 
    preferredY: number, 
    type: ComponentType, 
    currentItems: IBoardItem[], 
    initialRadius: number = 0,
    searchSteps: number = 50
  ) => {
    const dim = ITEM_DIMENSIONS[type];
    
    // Attempt 1: Preferred position
    if (!hasCollision(preferredX, preferredY, dim.w, dim.h, currentItems)) {
        return { x: preferredX, y: preferredY };
    }

    // Attempt 2: Spiral/Random search outward
    for (let i = 1; i < searchSteps; i++) {
        // Create an Archimedean spiral or expanding rings
        const angle = i * 0.5 + Math.random(); // Varied angle
        const dist = initialRadius + (i * 20); // Expanding distance
        
        const testX = preferredX + Math.cos(angle) * dist;
        const testY = preferredY + Math.sin(angle) * dist;

        // Boundary check
        if (testX < 0 || testY < 0 || testX > boardSize.width - dim.w || testY > boardSize.height - dim.h) continue;

        if (!hasCollision(testX, testY, dim.w, dim.h, currentItems)) {
            return { x: testX, y: testY };
        }
    }

    // Fallback: Just return preferred with a simple offset if all else fails
    return { x: preferredX + 50, y: preferredY + 50 };
  };


  // Add Item (Top Left Controls - centered on board)
  const addItem = (type: ComponentType) => {
    const centerX = boardSize.width / 2 - 100; // rough center minus half item width
    const centerY = boardSize.height / 2 - 100;
    
    // Find a spot near the center that isn't taken
    const pos = findFreePosition(centerX, centerY, type, items, 50, 80);

    const newItem: IBoardItem = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      text: type === ComponentType.TASK ? 'New Task' : 
            type === ComponentType.OBJECTIVE ? 'New Objective' : 
            type === ComponentType.IDEA ? 'New Idea' : 'Goal',
      x: pos.x,
      y: pos.y,
      rotation: (Math.random() - 0.5) * 6,
      connections: [],
      color: type === ComponentType.OBJECTIVE ? ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCB77'][Math.floor(Math.random() * 4)] : undefined
    };
    setItems([...items, newItem]);
  };

  // Add Item (Quick Add from Focus Mode - relative to parent)
  const addConnectedItem = (sourceId: string, type: ComponentType) => {
    const sourceItem = items.find(i => i.id === sourceId);
    if (!sourceItem) return;

    // Calculate position slightly offset below/right from parent
    const preferredX = sourceItem.x + 50;
    const preferredY = sourceItem.y + 250; 

    const pos = findFreePosition(preferredX, preferredY, type, items, 100, 60);

    const newItem: IBoardItem = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        text: type === ComponentType.TASK ? 'New Task' : 
              type === ComponentType.OBJECTIVE ? 'New Objective' : 
              type === ComponentType.IDEA ? 'New Idea' : 'Goal',
        x: pos.x,
        y: pos.y,
        rotation: (Math.random() - 0.5) * 4,
        connections: [],
    };

    // Determine connection color based on parent -> child relationship context
    let connType = ConnectionType.DEFAULT;
    if (sourceItem.type === ComponentType.OBJECTIVE && type === ComponentType.TASK) connType = ConnectionType.CRITICAL;
    if (sourceItem.type === ComponentType.TASK && type === ComponentType.IDEA) connType = ConnectionType.ALTERNATIVE;
    if (type === ComponentType.GOAL) connType = ConnectionType.POSITIVE;

    // Add item and create connection from source to new item
    setItems(prev => {
        const withNewItem = [...prev, newItem];
        return withNewItem.map(item => {
            if (item.id === sourceId) {
                return {
                    ...item,
                    connections: [
                        ...item.connections,
                        {
                            id: Math.random().toString(36).substr(2, 9),
                            targetId: newItem.id,
                            type: connType,
                            sequence: 1 // Simplified sequence for quick add
                        }
                    ]
                };
            }
            return item;
        });
    });
  };

  const toggleStringMode = () => {
    setIsStringMode(!isStringMode);
    setActiveConnection(null);
    if (!isStringMode) setFocusedItemId(null); // Clear focus when entering string mode
  };

  // Handle single click - mainly for String Mode connections
  const handleItemClick = (id: string) => {
    if (isStringMode) {
      // --- String Mode Logic ---
      if (!activeConnection) {
          // Start connection (First Click)
          const item = items.find(i => i.id === id);
          if (item) {
               setActiveConnection({
                   fromId: id,
                   type: activeStringType,
                   current: { x: item.x, y: item.y } 
               });
          }
      } else {
          // Complete connection (Second Click)
          if (activeConnection.fromId === id) return; // Clicked same node
          
          setItems(prev => {
              // Find max sequence for this type in current items
              let maxSeq = 0;
              prev.forEach(i => {
                  i.connections.forEach(c => {
                      if (c.type === activeConnection.type) {
                          maxSeq = Math.max(maxSeq, c.sequence);
                      }
                  });
              });
              const nextSeq = maxSeq + 1;

              return prev.map(item => {
                  if (item.id === activeConnection.fromId) {
                       return { 
                         ...item, 
                         connections: [
                           ...item.connections, 
                           { 
                             id: Math.random().toString(36).substr(2, 9),
                             targetId: id, 
                             type: activeConnection.type,
                             sequence: nextSeq 
                           }
                         ] 
                       };
                  }
                  return item;
              });
          });

          // Reset connection but STAY in String Mode
          setActiveConnection(null);
      }
    }
  };

  // Handle Double Click - Focus Mode
  const handleItemDoubleClick = (id: string) => {
    if (!isStringMode) {
      setFocusedItemId(prev => prev === id ? null : id);
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (isStringMode && activeConnection) {
      setActiveConnection(null);
    }
    // Clear focus on background click
    setFocusedItemId(null);
  };

  // --- Zoom & Pan Logic ---

  const handleZoom = (delta: number) => {
    setView(prev => {
        const newScale = Math.min(Math.max(0.15, prev.scale + delta), 4);
        return { ...prev, scale: newScale };
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomIntensity = 0.001;
    const delta = -e.deltaY * zoomIntensity;
    handleZoom(delta);
  };

  const startPan = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    setIsPanning(true);
    panStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        viewX: view.x,
        viewY: view.y
    };
  };

  const resetView = () => {
    setView({ x: 0, y: 0, scale: 0.6 });
  };

  // --- Connection Logic (Drag) ---

  const startConnection = (fromId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    setActiveConnection({
      fromId,
      type: activeStringType, 
      current: { 
        x: relX / view.scale, 
        y: relY / view.scale
      }
    });
  };

  const endConnection = (toId: string) => {
    if (!activeConnection || activeConnection.fromId === toId) {
      setActiveConnection(null);
      return;
    }

    setItems(prev => {
        let maxSeq = 0;
        prev.forEach(i => {
            i.connections.forEach(c => {
                if (c.type === activeConnection.type) maxSeq = Math.max(maxSeq, c.sequence);
            });
        });
        const nextSeq = maxSeq + 1;

        return prev.map(item => {
          if (item.id === activeConnection.fromId) {
            const newConnection = { 
              id: Math.random().toString(36).substr(2, 9),
              targetId: toId, 
              type: activeConnection.type,
              sequence: nextSeq
            };
            return { ...item, connections: [...item.connections, newConnection] };
          }
          return item;
        });
    });

    setActiveConnection(null);
  };

  // Global events for Pan, Drag, Tilt
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const x = (window.innerWidth / 2 - e.clientX) / 60;
      const y = (window.innerHeight / 2 - e.clientY) / 60;
      setTilt({ x, y });

      if (isPanning) {
        const dx = e.clientX - panStart.current.mouseX;
        const dy = e.clientY - panStart.current.mouseY;
        setView(prev => ({
            ...prev,
            x: panStart.current.viewX + dx,
            y: panStart.current.viewY + dy
        }));
      }

      if (activeConnection && boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        setActiveConnection(prev => prev ? {
          ...prev,
          current: {
            x: (e.clientX - rect.left) / view.scale,
            y: (e.clientY - rect.top) / view.scale
          }
        } : null);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isPanning) setIsPanning(false);
      if (!isStringMode && activeConnection) setTimeout(() => setActiveConnection(null), 10);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [activeConnection, isPanning, view.scale, isStringMode]);

  const theme = BOARD_THEMES[boardType];

  const getTitleStyle = () => {
    switch (boardType) {
      case BoardType.BLACKBOARD:
        return "font-casual text-white/90 drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] placeholder:text-white/30";
      case BoardType.WHITEBOARD:
        return "font-marker text-blue-900/90 drop-shadow-[1px_1px_0px_rgba(0,0,0,0.1)] placeholder:text-blue-900/30";
      case BoardType.BLUEPRINT:
        return "font-mono text-blue-100/90 tracking-[0.5em] uppercase drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] placeholder:text-blue-100/30";
      case BoardType.CARDBOARD:
      default:
        return "font-marker text-black/80 rotate-1 drop-shadow-[1px_1px_0px_rgba(255,255,255,0.2)] placeholder:text-black/20";
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <RoomEnvironment>
        <div 
          ref={boardRef}
          onMouseDown={startPan}
          onClick={handleBackgroundClick}
          onWheel={handleWheel}
          className={`relative ${theme.bg} transition-shadow duration-700 ease-in-out shrink-0 rounded-2xl border-[16px] ${theme.border}`}
          style={{
            width: boardSize.width,
            height: boardSize.height,
            transformStyle: 'preserve-3d',
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            cursor: isStringMode ? 'crosshair' : (isPanning ? 'grabbing' : 'grab'),
            boxShadow: '0 50px 100px -20px rgba(0,0,0,0.8), inset 0 0 100px rgba(0,0,0,0.5)', 
            transformOrigin: '50% 50%' 
          }}
        >
          {/* Hanging Lamp - BIGGER & BRIGHTER & CENTERED */}
          <div className="absolute -top-[350px] left-1/2 -translate-x-1/2 z-[60] pointer-events-none preserve-3d flex flex-col items-center">
            {/* Cord */}
            <div className="w-1 h-80 bg-black shadow-xl"></div>
            {/* Shade */}
            <div className="w-[450px] h-40 bg-zinc-950 rounded-t-[225px] shadow-[0_10px_30px_rgba(0,0,0,1)] relative z-20">
               {/* Rim Highlight */}
               <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800/50"></div>
               {/* Inner glow/bulb */}
               <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-60 h-20 bg-yellow-50 rounded-full blur-[20px] opacity-80"></div>
            </div>
            {/* Light Cone / Spotlight Effect on Board */}
             <div className="absolute top-[320px] left-1/2 -translate-x-1/2 w-[2800px] h-[2800px] bg-[radial-gradient(circle,rgba(255,250,230,0.15)_0%,rgba(0,0,0,0)_60%)] pointer-events-none mix-blend-overlay blur-3xl z-10"></div>
          </div>

          {/* Project Title Header - Editable */}
          <div className="absolute top-[200px] left-0 w-full flex justify-center z-20 pointer-events-none">
              <input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()} // Allow selecting text without dragging board
                className={`bg-transparent border-none text-center text-8xl focus:outline-none w-3/4 max-w-5xl transition-all duration-500 pointer-events-auto ${getTitleStyle()}`}
                placeholder="UNTITLED PROJECT"
                spellCheck={false}
              />
          </div>

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)] pointer-events-none z-0"></div>

          <div 
            className="absolute inset-0 opacity-70 pointer-events-none" 
            style={{ 
              backgroundImage: theme.texture,
              backgroundSize: theme.textureSize || 'auto',
              mixBlendMode: 'multiply'
            }}
          />

          <div className="absolute -inset-[1px] shadow-[inset_0_2px_15px_rgba(0,0,0,0.8),inset_0_-2px_15px_rgba(255,255,255,0.05)] pointer-events-none"></div>

          {/* Connection Lines Layer */}
          <div className={`transition-all duration-500 ${focusedItemId ? 'blur-sm opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
            <ConnectionLines 
              items={items} 
              activeConnection={activeConnection}
              onConnectionContextMenu={handleConnectionContextMenu}
            />
          </div>

          {items.map(item => (
            <BoardItem 
              key={item.id} 
              item={item} 
              scale={view.scale}
              boardSize={boardSize}
              onUpdate={handleUpdateItem} 
              onDelete={handleDeleteItem}
              onStartConnect={startConnection}
              onEndConnect={endConnection}
              isConnecting={!!activeConnection}
              isConnectionStart={activeConnection?.fromId === item.id}
              isStringMode={isStringMode}
              onItemClick={handleItemClick}
              onItemDoubleClick={handleItemDoubleClick}
              
              isFocused={focusedItemId === item.id}
              isBlurred={focusedItemId !== null && focusedItemId !== item.id}
              onAddRelated={addConnectedItem}
            />
          ))}

          {/* Focus Dim Layer - Inside Board to be behind focused item (z-60) but above others */}
          <div className={`absolute inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-500 pointer-events-none ${focusedItemId ? 'opacity-100' : 'opacity-0'}`} />

        </div>
      </RoomEnvironment>

      {/* Connection Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[100] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl flex flex-col gap-1 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ... existing menu ... */}
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-2 py-1">Change String</div>
          <button onClick={() => handleChangeConnectionColor(ConnectionType.CRITICAL)} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-200 text-xs">
            <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" /> Critical
          </button>
          <button onClick={() => handleChangeConnectionColor(ConnectionType.POSITIVE)} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-200 text-xs">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm" /> Positive
          </button>
          <button onClick={() => handleChangeConnectionColor(ConnectionType.ALTERNATIVE)} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-200 text-xs">
            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" /> Alternative
          </button>
          <button onClick={() => handleChangeConnectionColor(ConnectionType.DEFAULT)} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-200 text-xs">
            <div className="w-3 h-3 rounded-full bg-zinc-400 shadow-sm" /> Default
          </button>
          <div className="h-px bg-white/10 my-1" />
          <button onClick={() => handleChangeConnectionColor('DELETE')} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors text-xs">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {/* Top Left: Creation Controls (Hidden/Blurred in Focus Mode) */}
      <div className={`absolute left-10 top-10 flex flex-col space-y-4 z-50 transition-all duration-300 ${focusedItemId ? 'opacity-0 pointer-events-none -translate-y-4' : 'opacity-100 translate-y-0'}`}>
        <div className="bg-zinc-900/95 backdrop-blur-xl p-3 rounded-2xl flex flex-col space-y-3 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
          <button onClick={() => addItem(ComponentType.OBJECTIVE)} className="p-3 bg-white/5 hover:bg-white/15 rounded-xl text-white transition-all flex items-center space-x-3 group w-full text-left">
            <Plus size={20} className="text-emerald-400 shrink-0" />
            <span className="text-sm font-medium">Add Objective</span>
          </button>
          <button onClick={() => addItem(ComponentType.TASK)} className="p-3 bg-white/5 hover:bg-white/15 rounded-xl text-white transition-all flex items-center space-x-3 group w-full text-left">
            <Layout size={20} className="text-yellow-400 shrink-0" />
            <span className="text-sm font-medium">Add Sticky Task</span>
          </button>
          <button onClick={() => addItem(ComponentType.IDEA)} className="p-3 bg-white/5 hover:bg-white/15 rounded-xl text-white transition-all flex items-center space-x-3 group w-full text-left">
            <Lightbulb size={20} className="text-orange-300 shrink-0" />
            <span className="text-sm font-medium">Add Idea Strip</span>
          </button>
          <button onClick={() => addItem(ComponentType.GOAL)} className="p-3 bg-white/5 hover:bg-white/15 rounded-xl text-white transition-all flex items-center space-x-3 group w-full text-left">
            <Sparkles size={20} className="text-blue-400 shrink-0" />
            <span className="text-sm font-medium">Add Final Goal</span>
          </button>
        </div>
        
        {/* String Spool Control */}
        <div className="bg-zinc-900/95 backdrop-blur-xl p-3 rounded-2xl flex flex-col space-y-2 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
           <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider text-center pb-1 border-b border-white/5">String Spool</div>
           <div className="flex justify-between items-center px-1 pt-1 gap-2">
              <button onClick={() => setActiveStringType(ConnectionType.CRITICAL)} className={`w-6 h-6 rounded-full bg-red-500 shadow-sm transition-all hover:scale-110 ${activeStringType === ConnectionType.CRITICAL ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'}`} />
              <button onClick={() => setActiveStringType(ConnectionType.POSITIVE)} className={`w-6 h-6 rounded-full bg-green-500 shadow-sm transition-all hover:scale-110 ${activeStringType === ConnectionType.POSITIVE ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'}`} />
              <button onClick={() => setActiveStringType(ConnectionType.ALTERNATIVE)} className={`w-6 h-6 rounded-full bg-blue-500 shadow-sm transition-all hover:scale-110 ${activeStringType === ConnectionType.ALTERNATIVE ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'}`} />
              <button onClick={() => setActiveStringType(ConnectionType.DEFAULT)} className={`w-6 h-6 rounded-full bg-zinc-400 shadow-sm transition-all hover:scale-110 ${activeStringType === ConnectionType.DEFAULT ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'}`} />
           </div>
           
           <div className="h-px bg-white/5 my-1"></div>

           <button 
             onClick={toggleStringMode} 
             className={`w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-2 ${
               isStringMode 
                 ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] border border-blue-400/30' 
                 : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white border border-transparent'
             }`}
           >
             <Link size={14} className={isStringMode ? "animate-pulse" : ""} />
             <span>{isStringMode ? 'Finish Linking' : 'Start Linking'}</span>
           </button>
        </div>

        <div className="bg-zinc-900/95 backdrop-blur-xl p-3 rounded-2xl flex flex-col space-y-3 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
          {Object.entries(BOARD_THEMES).map(([type, t]) => (
            <button 
              key={type}
              onClick={() => setBoardType(type as BoardType)}
              className={`p-3 rounded-xl transition-all flex items-center space-x-3 group w-full text-left ${boardType === type ? 'bg-white/20 text-white shadow-inner' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
              title={t.label}
            >
              <Palette size={20} className="shrink-0" />
              <span className="text-xs font-medium">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Project Files */}
        <div className="bg-zinc-900/95 backdrop-blur-xl p-3 rounded-2xl flex flex-row space-x-2 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
           <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
           <button onClick={handleSaveBoard} className="flex-1 py-2 bg-white/5 hover:bg-white/15 rounded-lg text-white transition-all flex items-center justify-center gap-2 group" title="Save Board">
              <Download size={16} className="text-zinc-400 group-hover:text-white" />
              <span className="text-xs font-medium text-zinc-400 group-hover:text-white">Save</span>
           </button>
           <button onClick={handleLoadBoardClick} className="flex-1 py-2 bg-white/5 hover:bg-white/15 rounded-lg text-white transition-all flex items-center justify-center gap-2 group" title="Load Board">
              <Upload size={16} className="text-zinc-400 group-hover:text-white" />
              <span className="text-xs font-medium text-zinc-400 group-hover:text-white">Load</span>
           </button>
        </div>
      </div>

      {/* Bottom Right: Zoom Controls */}
      <div className={`absolute right-10 bottom-10 flex flex-col space-y-3 z-50 transition-all duration-300 ${focusedItemId ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 translate-y-0'}`}>
        <div className="bg-zinc-900/95 backdrop-blur-xl p-2 rounded-full flex flex-col items-center space-y-2 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
           <button onClick={() => handleZoom(0.1)} className="p-3 bg-white/5 hover:bg-white/20 rounded-full text-white transition-all active:scale-95" title="Zoom In">
             <ZoomIn size={20} />
           </button>
           <button onClick={resetView} className="p-3 bg-white/5 hover:bg-white/20 rounded-full text-white transition-all active:scale-95" title="Reset View">
             <Maximize size={20} />
           </button>
           <button onClick={() => handleZoom(-0.1)} className="p-3 bg-white/5 hover:bg-white/20 rounded-full text-white transition-all active:scale-95" title="Zoom Out">
             <ZoomOut size={20} />
           </button>
           <div className="text-[10px] text-zinc-500 font-mono py-1">{Math.round(view.scale * 100)}%</div>
        </div>
      </div>
      
      {/* Help Text */}
      <div className={`absolute top-6 left-1/2 -translate-x-1/2 text-white/30 text-[10px] uppercase tracking-[0.2em] font-mono pointer-events-none select-none transition-opacity duration-300 ${focusedItemId ? 'opacity-0' : 'opacity-100'}`}>
           Drag background to pan • Wheel to zoom • Select string color to connect
      </div>
    </div>
  );
};

export default App;
