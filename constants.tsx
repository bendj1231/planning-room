
import React from 'react';
import { BoardType, ConnectionType, ComponentType } from './types';

export const BOARD_THEMES = {
  [BoardType.CARDBOARD]: {
    bg: 'bg-[#6d4c33]',
    texture: 'url("https://www.transparenttextures.com/patterns/cardboard.png")',
    border: 'border-[#4a3728]',
    itemShadow: 'shadow-[10px_20px_40px_rgba(0,0,0,0.6)]',
    label: 'Vintage Cardboard'
  },
  [BoardType.WHITEBOARD]: {
    bg: 'bg-[#f4f7f6]',
    texture: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(200,210,220,0.1) 100%)',
    border: 'border-slate-400',
    itemShadow: 'shadow-[5px_15px_30px_rgba(0,0,0,0.2)]',
    label: 'Studio White'
  },
  [BoardType.BLACKBOARD]: {
    bg: 'bg-[#121212]',
    texture: 'url("https://www.transparenttextures.com/patterns/chalkboard.png")',
    border: 'border-zinc-800',
    itemShadow: 'shadow-[15px_30px_60px_rgba(0,0,0,0.8)]',
    label: 'Slate Blackboard'
  },
  [BoardType.BLUEPRINT]: {
    bg: 'bg-[#0a2e5c]',
    texture: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
    textureSize: '40px 40px',
    border: 'border-blue-950',
    itemShadow: 'shadow-[10px_20px_40px_rgba(0,0,0,0.5)]',
    label: 'Blueprint Grid'
  }
};

export const ITEM_DIMENSIONS = {
  [ComponentType.OBJECTIVE]: { w: 208, h: 144 },
  [ComponentType.TASK]: { w: 176, h: 176 },
  [ComponentType.IDEA]: { w: 240, h: 64 },
  [ComponentType.GOAL]: { w: 224, h: 160 }
};

export const INITIAL_ITEMS = [
  {
    id: 'obj-1',
    type: 'OBJECTIVE' as const,
    text: 'Architect New Reality',
    x: 1500, 
    y: 900, 
    rotation: -3,
    color: '#ff8a65',
    connections: [{ id: 'init-c1', targetId: 'task-1', type: ConnectionType.DEFAULT, sequence: 1 }]
  },
  {
    id: 'task-1',
    type: 'TASK' as const,
    text: 'Refine 3D Spatial Geometry',
    x: 1800,
    y: 1050,
    rotation: 2,
    connections: [{ id: 'init-c2', targetId: 'goal-1', type: ConnectionType.POSITIVE, sequence: 1 }]
  },
  {
    id: 'goal-1',
    type: 'GOAL' as const,
    text: 'V1.0 System Deployment',
    x: 2150,
    y: 1150,
    rotation: 1,
    connections: []
  }
];
