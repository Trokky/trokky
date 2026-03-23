/**
 * Heroicons Icon Library Adapter
 * Provides access to Heroicons (by Tailwind CSS)
 */

import React from 'react';
import type { IconLibraryAdapter, IconMeta } from '../definition.js';

// Heroicons Outline icons - comprehensive list
const outlineIcons: IconMeta[] = [
  // User & People
  { name: 'user', label: 'User', category: 'users', tags: ['person', 'profile', 'account'] },
  { name: 'users', label: 'Users', category: 'users', tags: ['people', 'group', 'team'] },
  { name: 'user-plus', label: 'User Plus', category: 'users', tags: ['add', 'new', 'create'] },
  { name: 'user-minus', label: 'User Minus', category: 'users', tags: ['remove', 'delete'] },
  { name: 'user-circle', label: 'User Circle', category: 'users', tags: ['avatar', 'profile'] },
  { name: 'user-group', label: 'User Group', category: 'users', tags: ['team', 'people'] },
  { name: 'identification', label: 'Identification', category: 'users', tags: ['id', 'badge', 'card'] },

  // Communication
  { name: 'envelope', label: 'Envelope', category: 'communication', tags: ['email', 'mail', 'message'] },
  { name: 'envelope-open', label: 'Envelope Open', category: 'communication', tags: ['email', 'read'] },
  { name: 'phone', label: 'Phone', category: 'communication', tags: ['call', 'telephone', 'contact'] },
  { name: 'phone-arrow-down-left', label: 'Phone Incoming', category: 'communication', tags: ['call', 'incoming'] },
  { name: 'phone-arrow-up-right', label: 'Phone Outgoing', category: 'communication', tags: ['call', 'outgoing'] },
  { name: 'phone-x-mark', label: 'Phone X Mark', category: 'communication', tags: ['call', 'missed', 'cancel'] },
  { name: 'chat-bubble-left', label: 'Chat Bubble', category: 'communication', tags: ['chat', 'message', 'comment'] },
  { name: 'chat-bubble-left-right', label: 'Chat Bubbles', category: 'communication', tags: ['chat', 'conversation'] },
  { name: 'chat-bubble-oval-left', label: 'Chat Oval', category: 'communication', tags: ['chat', 'message'] },
  { name: 'bell', label: 'Bell', category: 'communication', tags: ['notification', 'alert'] },
  { name: 'bell-alert', label: 'Bell Alert', category: 'communication', tags: ['notification', 'urgent'] },
  { name: 'bell-slash', label: 'Bell Slash', category: 'communication', tags: ['notification', 'mute'] },
  { name: 'paper-airplane', label: 'Paper Airplane', category: 'communication', tags: ['send', 'message'] },
  { name: 'inbox', label: 'Inbox', category: 'communication', tags: ['mail', 'messages'] },
  { name: 'inbox-arrow-down', label: 'Inbox Arrow Down', category: 'communication', tags: ['receive', 'download'] },
  { name: 'inbox-stack', label: 'Inbox Stack', category: 'communication', tags: ['messages', 'multiple'] },

  // Navigation & Arrows
  { name: 'home', label: 'Home', category: 'navigation', tags: ['house', 'main'] },
  { name: 'home-modern', label: 'Home Modern', category: 'navigation', tags: ['house', 'building'] },
  { name: 'arrow-right', label: 'Arrow Right', category: 'arrows', tags: ['next', 'forward'] },
  { name: 'arrow-left', label: 'Arrow Left', category: 'arrows', tags: ['back', 'previous'] },
  { name: 'arrow-up', label: 'Arrow Up', category: 'arrows', tags: ['up'] },
  { name: 'arrow-down', label: 'Arrow Down', category: 'arrows', tags: ['down'] },
  { name: 'arrow-long-right', label: 'Arrow Long Right', category: 'arrows', tags: ['next', 'continue'] },
  { name: 'arrow-long-left', label: 'Arrow Long Left', category: 'arrows', tags: ['back'] },
  { name: 'arrow-up-right', label: 'Arrow Up Right', category: 'arrows', tags: ['external', 'link'] },
  { name: 'arrow-down-tray', label: 'Arrow Down Tray', category: 'arrows', tags: ['download'] },
  { name: 'arrow-up-tray', label: 'Arrow Up Tray', category: 'arrows', tags: ['upload'] },
  { name: 'arrow-path', label: 'Arrow Path', category: 'arrows', tags: ['refresh', 'reload', 'sync'] },
  { name: 'arrow-uturn-left', label: 'Arrow U-Turn Left', category: 'arrows', tags: ['undo', 'back'] },
  { name: 'arrow-uturn-right', label: 'Arrow U-Turn Right', category: 'arrows', tags: ['redo', 'forward'] },
  { name: 'chevron-right', label: 'Chevron Right', category: 'arrows', tags: ['next', 'expand'] },
  { name: 'chevron-left', label: 'Chevron Left', category: 'arrows', tags: ['back', 'collapse'] },
  { name: 'chevron-up', label: 'Chevron Up', category: 'arrows', tags: ['collapse', 'up'] },
  { name: 'chevron-down', label: 'Chevron Down', category: 'arrows', tags: ['expand', 'down'] },
  { name: 'chevron-double-right', label: 'Chevron Double Right', category: 'arrows', tags: ['fast forward', 'skip'] },
  { name: 'chevron-double-left', label: 'Chevron Double Left', category: 'arrows', tags: ['rewind', 'skip back'] },
  { name: 'chevron-up-down', label: 'Chevron Up Down', category: 'arrows', tags: ['sort', 'select'] },

  // Business & Finance
  { name: 'building-office', label: 'Building Office', category: 'business', tags: ['office', 'company'] },
  { name: 'building-office-2', label: 'Building Office 2', category: 'business', tags: ['office', 'building'] },
  { name: 'building-library', label: 'Building Library', category: 'business', tags: ['bank', 'institution'] },
  { name: 'building-storefront', label: 'Building Storefront', category: 'business', tags: ['shop', 'store'] },
  { name: 'briefcase', label: 'Briefcase', category: 'business', tags: ['work', 'job', 'career'] },
  { name: 'chart-bar', label: 'Chart Bar', category: 'business', tags: ['analytics', 'statistics'] },
  { name: 'chart-bar-square', label: 'Chart Bar Square', category: 'business', tags: ['analytics', 'statistics'] },
  { name: 'chart-pie', label: 'Chart Pie', category: 'business', tags: ['analytics', 'statistics'] },
  { name: 'presentation-chart-bar', label: 'Presentation Chart Bar', category: 'business', tags: ['presentation', 'analytics'] },
  { name: 'presentation-chart-line', label: 'Presentation Chart Line', category: 'business', tags: ['presentation', 'growth'] },
  { name: 'currency-dollar', label: 'Currency Dollar', category: 'business', tags: ['money', 'finance'] },
  { name: 'currency-euro', label: 'Currency Euro', category: 'business', tags: ['money', 'finance'] },
  { name: 'currency-pound', label: 'Currency Pound', category: 'business', tags: ['money', 'finance'] },
  { name: 'currency-yen', label: 'Currency Yen', category: 'business', tags: ['money', 'finance'] },
  { name: 'banknotes', label: 'Banknotes', category: 'business', tags: ['money', 'cash', 'payment'] },
  { name: 'credit-card', label: 'Credit Card', category: 'business', tags: ['payment', 'money'] },
  { name: 'wallet', label: 'Wallet', category: 'business', tags: ['money', 'payment'] },
  { name: 'receipt-percent', label: 'Receipt Percent', category: 'business', tags: ['discount', 'sale'] },
  { name: 'receipt-refund', label: 'Receipt Refund', category: 'business', tags: ['refund', 'return'] },
  { name: 'calculator', label: 'Calculator', category: 'business', tags: ['math', 'calculate'] },
  { name: 'clipboard-document', label: 'Clipboard Document', category: 'business', tags: ['copy', 'paste'] },
  { name: 'clipboard-document-check', label: 'Clipboard Check', category: 'business', tags: ['done', 'complete'] },
  { name: 'clipboard-document-list', label: 'Clipboard List', category: 'business', tags: ['checklist', 'tasks'] },

  // Actions
  { name: 'plus', label: 'Plus', category: 'actions', tags: ['add', 'create', 'new'] },
  { name: 'plus-circle', label: 'Plus Circle', category: 'actions', tags: ['add', 'create'] },
  { name: 'plus-small', label: 'Plus Small', category: 'actions', tags: ['add'] },
  { name: 'minus', label: 'Minus', category: 'actions', tags: ['remove', 'subtract'] },
  { name: 'minus-circle', label: 'Minus Circle', category: 'actions', tags: ['remove'] },
  { name: 'x-mark', label: 'X Mark', category: 'actions', tags: ['close', 'cancel', 'delete'] },
  { name: 'x-circle', label: 'X Circle', category: 'actions', tags: ['close', 'cancel'] },
  { name: 'check', label: 'Check', category: 'actions', tags: ['done', 'complete', 'success'] },
  { name: 'check-circle', label: 'Check Circle', category: 'actions', tags: ['done', 'success'] },
  { name: 'check-badge', label: 'Check Badge', category: 'actions', tags: ['verified', 'approved'] },
  { name: 'pencil', label: 'Pencil', category: 'actions', tags: ['edit', 'write'] },
  { name: 'pencil-square', label: 'Pencil Square', category: 'actions', tags: ['edit', 'compose'] },
  { name: 'trash', label: 'Trash', category: 'actions', tags: ['delete', 'remove'] },
  { name: 'archive-box', label: 'Archive Box', category: 'actions', tags: ['archive', 'storage'] },
  { name: 'archive-box-arrow-down', label: 'Archive Box Arrow Down', category: 'actions', tags: ['archive', 'save'] },
  { name: 'archive-box-x-mark', label: 'Archive Box X Mark', category: 'actions', tags: ['unarchive', 'remove'] },
  { name: 'magnifying-glass', label: 'Magnifying Glass', category: 'actions', tags: ['search', 'find', 'zoom'] },
  { name: 'magnifying-glass-plus', label: 'Magnifying Glass Plus', category: 'actions', tags: ['zoom in'] },
  { name: 'magnifying-glass-minus', label: 'Magnifying Glass Minus', category: 'actions', tags: ['zoom out'] },
  { name: 'funnel', label: 'Funnel', category: 'actions', tags: ['filter', 'sort'] },
  { name: 'bars-arrow-down', label: 'Bars Arrow Down', category: 'actions', tags: ['sort', 'descending'] },
  { name: 'bars-arrow-up', label: 'Bars Arrow Up', category: 'actions', tags: ['sort', 'ascending'] },
  { name: 'share', label: 'Share', category: 'actions', tags: ['social', 'send'] },
  { name: 'arrow-top-right-on-square', label: 'External Link', category: 'actions', tags: ['external', 'open'] },
  { name: 'clipboard', label: 'Clipboard', category: 'actions', tags: ['copy', 'paste'] },
  { name: 'document-duplicate', label: 'Document Duplicate', category: 'actions', tags: ['copy', 'duplicate'] },

  // Media
  { name: 'photo', label: 'Photo', category: 'media', tags: ['image', 'picture'] },
  { name: 'camera', label: 'Camera', category: 'media', tags: ['photo', 'picture'] },
  { name: 'film', label: 'Film', category: 'media', tags: ['video', 'movie'] },
  { name: 'video-camera', label: 'Video Camera', category: 'media', tags: ['video', 'record'] },
  { name: 'video-camera-slash', label: 'Video Camera Slash', category: 'media', tags: ['video', 'off'] },
  { name: 'musical-note', label: 'Musical Note', category: 'media', tags: ['music', 'audio'] },
  { name: 'microphone', label: 'Microphone', category: 'media', tags: ['audio', 'record', 'voice'] },
  { name: 'play', label: 'Play', category: 'media', tags: ['start', 'video'] },
  { name: 'play-circle', label: 'Play Circle', category: 'media', tags: ['start', 'video'] },
  { name: 'pause', label: 'Pause', category: 'media', tags: ['stop', 'wait'] },
  { name: 'pause-circle', label: 'Pause Circle', category: 'media', tags: ['stop', 'wait'] },
  { name: 'stop', label: 'Stop', category: 'media', tags: ['end', 'halt'] },
  { name: 'stop-circle', label: 'Stop Circle', category: 'media', tags: ['end', 'halt'] },
  { name: 'forward', label: 'Forward', category: 'media', tags: ['skip', 'next'] },
  { name: 'backward', label: 'Backward', category: 'media', tags: ['skip', 'previous'] },
  { name: 'speaker-wave', label: 'Speaker Wave', category: 'media', tags: ['volume', 'audio', 'loud'] },
  { name: 'speaker-x-mark', label: 'Speaker X Mark', category: 'media', tags: ['mute', 'audio', 'silent'] },

  // Files & Documents
  { name: 'document', label: 'Document', category: 'files', tags: ['file', 'page'] },
  { name: 'document-text', label: 'Document Text', category: 'files', tags: ['file', 'text'] },
  { name: 'document-chart-bar', label: 'Document Chart Bar', category: 'files', tags: ['report', 'analytics'] },
  { name: 'document-check', label: 'Document Check', category: 'files', tags: ['approved', 'verified'] },
  { name: 'document-arrow-down', label: 'Document Arrow Down', category: 'files', tags: ['download'] },
  { name: 'document-arrow-up', label: 'Document Arrow Up', category: 'files', tags: ['upload'] },
  { name: 'document-magnifying-glass', label: 'Document Magnifying Glass', category: 'files', tags: ['search', 'find'] },
  { name: 'document-plus', label: 'Document Plus', category: 'files', tags: ['new', 'create'] },
  { name: 'document-minus', label: 'Document Minus', category: 'files', tags: ['remove'] },
  { name: 'folder', label: 'Folder', category: 'files', tags: ['directory', 'organize'] },
  { name: 'folder-open', label: 'Folder Open', category: 'files', tags: ['directory', 'open'] },
  { name: 'folder-plus', label: 'Folder Plus', category: 'files', tags: ['new folder', 'create'] },
  { name: 'folder-minus', label: 'Folder Minus', category: 'files', tags: ['remove folder'] },
  { name: 'folder-arrow-down', label: 'Folder Arrow Down', category: 'files', tags: ['download folder'] },
  { name: 'paper-clip', label: 'Paper Clip', category: 'files', tags: ['attachment', 'attach'] },

  // UI & Interface
  { name: 'bars-3', label: 'Bars 3', category: 'interface', tags: ['menu', 'hamburger'] },
  { name: 'bars-3-bottom-left', label: 'Bars 3 Bottom Left', category: 'interface', tags: ['menu'] },
  { name: 'bars-3-bottom-right', label: 'Bars 3 Bottom Right', category: 'interface', tags: ['menu'] },
  { name: 'bars-3-center-left', label: 'Bars 3 Center Left', category: 'interface', tags: ['menu'] },
  { name: 'bars-4', label: 'Bars 4', category: 'interface', tags: ['menu', 'list'] },
  { name: 'ellipsis-horizontal', label: 'Ellipsis Horizontal', category: 'interface', tags: ['more', 'options'] },
  { name: 'ellipsis-vertical', label: 'Ellipsis Vertical', category: 'interface', tags: ['more', 'options'] },
  { name: 'cog-6-tooth', label: 'Cog', category: 'interface', tags: ['settings', 'gear', 'config'] },
  { name: 'cog-8-tooth', label: 'Cog 8', category: 'interface', tags: ['settings', 'gear'] },
  { name: 'adjustments-horizontal', label: 'Adjustments Horizontal', category: 'interface', tags: ['settings', 'sliders'] },
  { name: 'adjustments-vertical', label: 'Adjustments Vertical', category: 'interface', tags: ['settings', 'sliders'] },
  { name: 'switch-horizontal', label: 'Switch Horizontal', category: 'interface', tags: ['toggle', 'swap'] },
  { name: 'switch-vertical', label: 'Switch Vertical', category: 'interface', tags: ['toggle', 'swap'] },
  { name: 'information-circle', label: 'Information Circle', category: 'interface', tags: ['info', 'help'] },
  { name: 'question-mark-circle', label: 'Question Mark Circle', category: 'interface', tags: ['help', 'faq'] },
  { name: 'exclamation-circle', label: 'Exclamation Circle', category: 'interface', tags: ['warning', 'alert'] },
  { name: 'exclamation-triangle', label: 'Exclamation Triangle', category: 'interface', tags: ['warning', 'alert'] },
  { name: 'eye', label: 'Eye', category: 'interface', tags: ['view', 'visible', 'show'] },
  { name: 'eye-slash', label: 'Eye Slash', category: 'interface', tags: ['hide', 'invisible'] },
  { name: 'eye-dropper', label: 'Eye Dropper', category: 'interface', tags: ['color', 'pick'] },
  { name: 'lock-closed', label: 'Lock Closed', category: 'interface', tags: ['security', 'private', 'locked'] },
  { name: 'lock-open', label: 'Lock Open', category: 'interface', tags: ['security', 'unlock'] },
  { name: 'key', label: 'Key', category: 'interface', tags: ['security', 'password', 'access'] },
  { name: 'finger-print', label: 'Finger Print', category: 'interface', tags: ['identity', 'biometric'] },
  { name: 'shield-check', label: 'Shield Check', category: 'interface', tags: ['security', 'verified'] },
  { name: 'shield-exclamation', label: 'Shield Exclamation', category: 'interface', tags: ['security', 'warning'] },
  { name: 'squares-2x2', label: 'Squares 2x2', category: 'interface', tags: ['grid', 'dashboard'] },
  { name: 'squares-plus', label: 'Squares Plus', category: 'interface', tags: ['add', 'widget'] },
  { name: 'rectangle-group', label: 'Rectangle Group', category: 'interface', tags: ['layout', 'components'] },
  { name: 'rectangle-stack', label: 'Rectangle Stack', category: 'interface', tags: ['layers', 'stack'] },
  { name: 'table-cells', label: 'Table Cells', category: 'interface', tags: ['table', 'grid', 'data'] },
  { name: 'list-bullet', label: 'List Bullet', category: 'interface', tags: ['list', 'items'] },
  { name: 'queue-list', label: 'Queue List', category: 'interface', tags: ['playlist', 'queue'] },

  // Social & Community
  { name: 'heart', label: 'Heart', category: 'social', tags: ['love', 'like', 'favorite'] },
  { name: 'star', label: 'Star', category: 'social', tags: ['favorite', 'rating'] },
  { name: 'hand-thumb-up', label: 'Thumb Up', category: 'social', tags: ['like', 'approve'] },
  { name: 'hand-thumb-down', label: 'Thumb Down', category: 'social', tags: ['dislike', 'disapprove'] },
  { name: 'bookmark', label: 'Bookmark', category: 'social', tags: ['save', 'favorite'] },
  { name: 'bookmark-square', label: 'Bookmark Square', category: 'social', tags: ['save'] },
  { name: 'flag', label: 'Flag', category: 'social', tags: ['report', 'mark'] },
  { name: 'trophy', label: 'Trophy', category: 'social', tags: ['prize', 'winner', 'achievement'] },
  { name: 'gift', label: 'Gift', category: 'social', tags: ['present', 'reward'] },
  { name: 'gift-top', label: 'Gift Top', category: 'social', tags: ['present', 'box'] },
  { name: 'hand-raised', label: 'Hand Raised', category: 'social', tags: ['stop', 'hi', 'wave'] },
  { name: 'sparkles', label: 'Sparkles', category: 'social', tags: ['magic', 'new', 'special'] },

  // Location & Maps
  { name: 'map-pin', label: 'Map Pin', category: 'location', tags: ['location', 'marker'] },
  { name: 'map', label: 'Map', category: 'location', tags: ['location', 'directions'] },
  { name: 'globe-alt', label: 'Globe Alt', category: 'location', tags: ['world', 'international'] },
  { name: 'globe-americas', label: 'Globe Americas', category: 'location', tags: ['world', 'americas'] },
  { name: 'globe-asia-australia', label: 'Globe Asia Australia', category: 'location', tags: ['world', 'asia'] },
  { name: 'globe-europe-africa', label: 'Globe Europe Africa', category: 'location', tags: ['world', 'europe'] },

  // Time & Calendar
  { name: 'clock', label: 'Clock', category: 'time', tags: ['time', 'watch', 'schedule'] },
  { name: 'calendar', label: 'Calendar', category: 'time', tags: ['date', 'schedule', 'event'] },
  { name: 'calendar-days', label: 'Calendar Days', category: 'time', tags: ['date', 'schedule'] },

  // Technology
  { name: 'computer-desktop', label: 'Computer Desktop', category: 'technology', tags: ['computer', 'monitor'] },
  { name: 'device-phone-mobile', label: 'Device Phone Mobile', category: 'technology', tags: ['phone', 'mobile'] },
  { name: 'device-tablet', label: 'Device Tablet', category: 'technology', tags: ['tablet', 'ipad'] },
  { name: 'tv', label: 'TV', category: 'technology', tags: ['television', 'display'] },
  { name: 'wifi', label: 'WiFi', category: 'technology', tags: ['wireless', 'internet'] },
  { name: 'signal', label: 'Signal', category: 'technology', tags: ['network', 'connection'] },
  { name: 'signal-slash', label: 'Signal Slash', category: 'technology', tags: ['no network', 'offline'] },
  { name: 'server', label: 'Server', category: 'technology', tags: ['hosting', 'backend'] },
  { name: 'server-stack', label: 'Server Stack', category: 'technology', tags: ['hosting', 'cluster'] },
  { name: 'cloud', label: 'Cloud', category: 'technology', tags: ['storage', 'online'] },
  { name: 'cloud-arrow-down', label: 'Cloud Arrow Down', category: 'technology', tags: ['download', 'cloud'] },
  { name: 'cloud-arrow-up', label: 'Cloud Arrow Up', category: 'technology', tags: ['upload', 'cloud'] },
  { name: 'code-bracket', label: 'Code Bracket', category: 'technology', tags: ['programming', 'code'] },
  { name: 'code-bracket-square', label: 'Code Bracket Square', category: 'technology', tags: ['programming', 'code'] },
  { name: 'command-line', label: 'Command Line', category: 'technology', tags: ['terminal', 'console'] },
  { name: 'cpu-chip', label: 'CPU Chip', category: 'technology', tags: ['processor', 'hardware'] },
  { name: 'circle-stack', label: 'Circle Stack', category: 'technology', tags: ['database', 'storage'] },
  { name: 'link', label: 'Link', category: 'technology', tags: ['url', 'chain', 'connection'] },
  { name: 'qr-code', label: 'QR Code', category: 'technology', tags: ['scan', 'barcode'] },
  { name: 'rss', label: 'RSS', category: 'technology', tags: ['feed', 'subscribe'] },
  { name: 'hashtag', label: 'Hashtag', category: 'technology', tags: ['tag', 'social'] },
  { name: 'at-symbol', label: 'At Symbol', category: 'technology', tags: ['email', 'mention'] },

  // Nature & Weather
  { name: 'sun', label: 'Sun', category: 'weather', tags: ['day', 'bright', 'light'] },
  { name: 'moon', label: 'Moon', category: 'weather', tags: ['night', 'dark'] },
  { name: 'cloud', label: 'Cloud', category: 'weather', tags: ['weather', 'sky'] },
  { name: 'bolt', label: 'Bolt', category: 'weather', tags: ['lightning', 'power', 'energy'] },
  { name: 'fire', label: 'Fire', category: 'weather', tags: ['hot', 'flame', 'trending'] },

  // Shopping & E-commerce
  { name: 'shopping-cart', label: 'Shopping Cart', category: 'shopping', tags: ['cart', 'buy', 'ecommerce'] },
  { name: 'shopping-bag', label: 'Shopping Bag', category: 'shopping', tags: ['bag', 'buy', 'store'] },
  { name: 'tag', label: 'Tag', category: 'shopping', tags: ['label', 'price'] },
  { name: 'ticket', label: 'Ticket', category: 'shopping', tags: ['coupon', 'event'] },

  // Health & Medical
  { name: 'heart', label: 'Heart', category: 'health', tags: ['health', 'medical', 'love'] },
  { name: 'beaker', label: 'Beaker', category: 'health', tags: ['science', 'lab', 'chemistry'] },

  // Education
  { name: 'academic-cap', label: 'Academic Cap', category: 'education', tags: ['graduation', 'school', 'university'] },
  { name: 'book-open', label: 'Book Open', category: 'education', tags: ['read', 'study'] },
  { name: 'bookmark', label: 'Bookmark', category: 'education', tags: ['save', 'mark'] },
  { name: 'light-bulb', label: 'Light Bulb', category: 'education', tags: ['idea', 'innovation', 'creative'] },
  { name: 'puzzle-piece', label: 'Puzzle Piece', category: 'education', tags: ['solution', 'plugin', 'extension'] },

  // Transportation
  { name: 'truck', label: 'Truck', category: 'transportation', tags: ['vehicle', 'delivery', 'shipping'] },
  { name: 'paper-airplane', label: 'Paper Airplane', category: 'transportation', tags: ['send', 'fly'] },
  { name: 'rocket-launch', label: 'Rocket Launch', category: 'transportation', tags: ['launch', 'space', 'fast'] },

  // Miscellaneous
  { name: 'wrench', label: 'Wrench', category: 'tools', tags: ['tool', 'fix', 'settings'] },
  { name: 'wrench-screwdriver', label: 'Wrench Screwdriver', category: 'tools', tags: ['tools', 'build'] },
  { name: 'scissors', label: 'Scissors', category: 'tools', tags: ['cut', 'tool'] },
  { name: 'paint-brush', label: 'Paint Brush', category: 'tools', tags: ['design', 'art', 'color'] },
  { name: 'swatch', label: 'Swatch', category: 'tools', tags: ['color', 'palette'] },
  { name: 'cube', label: 'Cube', category: 'shapes', tags: ['3d', 'box'] },
  { name: 'cube-transparent', label: 'Cube Transparent', category: 'shapes', tags: ['3d', 'box'] },
  { name: 'viewfinder-circle', label: 'Viewfinder Circle', category: 'tools', tags: ['focus', 'target'] },
  { name: 'cursor-arrow-rays', label: 'Cursor Arrow Rays', category: 'tools', tags: ['click', 'pointer'] },
  { name: 'cursor-arrow-ripple', label: 'Cursor Arrow Ripple', category: 'tools', tags: ['click', 'pointer'] },
].map(icon => ({ ...icon, style: 'outline' }));

// Solid icons - same set but with solid style
const solidIcons: IconMeta[] = outlineIcons.map(icon => ({
  ...icon,
  style: 'solid',
}));

// All icons combined
const allIcons = [...outlineIcons, ...solidIcons];

// Get unique categories
const categories = [...new Set(allIcons.map(icon => icon.category || 'other'))].sort();

// SVG paths for common Heroicons (outline versions)
// These are simplified representations - in production you'd use the actual Heroicon components
const heroiconPaths: Record<string, string> = {
  // User icons
  'user': 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  'users': 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  // Navigation
  'home': 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  'arrow-right': 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3',
  'arrow-left': 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18',
  'chevron-right': 'M8.25 4.5l7.5 7.5-7.5 7.5',
  'chevron-left': 'M15.75 19.5L8.25 12l7.5-7.5',
  'chevron-down': 'M19.5 8.25l-7.5 7.5-7.5-7.5',
  'chevron-up': 'M4.5 15.75l7.5-7.5 7.5 7.5',
  // Actions
  'plus': 'M12 4.5v15m7.5-7.5h-15',
  'minus': 'M19.5 12h-15',
  'x-mark': 'M6 18L18 6M6 6l12 12',
  'check': 'M4.5 12.75l6 6 9-13.5',
  'pencil': 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125',
  'trash': 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
  'magnifying-glass': 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  // Media
  'photo': 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  'play': 'M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z',
  // UI
  'bars-3': 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  'cog-6-tooth': 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z',
  'eye': 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  // Social
  'heart': 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
  'star': 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  // Business
  'briefcase': 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
  // Location
  'map-pin': 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  // Time
  'clock': 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  'calendar': 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  // Communication
  'envelope': 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  'phone': 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
  'bell': 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  // Files
  'document': 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  'folder': 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
  // Default fallback
  'default': 'M12 6v6m0 0v6m0-6h6m-6 0H6',
};

// Heroicons adapter
export const heroiconsAdapter: IconLibraryAdapter = {
  name: 'heroicons',
  displayName: 'Heroicons',
  version: '2.1.1',

  getIcons: (options) => {
    let icons = allIcons;

    if (options?.style) {
      icons = icons.filter(icon => icon.style === options.style);
    }

    if (options?.category) {
      icons = icons.filter(icon => icon.category === options.category);
    }

    return icons;
  },

  getCategories: () => categories,

  getStyles: () => ['outline', 'solid'],

  renderIcon: (icon, size = 16) => {
    const path = heroiconPaths[icon.name] || heroiconPaths['default'];
    const isSolid = icon.style === 'solid';

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill={isSolid ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        strokeWidth={isSolid ? 0 : 1.5}
        stroke={isSolid ? 'none' : 'currentColor'}
        style={{ width: size, height: size }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={path}
        />
      </svg>
    );
  },

  searchIcons: (query, options) => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) {
      return heroiconsAdapter.getIcons(options);
    }

    let icons = heroiconsAdapter.getIcons(options);

    return icons.filter(icon => {
      // Search in name
      if (icon.name.toLowerCase().includes(normalizedQuery)) return true;
      // Search in label
      if (icon.label?.toLowerCase().includes(normalizedQuery)) return true;
      // Search in tags
      if (icon.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery))) return true;
      // Search in category
      if (icon.category?.toLowerCase().includes(normalizedQuery)) return true;

      return false;
    });
  },
};

export default heroiconsAdapter;
