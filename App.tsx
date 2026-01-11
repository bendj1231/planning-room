import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RoomEnvironment } from './components/RoomEnvironment';
import { BoardItem } from './components/BoardItem';
import { ConnectionLines } from './components/ConnectionLines';
import { Dashboard } from './components/Dashboard';
import { BoardType, ComponentType, BoardItem as IBoardItem, Point, ConnectionType, GraphicsQuality } from './types';
import { BOARD_THEMES, INITIAL_ITEMS, ITEM_DIMENSIONS } from './constants';
import { Plus, Layout, Palette, Sparkles, ZoomIn, ZoomOut, Maximize, Lightbulb, Link, Trash2, Download, Upload, Eye, EyeOff, Printer, FilePlus, Eraser, Grid, Shuffle, Network, Diamond, LayoutTemplate, Clipboard, X, Image as ImageIcon, ChevronRight, ChevronDown, ChevronUp, Layers, Check, Settings as SettingsIcon, Zap, Laptop, Monitor, ArrowLeft } from 'lucide-react';
import { layoutMessy, layoutOrganized, layoutStructured, layoutDiamond, layoutCornered } from './utils/layouts';

// --- Helper Functions ---

// Recursive find connected ideas
const getConnectedIdeaIds = (rootId: string, items: IBoardItem[]) => {
    const connectedIds = new Set<string>();
    const queue = [rootId];
    const visited = new Set<string>([rootId]);

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentItem = items.find(i => i.id === currentId);
        if (!currentItem) continue;

        currentItem.connections.forEach(conn => {
            if (!visited.has(conn.targetId)) {
                const targetItem = items.find(i => i.id === conn.targetId);
                // Only include IDEAs in the drag group
                if (targetItem && targetItem.type === ComponentType.IDEA) {
                    visited.add(conn.targetId);
                    connectedIds.add(conn.targetId);
                    queue.push(conn.targetId);
                }
            }
        });
    }
    return connectedIds;
};

// LocalStorage Persistence for "Recents"
const saveToRecents = (project: { id: string, title: string, boardType: BoardType, items: IBoardItem[] }) => {
    try {
        const recentJson = localStorage.getItem('recent_boards');
        let recents = recentJson ? JSON.parse(recentJson) : [];
        
        const entry = {
            id: project.id,
            title: project.title,
            boardType: project.boardType,
            lastModified: Date.now(),
            itemCount: project.items.length,
            data: project // Storing full data for simplified local demo
        };

        // Remove existing with same ID to update it
        recents = recents.filter((r: any) => r.id !== project.id);
        
        // Add to front
        recents.unshift(entry);
        
        // Limit to 5
        if (recents.length > 5) recents.pop();

        localStorage.setItem('recent_boards', JSON.stringify(recents));
        return recents;
    } catch (e) {
        console.error("Failed to save recents", e);
        return [];
    }
};

const getRecents = () => {
    try {
        const recentJson = localStorage.getItem('recent_boards');
        return recentJson ? JSON.parse(recentJson) : [];
    } catch (e) {
        return [];
    }
};

const App: React.FC = () => {
  // --- Global State ---
  const [viewState, setViewState] = useState<'DASHBOARD' | 'EDITOR'>('DASHBOARD');
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>('MEDIUM');
  const [showIntroSettings, setShowIntroSettings] = useState(true);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);

  // --- Editor State ---
  const [projectId, setProjectId] = useState<string>('default-id');
  const [items, setItems] = useState<IBoardItem[]>(INITIAL_ITEMS);
  const [boardType, setBoardType] = useState<BoardType>(BoardType.CARDBOARD);
  const [projectTitle, setProjectTitle] = useState("Operation: Skyline");
  const [activeStringType, setActiveStringType] = useState<ConnectionType>(ConnectionType.DEFAULT);
  
  // Board Dimensions
  const [boardSize] = useState({ width: 3400, height: 2200 });

  // Modes & UI
  const [isStringMode, setIsStringMode] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [showUI, setShowUI] = useState(true);
  const [isDesignOpen, setIsDesignOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // View State (Zoom/Pan)
  const [editorView, setEditorView] = useState({ x: 0, y: 0, scale: 0.6 });
  const [isPanning, setIsPanning] = useState(false);
  const [isViewAnimating, setIsViewAnimating] = useState(false);
  const panStart = useRef({ mouseX: 0, mouseY: 0, viewX: 0, viewY: 0 });
  const preFocusView = useRef<{ x: number, y: number, scale: number } | null>(null);

  // Refs
  const boardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  
  // Reference Image
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(false);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<any>(null);
  const [activeConnection, setActiveConnection] = useState<{ fromId: string; current: Point; type: ConnectionType } | null>(null);

  // Load Recents on Mount
  useEffect(() => {
    setRecentProjects(getRecents());
  }, []);

  // Keyboard Delete
  useEffect(() => {
    if (viewState !== 'EDITOR') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && focusedItemId) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') return;
        handleDeleteItem(focusedItemId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedItemId, viewState]);

  // Click Outside
  useEffect(() => {
    const handleClickOutside = () => {
         setContextMenu(null);
         if (showSettings) setShowSettings(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [showSettings]);

  // Sync active string color
  useEffect(() => {
    setActiveConnection(prev => prev ? { ...prev, type: activeStringType } : null);
  }, [activeStringType]);

  // --- Project Management Functions ---

  const handleStartNewProject = () => {
      setProjectId(Math.random().toString(36).substr(2, 9));
      setItems([]);
      setProjectTitle("NEW OPERATION");
      setBoardType(BoardType.CARDBOARD);
      setEditorView({ x: 0, y: 0, scale: 0.6 });
      setViewState('EDITOR');
  };

  const handleLoadProject = (data: any) => {
      if (data) {
          setProjectId(data.id || Math.random().toString(36).substr(2, 9));
          if (data.title) setProjectTitle(data.title);
          if (data.boardType && BOARD_THEMES[data.boardType as BoardType]) setBoardType(data.boardType as BoardType);
          if (Array.isArray(data.items)) setItems(data.items);
          else if (Array.isArray(data)) setItems(data); // Legacy array support
          
          setEditorView({ x: 0, y: 0, scale: 0.6 });
          setViewState('EDITOR');
      }
  };

  const handleSaveBoard = () => {
    const projectData = {
      id: projectId,
      title: projectTitle,
      boardType,
      items
    };
    
    // 1. Save to JSON File
    const data = JSON.stringify(projectData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = projectTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') || 'planning-board';
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 2. Save to Recents
    const updatedRecents = saveToRecents(projectData);
    setRecentProjects(updatedRecents);
  };

  const handleExitToDashboard = () => {
      if (items.length > 0) {
          // Auto-save to recents when exiting
          const projectData = { id: projectId, title: projectTitle, boardType, items };
          const updated = saveToRecents(projectData);
          setRecentProjects(updated);
      }
      setViewState('DASHBOARD');
  };

  // --- Board Interaction Logic (Only used when ViewState === EDITOR) ---

  const handleUpdateItem = useCallback((id: string, updates: Partial<IBoardItem>) => {
    setItems(prev => {
        const currentItem = prev.find(i => i.id === id);
        if (!currentItem) return prev;
        
        if (currentItem.dragChildren && (updates.x !== undefined || updates.y !== undefined)) {
             const dx = (updates.x !== undefined ? updates.x : currentItem.x) - currentItem.x;
             const dy = (updates.y !== undefined ? updates.y : currentItem.y) - currentItem.y;
             
             if (dx !== 0 || dy !== 0) {
                 const childrenIds = getConnectedIdeaIds(id, prev);
                 return prev.map(item => {
                     if (item.id === id) return { ...item, ...updates };
                     if (childrenIds.has(item.id)) {
                         return { ...item, x: item.x + dx, y: item.y + dy };
                     }
                     return item;
                 });
             }
        }
        return prev.map(item => item.id === id ? { ...item, ...updates } : item);
    });
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    if (focusedItemId === id) handleExitFocus();
    setItems(prev => prev.filter(item => item.id !== id).map(item => ({
        ...item,
        connections: item.connections.filter(c => c.targetId !== id)
    })));
  }, [focusedItemId]);

  const handleEnterFocus = (id: string) => {
      const item = items.find(i => i.id === id);
      if (!item || focusedItemId === id) return;
      
      setIsViewAnimating(true);
      if (!focusedItemId) preFocusView.current = editorView;

      const dim = ITEM_DIMENSIONS[item.type] || { w: 200, h: 200 };
      const itemCenterX = item.x + dim.w / 2;
      const itemCenterY = item.y + dim.h / 2;
      
      setFocusedItemId(id);
      setEditorView({ 
          x: -(itemCenterX - boardSize.width / 2), 
          y: -(itemCenterY - boardSize.height / 2), 
          scale: 1.3 
      });
      setTimeout(() => setIsViewAnimating(false), 700);
  };

  const handleExitFocus = () => {
      setIsViewAnimating(true);
      setFocusedItemId(null);
      if (preFocusView.current) setEditorView(preFocusView.current);
      else setEditorView({ x: 0, y: 0, scale: 0.6 });
      setTimeout(() => setIsViewAnimating(false), 700);
  };

  // --- Collision & Placement Logic ---
  const hasCollision = (x: number, y: number, w: number, h: number, existingItems: IBoardItem[]) => {
    const buffer = 30;
    return existingItems.some(item => {
        const dim = ITEM_DIMENSIONS[item.type] || { w: 200, h: 200 };
        return (x < item.x + dim.w + buffer && x + w + buffer > item.x && y < item.y + dim.h + buffer && y + h + buffer > item.y);
    });
  };

  const findFreePosition = (preferredX: number, preferredY: number, type: ComponentType, currentItems: IBoardItem[], initialRadius = 0) => {
    const dim = ITEM_DIMENSIONS[type];
    if (!hasCollision(preferredX, preferredY, dim.w, dim.h, currentItems)) return { x: preferredX, y: preferredY };

    for (let i = 1; i < 50; i++) {
        const angle = i * 0.5 + Math.random();
        const dist = initialRadius + (i * 20);
        const testX = preferredX + Math.cos(angle) * dist;
        const testY = preferredY + Math.sin(angle) * dist;
        if (testX < 0 || testY < 0 || testX > boardSize.width - dim.w || testY > boardSize.height - dim.h) continue;
        if (!hasCollision(testX, testY, dim.w, dim.h, currentItems)) return { x: testX, y: testY };
    }
    return { x: preferredX + 50, y: preferredY + 50 };
  };

  const addItem = (type: ComponentType) => {
    const centerX = boardSize.width / 2 - 100;
    const centerY = boardSize.height / 2 - 100;
    const pos = findFreePosition(centerX, centerY, type, items, 50);

    const newItem: IBoardItem = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      text: type === ComponentType.TASK ? 'New Task' : type === ComponentType.OBJECTIVE ? 'New Objective' : type === ComponentType.IDEA ? 'New Idea' : 'Goal',
      x: pos.x,
      y: pos.y,
      rotation: (Math.random() - 0.5) * 6,
      connections: [],
      color: type === ComponentType.OBJECTIVE ? ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCB77'][Math.floor(Math.random() * 4)] : undefined
    };
    setItems([...items, newItem]);
  };

  const addConnectedItem = (sourceId: string, type: ComponentType) => {
    const sourceItem = items.find(i => i.id === sourceId);
    if (!sourceItem) return;
    
    const pos = findFreePosition(sourceItem.x + 50, sourceItem.y + 250, type, items, 100);
    const newItem: IBoardItem = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        text: 'New ' + type,
        x: pos.x,
        y: pos.y,
        rotation: (Math.random() - 0.5) * 4,
        connections: [],
    };
    
    // Smart connection type
    let connType = ConnectionType.DEFAULT;
    if (sourceItem.type === ComponentType.OBJECTIVE && type === ComponentType.TASK) connType = ConnectionType.CRITICAL;
    else if (sourceItem.type === ComponentType.TASK && type === ComponentType.IDEA) connType = ConnectionType.ALTERNATIVE;
    else if (type === ComponentType.GOAL) connType = ConnectionType.POSITIVE;

    setItems(prev => [...prev, newItem].map(item => item.id === sourceId ? {
        ...item,
        connections: [...item.connections, { id: Math.random().toString(36).substr(2, 9), targetId: newItem.id, type: connType, sequence: 1 }]
    } : item));
  };

  // --- Mouse / Zoom Handlers ---

  const handleZoom = (delta: number) => {
    setEditorView(prev => ({ ...prev, scale: Math.min(Math.max(0.15, prev.scale + delta), 4) }));
  };

  const startPan = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { mouseX: e.clientX, mouseY: e.clientY, viewX: editorView.x, viewY: editorView.y };
  };

  // Global Mouse Move for Pan & Tilt
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Tilt logic removed here for brevity or kept minimal if needed
      
      if (viewState === 'EDITOR') {
        if (isPanning) {
            const dx = e.clientX - panStart.current.mouseX;
            const dy = e.clientY - panStart.current.mouseY;
            setEditorView(prev => ({ ...prev, x: panStart.current.viewX + dx, y: panStart.current.viewY + dy }));
        }
        if (activeConnection && boardRef.current) {
            const rect = boardRef.current.getBoundingClientRect();
            setActiveConnection(prev => prev ? { ...prev, current: { x: (e.clientX - rect.left) / editorView.scale, y: (e.clientY - rect.top) / editorView.scale } } : null);
        }
      }
    };
    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      if (activeConnection && !isStringMode) setTimeout(() => setActiveConnection(null), 10);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, activeConnection, editorView.scale, isStringMode, viewState]);

  // --- Connection Logic ---

  const startConnection = (fromId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setActiveConnection({
      fromId,
      type: activeStringType, 
      current: { x: (e.clientX - rect.left) / editorView.scale, y: (e.clientY - rect.top) / editorView.scale }
    });
  };

  const endConnection = (toId: string) => {
    if (!activeConnection || activeConnection.fromId === toId) {
      setActiveConnection(null);
      return;
    }
    setItems(prev => {
        let maxSeq = 0;
        prev.forEach(i => i.connections.forEach(c => { if (c.type === activeConnection.type) maxSeq = Math.max(maxSeq, c.sequence); }));
        return prev.map(item => item.id === activeConnection.fromId ? {
            ...item,
            connections: [...item.connections, { id: Math.random().toString(36).substr(2, 9), targetId: toId, type: activeConnection.type, sequence: maxSeq + 1 }]
        } : item);
    });
    setActiveConnection(null);
  };

  const handleItemClick = (id: string) => {
    if (isStringMode) {
      if (!activeConnection) {
          const item = items.find(i => i.id === id);
          if (item) setActiveConnection({ fromId: id, type: activeStringType, current: { x: item.x, y: item.y } });
      } else {
          if (activeConnection.fromId === id) return;
          endConnection(id);
      }
    }
  };

  const applyLayout = (type: 'MESSY' | 'ORGANIZED' | 'STRUCTURED' | 'DIAMOND' | 'CORNERED') => {
      if (items.length === 0) return;
      const { width, height } = boardSize;
      let newItems = [...items];
      if (type === 'MESSY') newItems = layoutMessy(newItems, width, height);
      else if (type === 'ORGANIZED') newItems = layoutOrganized(newItems, width, height);
      else if (type === 'STRUCTURED') newItems = layoutStructured(newItems, width, height);
      else if (type === 'DIAMOND') newItems = layoutDiamond(newItems, width, height);
      else if (type === 'CORNERED') newItems = layoutCornered(newItems, width, height);
      setItems(newItems);
  };

  const handleItemDoubleClick = (id: string) => {
    handleEnterFocus(id);
  };

  const handleChangeConnectionColor = (newType: ConnectionType | 'DELETE') => {
    if (!contextMenu || contextMenu.type !== 'CONNECTION') return;
    const { sourceId, targetId } = contextMenu;

    setItems(prev => prev.map(item => {
        if (item.id !== sourceId) return item;
        if (newType === 'DELETE') {
            return { ...item, connections: item.connections.filter(c => c.targetId !== targetId) };
        }
        return {
            ...item,
            connections: item.connections.map(c => c.targetId === targetId ? { ...c, type: newType } : c)
        };
    }));
  };

  const toggleDragChildren = (itemId: string) => {
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, dragChildren: !item.dragChildren } : item));
  };

  const handleContextDelete = () => {
    if (!contextMenu) return;
    if (contextMenu.type === 'ITEM') {
        handleDeleteItem(contextMenu.itemId);
    }
    setContextMenu(null);
  };

  const toggleStringMode = () => {
    setIsStringMode(prev => !prev);
    setActiveConnection(null);
  };

  const handleClearBoard = () => {
    if (window.confirm("Are you sure you want to clear the board?")) {
        setItems([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const json = JSON.parse(ev.target?.result as string);
            handleLoadProject(json);
        } catch (err) {
            alert("Failed to load project file.");
        }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLoadBoardClick = () => {
    fileInputRef.current?.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        setReferenceImage(ev.target?.result as string);
        setShowReference(true);
    };
    reader.readAsDataURL(file);
    if (referenceInputRef.current) referenceInputRef.current.value = '';
  };

  // --- Render ---

  const theme = BOARD_THEMES[boardType];
  const isUIVisible = showUI && !focusedItemId && !showIntroSettings;

  const getTitleStyle = () => {
    switch (boardType) {
      case BoardType.BLACKBOARD: return "font-casual text-white/90 drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] placeholder:text-white/30";
      case BoardType.WHITEBOARD: return "font-marker text-blue-900/90 drop-shadow-[1px_1px_0px_rgba(0,0,0,0.1)] placeholder:text-blue-900/30";
      case BoardType.BLUEPRINT: return "font-mono text-blue-100/90 tracking-[0.5em] uppercase drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] placeholder:text-blue-100/30";
      default: return "font-marker text-black/80 rotate-1 drop-shadow-[1px_1px_0px_rgba(255,255,255,0.2)] placeholder:text-black/20";
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <RoomEnvironment quality={graphicsQuality}>
        
        {/* VIEW 1: DASHBOARD */}
        {viewState === 'DASHBOARD' && (
            <Dashboard 
                quality={graphicsQuality} 
                onNewProject={handleStartNewProject}
                onLoadProject={handleLoadProject}
                recentProjects={recentProjects}
                onOpenSettings={() => setShowIntroSettings(true)}
            />
        )}

        {/* VIEW 2: EDITOR */}
        {viewState === 'EDITOR' && (
            <div 
            ref={boardRef}
            onMouseDown={startPan}
            onClick={(e) => { if(isStringMode) setActiveConnection(null); if(focusedItemId) handleExitFocus(); }}
            onWheel={(e) => handleZoom(-e.deltaY * 0.001)}
            className={`relative ${theme.bg} transition-shadow duration-700 ease-in-out shrink-0 rounded-2xl border-[16px] ${theme.border} ${isViewAnimating ? 'transition-transform duration-700' : ''}`}
            style={{
                width: boardSize.width,
                height: boardSize.height,
                transformStyle: graphicsQuality === 'LOW' ? 'flat' : 'preserve-3d',
                transform: `translate(${editorView.x}px, ${editorView.y}px) scale(${editorView.scale})`,
                cursor: isStringMode ? 'crosshair' : (isPanning ? 'grabbing' : 'grab'),
                boxShadow: graphicsQuality === 'LOW' ? 'none' : '0 50px 100px -20px rgba(0,0,0,0.8), inset 0 0 100px rgba(0,0,0,0.5)', 
                transformOrigin: '50% 50%' 
            }}
            >
            {/* Board Content (Lamp, Overlay, Items) */}
            {graphicsQuality !== 'LOW' && (
                <div className="absolute -top-[350px] left-1/2 -translate-x-1/2 z-[60] pointer-events-none preserve-3d flex flex-col items-center">
                    <div className="w-1 h-80 bg-black shadow-xl"></div>
                    <div className="w-[450px] h-40 bg-zinc-950 rounded-t-[225px] shadow-[0_10px_30px_rgba(0,0,0,1)] relative z-20">
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800/50"></div>
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-60 h-20 bg-yellow-50 rounded-full blur-[20px] opacity-80"></div>
                    </div>
                    <div className="absolute top-[320px] left-1/2 -translate-x-1/2 w-[2800px] h-[2800px] bg-[radial-gradient(circle,rgba(255,250,230,0.15)_0%,rgba(0,0,0,0)_60%)] pointer-events-none mix-blend-overlay blur-3xl z-10"></div>
                </div>
            )}

            <div className="absolute top-[200px] left-0 w-full flex justify-center z-20 pointer-events-none">
                <input
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()} 
                    className={`bg-transparent border-none text-center text-8xl focus:outline-none w-3/4 max-w-5xl transition-all duration-500 pointer-events-auto ${getTitleStyle()}`}
                    placeholder="UNTITLED PROJECT"
                    spellCheck={false}
                />
            </div>

            {!graphicsQuality.includes('LOW') && <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)] pointer-events-none z-0"></div>}
            
            <div 
                className={`absolute inset-0 pointer-events-none ${graphicsQuality === 'LOW' ? 'opacity-20' : 'opacity-70'}`} 
                style={{ backgroundImage: theme.texture, backgroundSize: theme.textureSize || 'auto', mixBlendMode: graphicsQuality === 'LOW' ? 'normal' : 'multiply' }}
            />

            <div className={`transition-all duration-500 ${focusedItemId ? 'blur-sm opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
                <ConnectionLines items={items} activeConnection={activeConnection} onConnectionContextMenu={(e,s,t) => setContextMenu({type:'CONNECTION',x:e.clientX,y:e.clientY,sourceId:s,targetId:t})} quality={graphicsQuality} />
            </div>

            {items.map(item => (
                <BoardItem 
                key={item.id} 
                item={item} 
                scale={editorView.scale}
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
                onContextMenu={(id, e) => setContextMenu({type:'ITEM',x:e.clientX,y:e.clientY,itemId:id})}
                isFocused={focusedItemId === item.id}
                isBlurred={focusedItemId !== null && focusedItemId !== item.id}
                onAddRelated={addConnectedItem}
                onExitFocus={handleExitFocus}
                quality={graphicsQuality}
                />
            ))}

            {graphicsQuality !== 'LOW' && <div className={`absolute inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-500 pointer-events-none ${focusedItemId ? 'opacity-100' : 'opacity-0'}`} />}
            </div>
        )}

      </RoomEnvironment>

      {/* --- SHARED OVERLAYS (Settings, Context Menu) --- */}

      {/* Start-up Graphics Settings Modal */}
      {showIntroSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-[2px] bg-black/40 animate-in fade-in duration-500">
            <div className="bg-zinc-950/90 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col gap-4">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <Monitor className="text-zinc-400" size={24} />
                    <h1 className="text-xl font-bold text-white tracking-wide">Graphics Configuration</h1>
                </div>
                <p className="text-sm text-zinc-400">Select a preset to preview performance.</p>
                <div className="flex flex-col gap-2">
                     <button onClick={() => setGraphicsQuality('HIGH')} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${graphicsQuality === 'HIGH' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-black/20 border-white/5 text-zinc-400 hover:bg-white/5'}`}>
                        <div className="flex items-center gap-3"><Sparkles size={18} /><div className="text-left"><div className="font-bold text-sm">High (Cinematic)</div><div className="text-[10px] opacity-70">High-end PCs & Desktops</div></div></div>{graphicsQuality === 'HIGH' && <Check size={16} />}
                     </button>
                     <button onClick={() => setGraphicsQuality('MEDIUM')} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${graphicsQuality === 'MEDIUM' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-black/20 border-white/5 text-zinc-400 hover:bg-white/5'}`}>
                        <div className="flex items-center gap-3"><Laptop size={18} /><div className="text-left"><div className="font-bold text-sm">Medium (Balanced)</div><div className="text-[10px] opacity-70">Mid-range PCs & Laptops</div></div></div>{graphicsQuality === 'MEDIUM' && <Check size={16} />}
                     </button>
                     <button onClick={() => setGraphicsQuality('LOW')} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${graphicsQuality === 'LOW' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' : 'bg-black/20 border-white/5 text-zinc-400 hover:bg-white/5'}`}>
                        <div className="flex items-center gap-3"><Zap size={18} /><div className="text-left"><div className="font-bold text-sm">Low (Performance)</div><div className="text-[10px] opacity-70">Low-end PCs & Older Laptops</div></div></div>{graphicsQuality === 'LOW' && <Check size={16} />}
                     </button>
                </div>
                <button onClick={() => { setShowIntroSettings(false); setEditorView(prev => ({ ...prev, scale: 0.6 })); }} className="mt-2 w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2">Confirm Settings</button>
            </div>
        </div>
      )}

      {/* Context Menu (Only visible in EDITOR) */}
      {viewState === 'EDITOR' && contextMenu && (
        <div 
          className="fixed z-[100] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl flex flex-col gap-1 min-w-[160px] no-print"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'CONNECTION' ? (
             <>
               <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-2 py-1">Change String</div>
               <button onClick={() => {handleChangeConnectionColor(ConnectionType.CRITICAL); setContextMenu(null);}} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-200 text-xs"><div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" /> Critical</button>
               <button onClick={() => {handleChangeConnectionColor(ConnectionType.POSITIVE); setContextMenu(null);}} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-200 text-xs"><div className="w-3 h-3 rounded-full bg-green-500 shadow-sm" /> Positive</button>
               <button onClick={() => {handleChangeConnectionColor(ConnectionType.ALTERNATIVE); setContextMenu(null);}} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-200 text-xs"><div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" /> Alternative</button>
               <button onClick={() => {handleChangeConnectionColor(ConnectionType.DEFAULT); setContextMenu(null);}} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-200 text-xs"><div className="w-3 h-3 rounded-full bg-zinc-400 shadow-sm" /> Default</button>
               <div className="h-px bg-white/10 my-1" />
               <button onClick={() => {handleChangeConnectionColor('DELETE'); setContextMenu(null);}} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors text-xs"><Trash2 size={12} /> Delete Connection</button>
             </>
          ) : (
            <>
               <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-2 py-1">Item Options</div>
               <button onClick={() => {toggleDragChildren(contextMenu.itemId); setContextMenu(null);}} className={`flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-xs ${items.find(i=>i.id===contextMenu.itemId)?.dragChildren ? 'text-blue-300 bg-blue-500/10' : 'text-zinc-200'}`}><Layers size={12} /> <span>Drag Connected Ideas</span></button>
               <div className="h-px bg-white/10 my-1" />
               <button onClick={() => {handleContextDelete();}} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors text-xs"><Trash2 size={12} /> Delete Item</button>
            </>
          )}
        </div>
      )}
      
      {/* --- EDITOR UI OVERLAYS (Only in EDITOR) --- */}
      
      {viewState === 'EDITOR' && (
      <>
        {/* Settings Button (Top Right) */}
        <div className={`absolute top-4 right-4 z-[80] flex flex-col items-end pointer-events-auto no-print ${isUIVisible ? 'opacity-100' : 'opacity-0'}`}>
            <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${showSettings ? 'bg-zinc-700 text-white' : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}><SettingsIcon size={20} /></button>
            <div className={`absolute top-[calc(100%+8px)] right-0 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl flex flex-col gap-2 min-w-[180px] transition-all duration-300 origin-top-right ${showSettings ? 'scale-100 opacity-100 visible' : 'scale-95 opacity-0 invisible'}`}>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider border-b border-white/5 pb-1 mb-1">Graphics Quality</div>
                {['HIGH', 'MEDIUM', 'LOW'].map((q) => (
                    <button key={q} onClick={() => setGraphicsQuality(q as GraphicsQuality)} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${graphicsQuality === q ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'hover:bg-white/5 text-zinc-300'}`}>
                        <span>{q === 'HIGH' ? 'High' : q === 'MEDIUM' ? 'Medium' : 'Low'}</span>{graphicsQuality === q && <Check size={12} />}
                    </button>
                ))}
            </div>
        </div>

        {/* Home / Back Button */}
        <button onClick={handleExitToDashboard} className="absolute top-4 left-4 z-[70] p-2 bg-zinc-800/80 hover:bg-zinc-700 text-white/50 hover:text-white rounded-lg transition-all no-print flex items-center gap-2 group" title="Return to Dashboard">
            <ArrowLeft size={16} /> <span className="text-xs font-mono opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto overflow-hidden transition-all duration-300">DASHBOARD</span>
        </button>

        {/* Toggle UI */}
        <button onClick={() => setShowUI(!showUI)} className="absolute top-4 left-16 z-[70] p-2 bg-zinc-800/80 hover:bg-zinc-700 text-white/50 hover:text-white rounded-lg transition-all no-print" title={showUI ? "Hide Interface" : "Show Interface"}>{showUI ? <EyeOff size={16} /> : <Eye size={16} />}</button>

        {/* Creation Tools */}
        <div className={`absolute left-10 top-16 flex flex-col space-y-4 z-50 transition-all duration-300 no-print ${isUIVisible ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none -translate-y-4'}`}>
            <div className="bg-zinc-900/95 backdrop-blur-xl p-3 rounded-2xl flex flex-col space-y-3 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
                <button onClick={() => addItem(ComponentType.OBJECTIVE)} className="p-3 bg-white/5 hover:bg-white/15 rounded-xl text-white transition-all flex items-center space-x-3 group w-full text-left"><Plus size={20} className="text-emerald-400 shrink-0" /><span className="text-sm font-medium">Add Objective</span></button>
                <button onClick={() => addItem(ComponentType.TASK)} className="p-3 bg-white/5 hover:bg-white/15 rounded-xl text-white transition-all flex items-center space-x-3 group w-full text-left"><Layout size={20} className="text-yellow-400 shrink-0" /><span className="text-sm font-medium">Add Sticky Task</span></button>
                <button onClick={() => addItem(ComponentType.IDEA)} className="p-3 bg-white/5 hover:bg-white/15 rounded-xl text-white transition-all flex items-center space-x-3 group w-full text-left"><Lightbulb size={20} className="text-orange-300 shrink-0" /><span className="text-sm font-medium">Add Idea Strip</span></button>
                <button onClick={() => addItem(ComponentType.GOAL)} className="p-3 bg-white/5 hover:bg-white/15 rounded-xl text-white transition-all flex items-center space-x-3 group w-full text-left"><Sparkles size={20} className="text-blue-400 shrink-0" /><span className="text-sm font-medium">Add Final Goal</span></button>
            </div>
            
            <div className="bg-zinc-900/95 backdrop-blur-xl p-3 rounded-2xl flex flex-col space-y-2 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider text-center pb-1 border-b border-white/5">String Spool</div>
                <div className="flex justify-between items-center px-1 pt-1 gap-2">
                    {[ConnectionType.CRITICAL, ConnectionType.POSITIVE, ConnectionType.ALTERNATIVE, ConnectionType.DEFAULT].map((t, i) => (
                        <button key={t} onClick={() => setActiveStringType(t)} className={`w-6 h-6 rounded-full shadow-sm transition-all hover:scale-110 ${activeStringType === t ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'} ${i===0?'bg-red-500':i===1?'bg-green-500':i===2?'bg-blue-500':'bg-zinc-400'}`} />
                    ))}
                </div>
                <div className="h-px bg-white/5 my-1"></div>
                <button onClick={toggleStringMode} className={`w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-2 ${isStringMode ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] border border-blue-400/30' : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white border border-transparent'}`}><Link size={14} className={isStringMode ? "animate-pulse" : ""} /><span>{isStringMode ? 'Finish Linking' : 'Start Linking'}</span></button>
            </div>

            {/* Layouts */}
            <div className="bg-zinc-900/95 backdrop-blur-xl p-3 rounded-2xl flex flex-col space-y-2 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider text-center pb-1 border-b border-white/5">Arrangement</div>
                <div className="grid grid-cols-5 gap-1 pt-1">
                    {[
                        {icon:Grid, fn:'ORGANIZED'}, {icon:Shuffle, fn:'MESSY'}, {icon:Network, fn:'STRUCTURED'}, {icon:Diamond, fn:'DIAMOND'}, {icon:LayoutTemplate, fn:'CORNERED'}
                    ].map((l, i) => (
                        <button key={i} onClick={() => applyLayout(l.fn as any)} className="p-1.5 bg-white/5 hover:bg-white/15 rounded-lg text-white transition-all flex items-center justify-center group"><l.icon size={16} className="text-zinc-400 group-hover:text-blue-400" /></button>
                    ))}
                </div>
            </div>

            {/* Design */}
            <div className="bg-zinc-900/95 backdrop-blur-xl p-3 rounded-2xl flex flex-col space-y-2 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)] transition-all duration-300">
                <button onClick={() => setIsDesignOpen(!isDesignOpen)} className="w-full flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider text-center pb-1 border-b border-white/5 hover:text-white transition-colors"><span>Planning Board Design</span>{isDesignOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>
                <div className={`grid transition-all duration-300 ease-in-out ${isDesignOpen ? 'grid-rows-[1fr] opacity-100 pt-1' : 'grid-rows-[0fr] opacity-0 py-0'}`}>
                    <div className="overflow-hidden flex flex-col space-y-1">
                        {Object.entries(BOARD_THEMES).map(([type, t]) => (
                            <button key={type} onClick={() => setBoardType(type as BoardType)} className={`p-2 rounded-lg transition-all flex items-center justify-between group w-full text-left ${boardType === type ? 'bg-white/20 text-white shadow-inner' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}><span className="text-xs font-medium">{t.label}</span>{boardType === type && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]" />}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Files */}
            <div className="bg-zinc-900/95 backdrop-blur-xl p-3 rounded-2xl flex flex-col space-y-2 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
                <div className="flex flex-row space-x-2">
                    <button onClick={handleStartNewProject} className="flex-1 py-2 bg-white/5 hover:bg-white/15 rounded-lg text-white transition-all flex items-center justify-center gap-2 group"><FilePlus size={16} className="text-zinc-400 group-hover:text-emerald-400" /><span className="text-xs font-medium text-zinc-400 group-hover:text-white">New</span></button>
                    <button onClick={handleClearBoard} className="flex-1 py-2 bg-white/5 hover:bg-white/15 rounded-lg text-white transition-all flex items-center justify-center gap-2 group"><Eraser size={16} className="text-zinc-400 group-hover:text-red-400" /><span className="text-xs font-medium text-zinc-400 group-hover:text-white">Clear</span></button>
                </div>
                <div className="h-px bg-white/5 my-1"></div>
                <div className="flex flex-row space-x-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                    <button onClick={handleSaveBoard} className="flex-1 py-2 bg-white/5 hover:bg-white/15 rounded-lg text-white transition-all flex items-center justify-center gap-2 group"><Download size={16} className="text-zinc-400 group-hover:text-blue-400" /><span className="text-xs font-medium text-zinc-400 group-hover:text-white">Save</span></button>
                    <button onClick={handleLoadBoardClick} className="flex-1 py-2 bg-white/5 hover:bg-white/15 rounded-lg text-white transition-all flex items-center justify-center gap-2 group"><Upload size={16} className="text-zinc-400 group-hover:text-amber-400" /><span className="text-xs font-medium text-zinc-400 group-hover:text-white">Load</span></button>
                </div>
                <button onClick={handlePrint} className="w-full py-2 bg-white/5 hover:bg-white/15 rounded-lg text-white transition-all flex items-center justify-center gap-2 group"><Printer size={16} className="text-zinc-400 group-hover:text-purple-400" /><span className="text-xs font-medium text-zinc-400 group-hover:text-white">Print / PDF</span></button>
            </div>
        </div>

        {/* Reference Image */}
        <div className={`absolute right-6 top-1/2 -translate-y-1/2 z-[60] flex flex-col items-end pointer-events-none no-print ${isUIVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div className="pointer-events-auto relative flex flex-col items-end"> 
                <button onClick={() => { if (!referenceImage) referenceInputRef.current?.click(); else setShowReference(!showReference); }} className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.5)] transition-all duration-300 ${showReference && referenceImage ? 'bg-amber-500 text-black rotate-0' : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}><ImageIcon size={22} /></button>
                <input type="file" ref={referenceInputRef} onChange={handleReferenceUpload} className="hidden" accept="image/*" />
                <div className={`absolute right-[calc(100%+16px)] top-1/2 -translate-y-1/2 transition-all duration-500 origin-right ${showReference && referenceImage ? 'translate-x-0 opacity-100 scale-100 visible' : 'translate-x-20 opacity-0 scale-95 invisible'}`}>
                    <div className="bg-zinc-900/95 backdrop-blur-md p-2 rounded-xl border border-white/10 shadow-2xl relative group w-[300px] md:w-[400px]">
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button onClick={() => setShowReference(false)} className="p-1.5 bg-black/60 text-white rounded-lg hover:bg-zinc-600 backdrop-blur-sm"><ChevronRight size={14} /></button>
                            <button onClick={() => referenceInputRef.current?.click()} className="p-1.5 bg-black/60 text-white rounded-lg hover:bg-blue-600 backdrop-blur-sm"><Upload size={14} /></button>
                            <button onClick={() => { setReferenceImage(null); setShowReference(false); }} className="p-1.5 bg-black/60 text-white rounded-lg hover:bg-red-600 backdrop-blur-sm"><Trash2 size={14} /></button>
                        </div>
                        <div className="overflow-y-auto max-h-[70vh] rounded-lg custom-scrollbar bg-black/20"><img src={referenceImage || ''} alt="Reference" className="w-full h-auto block" /></div>
                    </div>
                </div>
            </div>
        </div>

        {/* Zoom Controls */}
        <div className={`absolute right-10 bottom-10 flex flex-col space-y-3 z-50 transition-all duration-300 no-print ${isUIVisible ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none translate-y-4'}`}>
            <div className="bg-zinc-900/95 backdrop-blur-xl p-2 rounded-full flex flex-col items-center space-y-2 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
                <button onClick={() => handleZoom(0.1)} className="p-3 bg-white/5 hover:bg-white/20 rounded-full text-white transition-all active:scale-95"><ZoomIn size={20} /></button>
                <button onClick={() => setEditorView({ x: 0, y: 0, scale: 0.6 })} className="p-3 bg-white/5 hover:bg-white/20 rounded-full text-white transition-all active:scale-95"><Maximize size={20} /></button>
                <button onClick={() => handleZoom(-0.1)} className="p-3 bg-white/5 hover:bg-white/20 rounded-full text-white transition-all active:scale-95"><ZoomOut size={20} /></button>
                <div className="text-[10px] text-zinc-500 font-mono py-1">{Math.round(editorView.scale * 100)}%</div>
            </div>
        </div>

        <div className={`absolute top-6 left-1/2 -translate-x-1/2 text-white/30 text-[10px] uppercase tracking-[0.2em] font-mono pointer-events-none select-none transition-opacity duration-300 no-print ${isUIVisible ? 'opacity-100' : 'opacity-0'}`}>Drag background to pan • Wheel to zoom • Select string color to connect</div>
      </>
      )}

    </div>
  );
};

export default App;