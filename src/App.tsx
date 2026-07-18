import { useState, useEffect } from 'react';
import { Book, ReadingProgress, ReadingSettings } from './types';
import { getStoredBooks, getStoredProgress, getStoredSettings, saveStoredSettings } from './lib/db';
import Bookshelf from './components/Bookshelf';
import Reader from './components/Reader';
import SyncDashboard from './components/SyncDashboard';
import { BookOpen, RefreshCw, Layers } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'bookshelf' | 'sync'>('bookshelf');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [progressList, setProgressList] = useState<ReadingProgress[]>([]);
  const [settings, setSettings] = useState<ReadingSettings>(getStoredSettings());
  const [isLoading, setIsLoading] = useState(true);

  // Load initial database records
  const loadLibrary = async () => {
    try {
      const storedBooks = await getStoredBooks();
      setBooks(storedBooks);

      const progress = getStoredProgress();
      setProgressList(progress);
    } catch (err) {
      console.error('Failed to load library data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const handleUpdateSettings = (newSettings: ReadingSettings) => {
    setSettings(newSettings);
    saveStoredSettings(newSettings);
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
  };

  const handleClearLibrary = async () => {
    // Clear custom books from IndexedDB
    const { initDB } = await import('./lib/db');
    const db = await initDB();
    const transaction = db.transaction('books', 'readwrite');
    const store = transaction.objectStore('books');
    store.clear();

    // Clear bookmarks and progress
    localStorage.removeItem('ebook_reader_bookmarks');
    localStorage.removeItem('ebook_reader_highlights');
    localStorage.removeItem('ebook_reader_progress');

    // Reload library
    loadLibrary();
  };

  const activeBook = books.find((b) => b.id === selectedBookId);

  // If reading a book, show distraction-free viewport
  if (activeBook) {
    return (
      <Reader
        book={activeBook}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onBackToLibrary={() => setSelectedBookId(null)}
        onProgressUpdated={loadLibrary}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfaf8] flex flex-col font-serif text-[#2d2a26]">
      
      {/* App Header Bar */}
      <header className="sticky top-0 z-30 bg-[#fbfaf8]/95 backdrop-blur-sm border-b border-[#2d2a26]/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo & title */}
          <div className="flex items-center gap-3 select-none">
            <div className="w-8 h-8 bg-[#2d2a26] flex items-center justify-center text-[#fbfaf8] font-bold italic text-base">
              R
            </div>
            <div>
              <span className="font-bold text-[#2d2a26] tracking-tight text-base block italic">Read with Himel</span>
              <span className="text-[9px] text-[#5a5a40] font-sans font-bold uppercase tracking-[0.2em] block">
                Ebook Sanctuary &bull; Sync Active
              </span>
            </div>
          </div>

          {/* Navigation Control Tabs */}
          <nav className="flex items-center bg-[#e8e4de]/50 rounded-none p-1 gap-1 border border-[#2d2a26]/10">
            <button
              onClick={() => setActiveTab('bookshelf')}
              className={`flex items-center gap-2 py-1.5 px-4 text-xs font-sans font-medium uppercase tracking-wider transition cursor-pointer ${
                activeTab === 'bookshelf'
                  ? 'bg-[#2d2a26] text-[#fbfaf8] shadow-sm font-semibold'
                  : 'text-[#2d2a26]/60 hover:text-[#2d2a26]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Library Shelf</span>
            </button>
            <button
              onClick={() => setActiveTab('sync')}
              className={`flex items-center gap-2 py-1.5 px-4 text-xs font-sans font-medium uppercase tracking-wider transition cursor-pointer ${
                activeTab === 'sync'
                  ? 'bg-[#2d2a26] text-[#fbfaf8] shadow-sm font-semibold'
                  : 'text-[#2d2a26]/60 hover:text-[#2d2a26]'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Station</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Screen Router */}
      <main className="flex-grow">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-6 h-6 rounded-full border-2 border-[#5a5a40] border-t-transparent animate-spin"></div>
            <p className="text-[10px] text-[#2d2a26]/50 font-sans font-bold uppercase tracking-widest">
              Retrieving Catalog...
            </p>
          </div>
        ) : activeTab === 'bookshelf' ? (
          <Bookshelf
            books={books}
            progressList={progressList}
            onSelectBook={handleSelectBook}
            onRefreshLibrary={loadLibrary}
          />
        ) : (
          <SyncDashboard
            onRefreshLibrary={loadLibrary}
            onClearLibrary={handleClearLibrary}
          />
        )}
      </main>

      {/* Custom footer line */}
      <footer className="border-t border-[#2d2a26]/10 bg-[#f7f5f2] py-6 text-center select-none">
        <p className="text-[10px] text-[#2d2a26]/50 font-sans font-medium uppercase tracking-wider">
          &copy; 2026 Editorial Labs &middot; Personal Sanctuary Edition v2.4
        </p>
      </footer>
    </div>
  );
}
