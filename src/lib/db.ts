import { Book, Bookmark, Highlight, ReadingProgress, ReadingSettings, SyncProfile, SyncLog } from '../types';
import { CLASSICS } from '../data/classics';

const DB_NAME = 'EbookReaderDB';
const DB_VERSION = 1;
const BOOKS_STORE = 'books';

// Initialize IndexedDB
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB failed to open');
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
      }
    };
  });
}

// Database Helpers
export async function getStoredBooks(): Promise<Book[]> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(BOOKS_STORE, 'readonly');
      const store = transaction.objectStore(BOOKS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const customBooks = request.result || [];
        // Combine pre-loaded classic books with custom books
        resolve([...CLASSICS, ...customBooks]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('Failed to get stored books, falling back to classics', err);
    return CLASSICS;
  }
}

export async function saveStoredBook(book: Book): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readwrite');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.put(book);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteStoredBook(bookId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readwrite');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.delete(bookId);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// LocalStorage helpers for small, fast read-write configurations

// Bookmarks
export function getStoredBookmarks(): Bookmark[] {
  const data = localStorage.getItem('ebook_reader_bookmarks');
  return data ? JSON.parse(data) : [];
}

export function saveStoredBookmarks(bookmarks: Bookmark[]): void {
  localStorage.setItem('ebook_reader_bookmarks', JSON.stringify(bookmarks));
}

// Highlights & Notes
export function getStoredHighlights(): Highlight[] {
  const data = localStorage.getItem('ebook_reader_highlights');
  return data ? JSON.parse(data) : [];
}

export function saveStoredHighlights(highlights: Highlight[]): void {
  localStorage.setItem('ebook_reader_highlights', JSON.stringify(highlights));
}

// Reading Progress
export function getStoredProgress(): ReadingProgress[] {
  const data = localStorage.getItem('ebook_reader_progress');
  return data ? JSON.parse(data) : [];
}

export function saveStoredProgress(progress: ReadingProgress[]): void {
  localStorage.setItem('ebook_reader_progress', JSON.stringify(progress));
}

// Settings
const DEFAULT_SETTINGS: ReadingSettings = {
  fontStyle: 'serif',
  fontSize: 18,
  theme: 'sepia',
  lineSpacing: 'normal',
  marginSize: 'normal',
  layoutMode: 'single',
  autoScrollSpeed: 0,
  blueLightFilter: 0,
};

export function getStoredSettings(): ReadingSettings {
  const data = localStorage.getItem('ebook_reader_settings');
  return data ? JSON.parse(data) : DEFAULT_SETTINGS;
}

export function saveStoredSettings(settings: ReadingSettings): void {
  localStorage.setItem('ebook_reader_settings', JSON.stringify(settings));
}

// Sync Profiles and Logs
const DEFAULT_SYNC_PROFILE: SyncProfile = {
  lastSyncAt: null,
  status: 'idle',
  syncCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
  logs: [
    {
      id: 'log-init',
      timestamp: new Date().toISOString(),
      type: 'info',
      message: 'Offline Synchronization profile initialized successfully.'
    }
  ],
};

export function getStoredSyncProfile(): SyncProfile {
  const data = localStorage.getItem('ebook_reader_sync');
  return data ? JSON.parse(data) : DEFAULT_SYNC_PROFILE;
}

export function saveStoredSyncProfile(sync: SyncProfile): void {
  localStorage.setItem('ebook_reader_sync', JSON.stringify(sync));
}
