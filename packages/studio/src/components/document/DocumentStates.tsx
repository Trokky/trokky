/**
 * DocumentStates - Document state management system
 * 
 * Manages document states (draft, published) and transitions between them.
 * Designed to be extensible for future states (review, archived, scheduled, etc.)
 */

export type DocumentState = 'draft' | 'published';

export interface DocumentStateDefinition {
  name: string;
  color: string;
  description: string;
  permissions: {
    read: string[];
    write: string[];
    delete: string[];
  };
  transitions: DocumentState[];
}

export interface DocumentStateTransition {
  from: DocumentState;
  to: DocumentState;
  validation?: string[];
  actions?: string[];
  confirmation?: boolean;
}

/**
 * Document States Configuration
 */
export const DocumentStates = {
  // State definitions
  states: {
    draft: {
      name: 'Draft',
      color: 'gray',
      description: 'Unpublished content, visible only to editors',
      permissions: {
        read: ['editor', 'admin'],
        write: ['editor', 'admin'],
        delete: ['admin']
      },
      transitions: ['published']
    },
    
    published: {
      name: 'Published',
      color: 'green',
      description: 'Live content visible to the public',
      permissions: {
        read: ['public', 'editor', 'admin'],
        write: ['editor', 'admin'],
        delete: ['admin']
      },
      transitions: ['draft']
    }
  } as Record<DocumentState, DocumentStateDefinition>,

  // State transition rules
  transitions: {
    publish: {
      from: 'draft' as DocumentState,
      to: 'published' as DocumentState,
      validation: ['required_fields', 'content_validation'],
      actions: ['update_publish_date', 'notify_subscribers']
    },
    
    unpublish: {
      from: 'published' as DocumentState,
      to: 'draft' as DocumentState,
      confirmation: true,
      actions: ['update_draft_date']
    }
  } as Record<string, DocumentStateTransition>,

  /**
   * Check if a state transition is allowed
   */
  canTransition(from: DocumentState, to: DocumentState): boolean {
    const state = this.states[from];
    return state ? state.transitions.includes(to) : false;
  },

  /**
   * Get available transitions from a state
   */
  getAvailableTransitions(from: DocumentState): DocumentState[] {
    const state = this.states[from];
    return state ? state.transitions : [];
  },

  /**
   * Get state definition
   */
  getState(state: DocumentState): DocumentStateDefinition | null {
    return this.states[state] || null;
  },

  /**
   * Get state color for UI
   */
  getStateColor(state: DocumentState): string {
    const stateDefinition = this.getState(state);
    return stateDefinition ? stateDefinition.color : 'gray';
  },

  /**
   * Get state display name
   */
  getStateName(state: DocumentState): string {
    const stateDefinition = this.getState(state);
    return stateDefinition ? stateDefinition.name : state;
  },

  /**
   * Check if user has permission for state action
   */
  hasPermission(state: DocumentState, action: 'read' | 'write' | 'delete', userRole: string): boolean {
    const stateDefinition = this.getState(state);
    if (!stateDefinition) return false;
    
    return stateDefinition.permissions[action].includes(userRole) || 
           stateDefinition.permissions[action].includes('public');
  },

  /**
   * Get transition validation requirements
   */
  getTransitionValidation(from: DocumentState, to: DocumentState): string[] {
    const transitionKey = `${from}_to_${to}`;
    const transition = Object.values(this.transitions).find(t => t.from === from && t.to === to);
    return transition?.validation || [];
  },

  /**
   * Check if transition requires confirmation
   */
  requiresConfirmation(from: DocumentState, to: DocumentState): boolean {
    const transition = Object.values(this.transitions).find(t => t.from === from && t.to === to);
    return transition?.confirmation || false;
  }
};

/**
 * Future Extension Point: Custom State Systems
 * 
 * This allows for future customization of state systems per schema or workspace
 */
export interface CustomStateSystem {
  states: Record<string, DocumentStateDefinition>;
  transitions: Record<string, DocumentStateTransition>;
  canTransition: (from: string, to: string) => boolean;
  getAvailableTransitions: (from: string) => string[];
}

export function createCustomStateSystem(config: {
  states: Record<string, Omit<DocumentStateDefinition, 'transitions'> & { transitions: string[] }>;
  transitions: Record<string, DocumentStateTransition>;
}): CustomStateSystem {
  return {
    states: config.states as Record<string, DocumentStateDefinition>,
    transitions: config.transitions,
    
    canTransition(from: string, to: string): boolean {
      const state = this.states[from];
      return state ? state.transitions.includes(to as any) : false;
    },
    
    getAvailableTransitions(from: string): string[] {
      const state = this.states[from];
      return state ? state.transitions as string[] : [];
    }
  };
}