import { useCallback, useState } from 'react';
import type React from 'react';
import type { PortableTextBlock } from './definition';
import { createStudioLogger } from '../../../utils/logger';

const logger = createStudioLogger('PortableTextField');

export interface DragState {
  isDragging: boolean;
  draggedBlockKey: string | null;
  dragOverBlockKey: string | null;
  dragPosition: 'before' | 'after' | null;
}

interface UsePortableTextDragOptions {
  blocksToRender: PortableTextBlock[];
  moveBlockToPosition: (blockKey: string, targetIndex: number) => void;
  fieldId?: string;
}

/**
 * Reordering blocks by dragging: which block is in flight, where it would
 * land, and the drop that commits the move.
 */
export function usePortableTextDrag({
  blocksToRender,
  moveBlockToPosition,
  fieldId,
}: UsePortableTextDragOptions) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedBlockKey: null,
    dragOverBlockKey: null,
    dragPosition: null
  });
  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, blockKey: string) => {
    logger.debug('Drag start', { fieldId, blockKey });
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', blockKey);
    
    setDragState({
      isDragging: true,
      draggedBlockKey: blockKey,
      dragOverBlockKey: null,
      dragPosition: null
    });
  }, [fieldId]);
  
  const handleDragOver = useCallback((e: React.DragEvent, targetBlockKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!dragState.isDragging || dragState.draggedBlockKey === targetBlockKey) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? 'before' : 'after';
    
    setDragState(prev => ({
      ...prev,
      dragOverBlockKey: targetBlockKey,
      dragPosition: position
    }));
  }, [dragState.isDragging, dragState.draggedBlockKey]);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear drag over state if leaving the block entirely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isLeavingBlock = (
      e.clientX < rect.left || 
      e.clientX > rect.right || 
      e.clientY < rect.top || 
      e.clientY > rect.bottom
    );
    
    if (isLeavingBlock) {
      setDragState(prev => ({
        ...prev,
        dragOverBlockKey: null,
        dragPosition: null
      }));
    }
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent, targetBlockKey: string) => {
    e.preventDefault();
    
    const draggedBlockKey = e.dataTransfer.getData('text/plain');
    if (!draggedBlockKey || draggedBlockKey === targetBlockKey) {
      setDragState({
        isDragging: false,
        draggedBlockKey: null,
        dragOverBlockKey: null,
        dragPosition: null
      });
      return;
    }
    
    const targetIndex = blocksToRender.findIndex(b => b._key === targetBlockKey);
    const dropIndex = dragState.dragPosition === 'before' ? targetIndex : targetIndex + 1;
    
    logger.debug('Drop block', { 
      fieldId, 
      draggedBlockKey, 
      targetBlockKey, 
      position: dragState.dragPosition,
      dropIndex 
    });
    
    moveBlockToPosition(draggedBlockKey, dropIndex);
    
    setDragState({
      isDragging: false,
      draggedBlockKey: null,
      dragOverBlockKey: null,
      dragPosition: null
    });
  }, [dragState.dragPosition, blocksToRender, moveBlockToPosition, fieldId]);
  
  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedBlockKey: null,
      dragOverBlockKey: null,
      dragPosition: null
    });
  }, []);
  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
