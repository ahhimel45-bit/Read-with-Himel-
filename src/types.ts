export interface Chapter {
  id: string;
  title: string;
  content: string; // HTML or Markdown formatted, or plain text with paragraphs
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  category: string;
  coverColor: string; // Visual gradient start
  coverColorEnd: string; // Visual gradient end
  chapters: Chapter[];
  fileSize: string;
  isCustom: boolean; // True if uploaded by user
  totalWords: number;
  addedAt: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapterIndex: number;
  progressPercentage: number;
  label: string;
  createdAt: string;
}

export interface Highlight {
  id: string;
  bookId: string;
  chapterIndex: number;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink';
  note?: string;
  createdAt: string;
}

export interface ReadingProgress {
  bookId: string;
  currentChapterIndex: number;
  scrollPercent: number; // For scroll mode
  pageIndex: number; // For paginated mode
  lastReadAt: string;
  percentComplete: number;
  readingTime?: number; // Cumulative seconds reading this volume
}

export interface ReadingSettings {
  fontStyle: 'sans' | 'serif' | 'mono' | 'lexend';
  fontSize: number; // in pixels (e.g., 14 to 28)
  theme: 'light' | 'sepia' | 'dim' | 'dark';
  lineSpacing: 'tight' | 'normal' | 'relaxed'; // e.g. 1.2, 1.5, 2.0
  marginSize: 'narrow' | 'normal' | 'wide';
  layoutMode: 'single' | 'double' | 'scroll'; // single page, two columns, or continuous scroll
  autoScrollSpeed: number; // 0 = stopped, 1-10 = scroll speed
  blueLightFilter: number; // 0 to 60 percentage overlay
}

export interface SyncLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface SyncProfile {
  lastSyncAt: string | null;
  status: 'idle' | 'syncing' | 'success' | 'error';
  syncCode: string; // Short code for sync sharing
  logs: SyncLog[];
}
