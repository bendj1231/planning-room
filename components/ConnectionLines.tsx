
import React, { useState } from 'react';
import { BoardItem, Point, ConnectionType, ComponentType } from '../types';

interface ConnectionLinesProps {
  items: BoardItem[];
  activeConnection: { fromId: string; current: Point; type: ConnectionType } | null;
  onConnectionContextMenu?: (e: React.MouseEvent, sourceId: string, targetId: string) => void;
}

const COLORS = {
  [ConnectionType.DEFAULT]: { stroke: 'rgba(0,0,0,0.35)', fill: 'rgba(0,0,0,0.6)', marker: 'arrowhead-default' },
  [ConnectionType.CRITICAL]: { stroke: '#ef4444', fill: '#ef4444', marker: 'arrowhead-critical' }, // Red
  [ConnectionType.POSITIVE]: { stroke: '#22c55e', fill: '#22c55e', marker: 'arrowhead-positive' }, // Green
  [ConnectionType.ALTERNATIVE]: { stroke: '#3b82f6', fill: '#3b82f6', marker: 'arrowhead-alternative' }, // Blue
};

// Helper to get center point based on component dimensions
const getItemCenter = (item: BoardItem) => {
  switch (item.type) {
    case ComponentType.OBJECTIVE: // w-52 (208px) h-36 (144px)
      return { x: item.x + 104, y: item.y + 72 };
    case ComponentType.TASK: // w-44 (176px) h-44 (176px)
      return { x: item.x + 88, y: item.y + 88 };
    case ComponentType.IDEA: // w-60 (240px) h-16 (64px)
      return { x: item.x + 120, y: item.y + 32 };
    case ComponentType.GOAL: // w-56 (224px) h-40 (160px)
      return { x: item.x + 112, y: item.y + 80 };
    default:
      return { x: item.x + 90, y: item.y + 75 };
  }
};

export const ConnectionLines: React.FC<ConnectionLinesProps> = ({ items, activeConnection, onConnectionContextMenu }) => {
  const [hoveredConnId, setHoveredConnId] = useState<string | null>(null);

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-0">
      <defs>
        <filter id="line-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="2" dy="3" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        {/* Markers for each connection type */}
        <marker id="arrowhead-default" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="rgba(0,0,0,0.5)" />
        </marker>
        <marker id="arrowhead-critical" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
        </marker>
        <marker id="arrowhead-positive" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
        </marker>
        <marker id="arrowhead-alternative" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
        </marker>

        {/* Big Arrow Marker for Hover Effect */}
        <marker id="arrowhead-hover" markerWidth="14" markerHeight="10" refX="12" refY="5" orient="auto">
            <polygon points="0 0, 14 5, 0 10" fill="white" stroke="black" strokeWidth="1" />
        </marker>
      </defs>
      
      {/* Existing Connections */}
      {items.map(item => 
        item.connections.map((conn) => {
          const target = items.find(i => i.id === conn.targetId);
          if (!target) return null;

          // Detect parallel connections to avoid overlap
          const siblings = item.connections.filter(c => c.targetId === conn.targetId);
          const siblingIndex = siblings.findIndex(c => c.id === conn.id);
          
          // Vary the hanging depth based on index to separate parallel lines
          // Base depth 30, increases by 25 for each subsequent string
          const curveOffset = 30 + (siblingIndex * 25);

          const start = getItemCenter(item);
          const end = getItemCenter(target);

          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const controlPointX = start.x + dx / 2;
          // Apply variable offset
          const controlPointY = start.y + dy / 2 + curveOffset;

          const style = COLORS[conn.type] || COLORS[ConnectionType.DEFAULT];
          const pathD = `M ${start.x} ${start.y} Q ${controlPointX} ${controlPointY} ${end.x} ${end.y}`;

          const isHovered = hoveredConnId === conn.id;

          // Midpoint calculation for Badge
          const t = 0.5;
          const invT = 1 - t;
          const midX = invT * invT * start.x + 2 * invT * t * controlPointX + t * t * end.x;
          const midY = invT * invT * start.y + 2 * invT * t * controlPointY + t * t * end.y;

          // Angle for arrow at midpoint
          const dX = 2 * invT * (controlPointX - start.x) + 2 * t * (end.x - controlPointX);
          const dY = 2 * invT * (controlPointY - start.y) + 2 * t * (end.y - controlPointY);
          const angle = Math.atan2(dY, dX) * (180 / Math.PI);

          return (
            <React.Fragment key={conn.id || `${item.id}-${conn.targetId}`}>
              {/* Invisible Hit Area (Thicker) */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth="30"
                className="pointer-events-auto cursor-pointer hover:stroke-black/0 transition-colors z-20"
                onContextMenu={(e) => {
                  e.preventDefault();
                  onConnectionContextMenu?.(e, item.id, conn.targetId);
                }}
                onMouseEnter={() => setHoveredConnId(conn.id)}
                onMouseLeave={() => setHoveredConnId(null)}
              />
              
              {/* Visible Line */}
              <path
                d={pathD}
                fill="none"
                stroke={isHovered ? style.fill : style.stroke}
                strokeWidth={isHovered ? 4 : 3}
                strokeDasharray={conn.type === ConnectionType.DEFAULT ? "8 4" : "none"}
                markerEnd={`url(#${style.marker})`}
                filter="url(#line-shadow)"
                className="pointer-events-none transition-all duration-200"
              />

              {/* Hover Extras: Start Dot, Sequence Badge, Mid-Arrow */}
              {isHovered && (
                <g className="pointer-events-none animate-in fade-in duration-200">
                    {/* Start Dot */}
                    <circle cx={start.x} cy={start.y} r="5" fill={style.fill} stroke="white" strokeWidth="2" />
                    
                    {/* Badge Group at Midpoint */}
                    <g transform={`translate(${midX}, ${midY})`}>
                         {/* Connection Direction Arrow on line */}
                         <path 
                           d="M -8 -4 L 4 0 L -8 4" 
                           fill="none" 
                           stroke={style.fill} 
                           strokeWidth="3" 
                           strokeLinecap="round" 
                           strokeLinejoin="round"
                           transform={`rotate(${angle}) translate(24, 0)`} 
                           className="opacity-80"
                         />

                        {/* Number Badge */}
                        <circle cx="0" cy="0" r="14" fill={style.fill} stroke="white" strokeWidth="2" className="shadow-lg" />
                        <text 
                          x="0" 
                          y="1" 
                          textAnchor="middle" 
                          dominantBaseline="middle" 
                          fill="white" 
                          fontSize="12" 
                          fontWeight="bold"
                          className="font-mono"
                        >
                          {conn.sequence || '#'}
                        </text>
                    </g>
                </g>
              )}
            </React.Fragment>
          );
        })
      )}

      {/* Active Dragging Connection */}
      {activeConnection && (() => {
        const source = items.find(i => i.id === activeConnection.fromId);
        if (!source) return null;

        const start = getItemCenter(source);
        const endX = activeConnection.current.x;
        const endY = activeConnection.current.y;

        const style = COLORS[activeConnection.type] || COLORS[ConnectionType.DEFAULT];

        return (
          <path
            d={`M ${start.x} ${start.y} L ${endX} ${endY}`}
            fill="none"
            stroke={style.stroke}
            strokeWidth="3"
            strokeDasharray="4 4"
            markerEnd={`url(#${style.marker})`}
            filter="url(#line-shadow)"
            className="opacity-70"
          />
        );
      })()}
    </svg>
  );
};
