
import { BoardItem, ComponentType } from '../types';
import { ITEM_DIMENSIONS } from '../constants';

// --- Collision Helpers ---

const hasOverlap = (x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number, padding = 0) => {
    return x1 < x2 + w2 + padding && 
           x1 + w1 + padding > x2 && 
           y1 < y2 + h2 + padding && 
           y1 + h1 + padding > y2;
};

// Calculate the total bounding box of a parent and its assigned ideas
const getClusterSize = (item: BoardItem, assignedIdeas: BoardItem[]) => {
    const itemDim = ITEM_DIMENSIONS[item.type] || { w: 200, h: 200 };
    const ideaDim = ITEM_DIMENSIONS[ComponentType.IDEA];
    
    // Width is max of parent or idea (plus some buffer)
    const w = Math.max(itemDim.w, ideaDim.w);
    
    // Height is parent height + all ideas stacked + gaps
    const ideasHeight = assignedIdeas.length * (ideaDim.h + 10);
    const h = itemDim.h + ideasHeight + 40; // Extra buffer

    return { w, h };
};

// Title Box Definition (approximate area of the title input)
const getTitleBox = (boardWidth: number) => ({
    x: boardWidth / 2 - 600, // Centered, 1200px wide
    y: 150,                  // Top area
    w: 1200,
    h: 300                   // Clear area for title
});

// --- Assignment Logic ---

const getIdeaAssignments = (items: BoardItem[]) => {
    const assignments = new Map<string, string[]>(); // ParentID -> IdeaID[]
    const itemMap = new Map(items.map(i => [i.id, i]));
    const visited = new Set<string>();

    const incomingMap: Record<string, string[]> = {};
    items.forEach(item => {
        item.connections.forEach(c => {
            if (!incomingMap[c.targetId]) incomingMap[c.targetId] = [];
            incomingMap[c.targetId].push(item.id);
        });
    });

    const anchors = items.filter(i => i.type !== ComponentType.IDEA);
    anchors.sort((a, b) => {
        const order = { [ComponentType.TASK]: 0, [ComponentType.OBJECTIVE]: 1, [ComponentType.GOAL]: 2, [ComponentType.IDEA]: 3 };
        return (order[a.type] || 9) - (order[b.type] || 9);
    });

    const queue: string[] = [];
    anchors.forEach(a => {
        queue.push(a.id);
        visited.add(a.id);
        assignments.set(a.id, []);
    });

    while (queue.length > 0) {
        const parentId = queue.shift()!;
        const potentialChildren = new Set<string>();
        const parent = itemMap.get(parentId);
        if (!parent) continue;

        parent.connections.forEach(c => potentialChildren.add(c.targetId));
        if (incomingMap[parentId]) {
            incomingMap[parentId].forEach(sid => potentialChildren.add(sid));
        }

        potentialChildren.forEach(childId => {
            const child = itemMap.get(childId);
            if (child && child.type === ComponentType.IDEA && !visited.has(childId)) {
                visited.add(childId);
                const list = assignments.get(parentId);
                if (list) list.push(childId);
                else {
                    // If parent is an IDEA, find its anchor
                    let anchorId: string | null = null;
                    for (const [aid, ideas] of assignments.entries()) {
                        if (ideas.includes(parentId)) {
                            anchorId = aid;
                            break;
                        }
                    }
                    if (anchorId) assignments.get(anchorId)?.push(childId);
                }
                queue.push(childId);
            }
        });
    }
    return assignments;
};


// Helper: Position ideas strictly under their parents
const attachIdeasToParents = (items: BoardItem[]): BoardItem[] => {
    const assignments = getIdeaAssignments(items);
    const itemMap = new Map(items.map(i => [i.id, { ...i }]));

    assignments.forEach((ideaIds, parentId) => {
        const parent = itemMap.get(parentId);
        if (!parent) return;

        const parentDim = ITEM_DIMENSIONS[parent.type] || { w: 200, h: 200 };
        const ideaDim = ITEM_DIMENSIONS[ComponentType.IDEA];

        ideaIds.forEach((childId, index) => {
            const child = itemMap.get(childId);
            if (!child) return;

            const newX = parent.x + (parentDim.w - ideaDim.w) / 2 + (Math.random() - 0.5) * 4;
            const newY = parent.y + parentDim.h + 15 + (index * (ideaDim.h + 8));

            itemMap.set(childId, {
                ...child,
                x: newX,
                y: newY,
                rotation: (Math.random() - 0.5) * 3
            });
        });
    });

    return Array.from(itemMap.values());
};

// --- Smart Placement Helper ---

const placeItemSmart = (
    item: BoardItem, 
    preferredX: number, 
    preferredY: number, 
    items: BoardItem[], 
    assignments: Map<string, string[]>, 
    placedBoxes: { x: number, y: number, w: number, h: number }[],
    boardW: number,
    boardH: number
) => {
    const assignedIdeas = (assignments.get(item.id) || []).map(id => items.find(x => x.id === id)!);
    const cluster = getClusterSize(item, assignedIdeas);
    
    let x = preferredX;
    let y = preferredY;
    let attempts = 0;
    let found = false;
    
    while (!found && attempts < 150) {
        const overlap = placedBoxes.some(box => hasOverlap(x, y, cluster.w, cluster.h, box.x, box.y, box.w, box.h, 60)); // 60px padding
        if (!overlap) {
            found = true;
        } else {
            attempts++;
            const angle = attempts * 0.6;
            const radius = attempts * 40;
            x = preferredX + Math.cos(angle) * radius;
            y = preferredY + Math.sin(angle) * radius;
            
            x = Math.max(100, Math.min(boardW - cluster.w - 100, x));
            y = Math.max(100, Math.min(boardH - cluster.h - 100, y));
        }
    }
    
    placedBoxes.push({ x, y, w: cluster.w, h: cluster.h });
    return { ...item, x, y, rotation: (Math.random() - 0.5) * 8 };
};

// --- Layout Functions ---

export const layoutMessy = (items: BoardItem[], w: number, h: number) => {
  const mainItems = items.filter(i => i.type !== ComponentType.IDEA);
  const ideas = items.filter(i => i.type === ComponentType.IDEA);
  const assignments = getIdeaAssignments(items);
  
  // Initialize with Title Box to avoid collision
  const placedBoxes: { x: number, y: number, w: number, h: number }[] = [getTitleBox(w)];

  const padding = 200;
  
  const placedMain = mainItems.map(item => {
      // Random preferred position
      const px = padding + Math.random() * (w - padding * 2 - 200);
      const py = padding + Math.random() * (h - padding * 2 - 200);
      return placeItemSmart(item, px, py, items, assignments, placedBoxes, w, h);
  });

  return attachIdeasToParents([...placedMain, ...ideas]);
};

export const layoutOrganized = (items: BoardItem[], w: number, h: number) => {
    const mainItems = items.filter(i => i.type !== ComponentType.IDEA);
    const ideas = items.filter(i => i.type === ComponentType.IDEA);
    const assignments = getIdeaAssignments(items);

    // Sort order: Objective -> Task -> Goal
    // This ensures that in a left-to-right grid flow, Goals appear at the end.
    const typeOrder = [ComponentType.OBJECTIVE, ComponentType.TASK, ComponentType.GOAL];
    const sorted = [...mainItems].sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
    
    // Dynamic Grid
    const startX = 200;
    let currentX = startX;
    
    // Start lower to avoid Title overlap (Title is approx at y=200, height 150-200)
    let currentY = 500; 
    
    let rowMaxH = 0;
    const gapX = 50;
    const gapY = 100;
    const maxRowWidth = w - 400;

    const placedMain = sorted.map((item, i) => {
        const assignedIdeas = (assignments.get(item.id) || []).map(id => items.find(x => x.id === id)!);
        const cluster = getClusterSize(item, assignedIdeas);
        
        // Check if item fits in current row
        if (currentX + cluster.w > startX + maxRowWidth) {
            currentX = startX;
            currentY += rowMaxH + gapY;
            rowMaxH = 0;
        }

        const x = currentX;
        const y = currentY;

        currentX += cluster.w + gapX;
        rowMaxH = Math.max(rowMaxH, cluster.h);

        return {
            ...item,
            x,
            y,
            rotation: 0
        };
    });

    return attachIdeasToParents([...placedMain, ...ideas]);
};

export const layoutStructured = (items: BoardItem[], w: number, h: number) => {
    const mainItems = items.filter(i => i.type !== ComponentType.IDEA);
    const ideas = items.filter(i => i.type === ComponentType.IDEA);
    const assignments = getIdeaAssignments(items);

    // Calculate levels using Longest Path (to ensure dependencies flow correctly left-to-right)
    const nodeLevels = new Map<string, number>();
    mainItems.forEach(i => nodeLevels.set(i.id, 0));

    // Bellman-Ford-ish relaxation for longest path
    // Max iterations = num items to prevent infinite loops on cycles
    for (let i = 0; i < mainItems.length; i++) {
        let changed = false;
        mainItems.forEach(item => {
            const currentLvl = nodeLevels.get(item.id) || 0;
            item.connections.forEach(conn => {
                const targetId = conn.targetId;
                if (mainItems.some(m => m.id === targetId)) {
                    const targetLvl = nodeLevels.get(targetId) || 0;
                    if (targetLvl < currentLvl + 1) {
                        nodeLevels.set(targetId, currentLvl + 1);
                        changed = true;
                    }
                }
            });
        });
        if (!changed) break;
    }

    // Group by level
    const levels: Record<number, string[]> = {};
    nodeLevels.forEach((lvl, id) => {
        if (!levels[lvl]) levels[lvl] = [];
        levels[lvl].push(id);
    });

    // Horizontal Layout Config
    const centerY = h / 2;
    const levelSpacing = 450; // Horizontal spacing
    const itemGapY = 100; // Vertical spacing within level
    const startX = 200;

    let placedMain = [...mainItems];
    const sortedLevels = Object.keys(levels).map(Number).sort((a, b) => a - b);

    sortedLevels.forEach(lvl => {
        const ids = levels[lvl];
        
        // Calculate total height of this column
        let columnHeight = 0;
        const itemDims = ids.map(id => {
            const item = items.find(i => i.id === id)!;
            const assignedIdeas = (assignments.get(item.id) || []).map(x => items.find(y => y.id === x)!);
            const cluster = getClusterSize(item, assignedIdeas);
            columnHeight += cluster.h;
            return { id, h: cluster.h, w: cluster.w };
        });
        columnHeight += (ids.length - 1) * itemGapY;

        // Determine Y start for this column to be centered
        let currentY = centerY - (columnHeight / 2);
        
        // Ensure we don't go too high into title area (Title is approx y:150-450)
        // Pushing it down if it overlaps top
        if (currentY < 450) currentY = 450; 

        const currentX = startX + (lvl * levelSpacing);

        itemDims.forEach(({ id, h, w }) => {
            const idx = placedMain.findIndex(i => i.id === id);
            if (idx !== -1) {
                placedMain[idx] = {
                    ...placedMain[idx],
                    x: currentX,
                    y: currentY,
                    rotation: (Math.random() - 0.5) * 4
                };
                currentY += h + itemGapY;
            }
        });
    });

    return attachIdeasToParents([...placedMain, ...ideas]);
};

export const layoutDiamond = (items: BoardItem[], w: number, h: number) => {
    const mainItems = items.filter(i => i.type !== ComponentType.IDEA);
    const ideas = items.filter(i => i.type === ComponentType.IDEA);
    const assignments = getIdeaAssignments(items);
    
    // Initialize with Title Box
    const placedBoxes: { x: number, y: number, w: number, h: number }[] = [getTitleBox(w)];

    if (mainItems.length === 0) return attachIdeasToParents(items);

    const connectionCount: Record<string, number> = {};
    mainItems.forEach(i => {
        i.connections.forEach(c => {
             if (mainItems.some(m => m.id === c.targetId)) {
                 connectionCount[i.id] = (connectionCount[i.id] || 0) + 1;
             }
        });
        mainItems.forEach(other => {
            if (other.connections.some(c => c.targetId === i.id)) {
                 connectionCount[i.id] = (connectionCount[i.id] || 0) + 1;
            }
        });
    });

    const centerItem = mainItems.reduce((a, b) => (connectionCount[a.id] || 0) >= (connectionCount[b.id] || 0) ? a : b);
    const centerX = w / 2 - 150;
    const centerY = h / 2 - 150;

    let placedMain = [placeItemSmart(centerItem, centerX, centerY, items, assignments, placedBoxes, w, h)];

    const others = mainItems.filter(i => i.id !== centerItem.id);
    let currentRing = 1;
    let itemsInCurrentRing = 0;
    const itemsPerRingBase = 5;

    others.forEach((item) => {
        const maxInRing = currentRing * itemsPerRingBase;
        const angle = (itemsInCurrentRing / maxInRing) * Math.PI * 2;
        const radius = currentRing * 800; 

        const preferredX = centerX + Math.cos(angle) * radius;
        const preferredY = centerY + Math.sin(angle) * radius;

        placedMain.push(placeItemSmart(item, preferredX, preferredY, items, assignments, placedBoxes, w, h));

        itemsInCurrentRing++;
        if (itemsInCurrentRing >= maxInRing) {
            currentRing++;
            itemsInCurrentRing = 0;
        }
    });

    return attachIdeasToParents([...placedMain, ...ideas]);
};

export const layoutCornered = (items: BoardItem[], w: number, h: number) => {
    const mainItems = items.filter(i => i.type !== ComponentType.IDEA);
    const ideas = items.filter(i => i.type === ComponentType.IDEA);
    const assignments = getIdeaAssignments(items);
    
    // Initialize with Title Box
    const placedBoxes: { x: number, y: number, w: number, h: number }[] = [getTitleBox(w)];

    const objectives = mainItems.filter(i => i.type === ComponentType.OBJECTIVE);
    const goals = mainItems.filter(i => i.type === ComponentType.GOAL);
    const remainder = mainItems.filter(i => i.type !== ComponentType.OBJECTIVE && i.type !== ComponentType.GOAL);

    const placedMain: BoardItem[] = [];

    // 1. Place Objectives (Center Top)
    // Center cluster around (w/2, h/2 - 200)
    if (objectives.length > 0) {
        const startY = (h / 2) - 300;
        const gap = 250;
        const totalW = objectives.length * gap;
        let currentX = (w / 2) - (totalW / 2) + (gap/2) - 100; // rough centering adjustment

        objectives.forEach(obj => {
             placedMain.push(placeItemSmart(obj, currentX, startY, items, assignments, placedBoxes, w, h));
             currentX += gap;
        });
    }

    // 2. Place Goals (Center Bottom)
    // Center cluster around (w/2, h/2 + 200)
    if (goals.length > 0) {
        const startY = (h / 2) + 150;
        const gap = 250;
        const totalW = goals.length * gap;
        let currentX = (w / 2) - (totalW / 2) + (gap/2) - 100;

        goals.forEach(goal => {
             placedMain.push(placeItemSmart(goal, currentX, startY, items, assignments, placedBoxes, w, h));
             currentX += gap;
        });
    }

    // 3. Place Remainder (Corners/Borders)
    const corners = [
        { x: 100, y: 150 }, // TL (avoiding title box overlap at very top)
        { x: w - 350, y: 150 }, // TR
        { x: w - 350, y: h - 350 }, // BR
        { x: 100, y: h - 350 } // BL
    ];

    remainder.forEach((item, index) => {
        const corner = corners[index % 4];
        // Add a little jitter so they don't all start seeking from exact same pixel
        const jitterX = (Math.random() - 0.5) * 100;
        const jitterY = (Math.random() - 0.5) * 100;
        
        placedMain.push(placeItemSmart(item, corner.x + jitterX, corner.y + jitterY, items, assignments, placedBoxes, w, h));
    });

    return attachIdeasToParents([...placedMain, ...ideas]);
};
