import { useState, useEffect, useRef } from 'react';
import { Book, Bookmark, Highlight, ReadingSettings, ReadingProgress } from '../types';
import { saveStoredBookmarks, saveStoredHighlights, saveStoredProgress, getStoredBookmarks, getStoredHighlights } from '../lib/db';
import { ChevronLeft, ChevronRight, Menu, Settings, Bookmark as BookmarkIcon, Highlighter, Search, X, BookOpen, AlertCircle, Plus, Edit3, Trash2, ArrowLeft, Play, Pause, Save, FileText, Clock } from 'lucide-react';
import ReadingSettingsPanel from './ReadingSettings';

interface ReaderProps {
  book: Book;
  settings: ReadingSettings;
  onUpdateSettings: (settings: ReadingSettings) => void;
  onBackToLibrary: () => void;
  onProgressUpdated: () => void;
}

export default function Reader({
  book,
  settings,
  onUpdateSettings,
  onBackToLibrary,
  onProgressUpdated,
}: ReaderProps) {
  // Navigation & layout states
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0); // for paginated view
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Highlighting and Notes states
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<'yellow' | 'green' | 'blue' | 'pink'>('yellow');
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isNoteInputOpen, setIsNoteInputOpen] = useState(false);
  const [targetParagraphIndex, setTargetParagraphIndex] = useState<number | null>(null);

  // Search inside book states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ chapterIndex: number; paragraphIndex: number; text: string }[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Auto scroll state
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reading session timer states (in seconds)
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);

  // Handle incrementing the timer while reading
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
      setTotalSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [book.id]);

  // Persist totalSeconds to localStorage as it updates
  useEffect(() => {
    if (!book.id || totalSeconds === 0) return;

    const progressData = localStorage.getItem('ebook_reader_progress');
    let list: ReadingProgress[] = progressData ? JSON.parse(progressData) : [];
    
    const foundIdx = list.findIndex((p) => p.bookId === book.id);
    if (foundIdx !== -1) {
      list[foundIdx].readingTime = totalSeconds;
      list[foundIdx].lastReadAt = new Date().toISOString();
    } else {
      list.push({
        bookId: book.id,
        currentChapterIndex,
        scrollPercent: 0,
        pageIndex: currentPageIndex,
        lastReadAt: new Date().toISOString(),
        percentComplete: 0,
        readingTime: totalSeconds,
      });
    }
    localStorage.setItem('ebook_reader_progress', JSON.stringify(list));
  }, [totalSeconds, book.id]);

  // Load existing highlights/bookmarks
  useEffect(() => {
    const allHighlights = getStoredHighlights();
    const bookHighlights = allHighlights.filter((h) => h.bookId === book.id);
    setHighlights(bookHighlights);

    const allBookmarks = getStoredBookmarks();
    const bookBookmarks = allBookmarks.filter((b) => b.bookId === book.id);
    setBookmarks(bookBookmarks);

    // Set last read progress if available
    const progressData = localStorage.getItem('ebook_reader_progress');
    if (progressData) {
      const list: ReadingProgress[] = JSON.parse(progressData);
      const found = list.find((p) => p.bookId === book.id);
      if (found) {
        setCurrentChapterIndex(found.currentChapterIndex);
        setCurrentPageIndex(found.pageIndex || 0);
        setTotalSeconds(found.readingTime || 0);
      } else {
        setTotalSeconds(0);
      }
    } else {
      setTotalSeconds(0);
    }
    setSessionSeconds(0);
  }, [book.id]);

  // Handle active chapter paragraphs
  const currentChapter = book.chapters[currentChapterIndex] || book.chapters[0];
  const paragraphs = currentChapter ? currentChapter.content.split('\n\n').filter((p) => p.trim()) : [];

  // Partition paragraphs into pages for 'single' and 'double' layout modes
  const paragraphsPerPage = settings.layoutMode === 'double' ? 4 : 2;
  const totalPages = Math.ceil(paragraphs.length / paragraphsPerPage);

  // Page index bounds safety
  useEffect(() => {
    if (currentPageIndex >= totalPages && totalPages > 0) {
      setCurrentPageIndex(totalPages - 1);
    }
  }, [settings.layoutMode, paragraphs.length, totalPages]);

  // Save progress dynamically when position shifts
  useEffect(() => {
    if (!book.id) return;
    const progressPercent = Math.min(
      100,
      Math.round(
        ((currentChapterIndex + (totalPages > 0 ? currentPageIndex / totalPages : 0)) /
          book.chapters.length) *
          100
      )
    );

    const progressData = localStorage.getItem('ebook_reader_progress');
    let list: ReadingProgress[] = progressData ? JSON.parse(progressData) : [];
    
    const found = list.find((p) => p.bookId === book.id);
    const existingReadingTime = found ? (found.readingTime || totalSeconds) : totalSeconds;

    const newProgress: ReadingProgress = {
      bookId: book.id,
      currentChapterIndex,
      scrollPercent: 0,
      pageIndex: currentPageIndex,
      lastReadAt: new Date().toISOString(),
      percentComplete: progressPercent,
      readingTime: existingReadingTime,
    };

    list = list.filter((p) => p.bookId !== book.id);
    list.push(newProgress);
    localStorage.setItem('ebook_reader_progress', JSON.stringify(list));
    onProgressUpdated();
  }, [currentChapterIndex, currentPageIndex, book.id, totalPages]);

  // Full-Text Search inside book
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const matches: { chapterIndex: number; paragraphIndex: number; text: string }[] = [];
    book.chapters.forEach((ch, chIdx) => {
      const paras = ch.content.split('\n\n').filter((p) => p.trim());
      paras.forEach((pText, pIdx) => {
        if (pText.toLowerCase().includes(searchQuery.toLowerCase())) {
          matches.push({
            chapterIndex: chIdx,
            paragraphIndex: pIdx,
            text: pText,
          });
        }
      });
    });

    setSearchResults(matches);
  };

  // Auto-scroll effect
  useEffect(() => {
    if (settings.layoutMode !== 'scroll' || settings.autoScrollSpeed === 0 || !isAutoScrolling) {
      if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
      return;
    }

    const speedMap: Record<number, number> = {
      1: 90,
      2: 75,
      3: 60,
      4: 45,
      5: 35,
      6: 25,
      7: 18,
      8: 12,
      9: 8,
      10: 4,
    };

    const intervalTime = speedMap[settings.autoScrollSpeed] || 50;

    autoScrollTimerRef.current = setInterval(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop += 1;

        // Auto move to next chapter if reached bottom
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 2) {
          if (currentChapterIndex < book.chapters.length - 1) {
            setCurrentChapterIndex((prev) => prev + 1);
            scrollContainerRef.current.scrollTop = 0;
          } else {
            setIsAutoScrolling(false);
          }
        }
      }
    }, intervalTime);

    return () => {
      if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
    };
  }, [settings.layoutMode, settings.autoScrollSpeed, isAutoScrolling, currentChapterIndex]);

  // Pagination Actions
  const handlePrev = () => {
    if (settings.layoutMode === 'scroll') {
      if (currentChapterIndex > 0) {
        setCurrentChapterIndex((prev) => prev - 1);
      }
    } else {
      if (currentPageIndex > 0) {
        setCurrentPageIndex((prev) => prev - 1);
      } else if (currentChapterIndex > 0) {
        const prevChapterIndex = currentChapterIndex - 1;
        const prevChapter = book.chapters[prevChapterIndex];
        const prevParas = prevChapter.content.split('\n\n').filter((p) => p.trim());
        const prevTotalPages = Math.ceil(prevParas.length / paragraphsPerPage);
        
        setCurrentChapterIndex(prevChapterIndex);
        setCurrentPageIndex(prevTotalPages > 0 ? prevTotalPages - 1 : 0);
      }
    }
  };

  const handleNext = () => {
    if (settings.layoutMode === 'scroll') {
      if (currentChapterIndex < book.chapters.length - 1) {
        setCurrentChapterIndex((prev) => prev + 1);
      }
    } else {
      if (currentPageIndex < totalPages - 1) {
        setCurrentPageIndex((prev) => prev + 1);
      } else if (currentChapterIndex < book.chapters.length - 1) {
        setCurrentChapterIndex((prev) => prev + 1);
        setCurrentPageIndex(0);
      }
    }
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSearchOpen || isNoteInputOpen) return; // ignore typing
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentChapterIndex, currentPageIndex, settings.layoutMode, totalPages, isSearchOpen, isNoteInputOpen]);

  // Bookmarks Management
  const toggleBookmark = () => {
    const allBookmarks = getStoredBookmarks();
    const existingIndex = allBookmarks.findIndex(
      (b) => b.bookId === book.id && b.chapterIndex === currentChapterIndex && b.progressPercentage === Math.round((currentPageIndex / (totalPages || 1)) * 100)
    );

    let updatedList: Bookmark[] = [];
    if (existingIndex > -1) {
      // Remove
      updatedList = allBookmarks.filter((_, idx) => idx !== existingIndex);
    } else {
      // Add
      const newBookmark: Bookmark = {
        id: `bm-${Date.now()}`,
        bookId: book.id,
        chapterIndex: currentChapterIndex,
        progressPercentage: Math.round((currentPageIndex / (totalPages || 1)) * 100),
        label: `${currentChapter.title} - pg.${currentPageIndex + 1}`,
        createdAt: new Date().toISOString(),
      };
      updatedList = [...allBookmarks, newBookmark];
    }

    saveStoredBookmarks(updatedList);
    setBookmarks(updatedList.filter((b) => b.bookId === book.id));
  };

  const isCurrentPageBookmarked = () => {
    return bookmarks.some(
      (b) => b.chapterIndex === currentChapterIndex && b.progressPercentage === Math.round((currentPageIndex / (totalPages || 1)) * 100)
    );
  };

  // Highlights and Pinned Margin Notes
  const addHighlight = (paraIdx: number) => {
    setTargetParagraphIndex(paraIdx);
    setIsNoteInputOpen(true);
    setNoteText('');
  };

  const saveHighlightAndNote = () => {
    if (targetParagraphIndex === null) return;

    const paragraphText = paragraphs[targetParagraphIndex];
    const newHighlight: Highlight = {
      id: `hl-${Date.now()}`,
      bookId: book.id,
      chapterIndex: currentChapterIndex,
      text: paragraphText,
      color: selectedHighlightColor,
      note: noteText.trim() ? noteText.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    const allHighlights = getStoredHighlights();
    const updated = [...allHighlights, newHighlight];
    saveStoredHighlights(updated);
    setHighlights(updated.filter((h) => h.bookId === book.id));

    setIsNoteInputOpen(false);
    setTargetParagraphIndex(null);
    setNoteText('');
  };

  const deleteHighlight = (hlId: string) => {
    const allHighlights = getStoredHighlights();
    const updated = allHighlights.filter((h) => h.id !== hlId);
    saveStoredHighlights(updated);
    setHighlights(updated.filter((h) => h.bookId === book.id));
  };

  // Stylings based on settings
  const getThemeClasses = () => {
    switch (settings.theme) {
      case 'sepia':
        return {
          wrapper: 'bg-[#F4ECD8] text-[#5C4033]',
          bar: 'bg-[#EBDDBB] border-[#D6C49C] text-[#5C4033]',
          btn: 'hover:bg-[#E2D1A9] text-[#5C4033]',
          sidebar: 'bg-[#EFE6CE] border-[#D8C7A0]',
          hlYellow: 'bg-yellow-200/50 text-[#5C4033]',
          hlGreen: 'bg-emerald-200/50 text-[#5C4033]',
          hlBlue: 'bg-cyan-200/50 text-[#5C4033]',
          hlPink: 'bg-rose-200/50 text-[#5C4033]',
        };
      case 'dim':
        return {
          wrapper: 'bg-[#252830] text-[#E3E4E6]',
          bar: 'bg-[#1E2127] border-[#313644] text-[#E3E4E6]',
          btn: 'hover:bg-[#313644] text-[#E3E4E6]',
          sidebar: 'bg-[#1E2127] border-[#313644]',
          hlYellow: 'bg-yellow-500/20 text-[#FFDF6D]',
          hlGreen: 'bg-emerald-500/20 text-[#6DFFDF]',
          hlBlue: 'bg-cyan-500/20 text-[#6DDFFF]',
          hlPink: 'bg-rose-500/20 text-[#FF6DDF]',
        };
      case 'dark':
        return {
          wrapper: 'bg-[#0F1015] text-[#A0A5B5]',
          bar: 'bg-[#161820] border-[#222530] text-[#A0A5B5]',
          btn: 'hover:bg-[#222530] text-[#A0A5B5]',
          sidebar: 'bg-[#161820] border-[#222530]',
          hlYellow: 'bg-yellow-500/20 text-yellow-300',
          hlGreen: 'bg-emerald-500/20 text-emerald-300',
          hlBlue: 'bg-cyan-500/20 text-cyan-300',
          hlPink: 'bg-rose-500/20 text-rose-300',
        };
      default: // light (Editorial Aesthetic)
        return {
          wrapper: 'bg-[#fbfaf8] text-[#2d2a26]',
          bar: 'bg-[#fbfaf8] border-[#2d2a26]/10 text-[#2d2a26] shadow-sm',
          btn: 'hover:bg-[#2d2a26]/5 text-[#2d2a26]',
          sidebar: 'bg-[#f7f5f2] border-[#2d2a26]/10 text-[#2d2a26]',
          hlYellow: 'bg-[#5a5a40]/15 text-[#2d2a26] border-b border-dashed border-[#5a5a40]',
          hlGreen: 'bg-emerald-100/70 text-[#2d2a26]',
          hlBlue: 'bg-cyan-100/70 text-[#2d2a26]',
          hlPink: 'bg-rose-100/70 text-[#2d2a26]',
        };
    }
  };

  const t = getThemeClasses();

  const getFontClass = () => {
    switch (settings.fontStyle) {
      case 'serif':
        return 'font-serif';
      case 'mono':
        return 'font-mono';
      case 'lexend':
        return 'font-lexend';
      default:
        return 'font-sans';
    }
  };

  const getLineSpacingClass = () => {
    switch (settings.lineSpacing) {
      case 'tight':
        return 'leading-relaxed'; // 1.4
      case 'relaxed':
        return 'leading-loose'; // 2.0
      default:
        return 'leading-loose'; // 1.7
    }
  };

  const getMarginClass = () => {
    switch (settings.marginSize) {
      case 'narrow':
        return 'max-w-4xl px-4 md:px-8';
      case 'wide':
        return 'max-w-2xl px-8 md:px-16';
      default:
        return 'max-w-3xl px-6 md:px-12';
    }
  };

  const getHighlightColorClass = (color: string) => {
    switch (color) {
      case 'green': return t.hlGreen;
      case 'blue': return t.hlBlue;
      case 'pink': return t.hlPink;
      default: return t.hlYellow;
    }
  };

  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    const parts = [];
    if (hrs > 0) {
      parts.push(`${hrs}h`);
    }
    parts.push(`${mins.toString().padStart(2, '0')}m`);
    parts.push(`${secs.toString().padStart(2, '0')}s`);
    return parts.join(' ');
  };

  const formatSessionTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleBackToLibrary = () => {
    onProgressUpdated();
    onBackToLibrary();
  };

  // Filter highlights on the active page/chapter
  const activeParagraphsOnPage = settings.layoutMode === 'scroll'
    ? paragraphs
    : paragraphs.slice(currentPageIndex * paragraphsPerPage, (currentPageIndex + 1) * paragraphsPerPage);

  const getGlobalParagraphIndex = (pageParaIdx: number) => {
    if (settings.layoutMode === 'scroll') return pageParaIdx;
    return currentPageIndex * paragraphsPerPage + pageParaIdx;
  };

  return (
    <div className={`relative min-h-screen flex flex-col transition duration-300 ${t.wrapper} ${getFontClass()}`}>
      
      {/* Eye care warmth overlay */}
      {settings.blueLightFilter > 0 && (
        <div
          className="blue-light-overlay"
          style={{ opacity: settings.blueLightFilter / 100 }}
        ></div>
      )}

      {/* Top bar control */}
      <header className={`sticky top-0 z-40 h-14 border-b flex items-center justify-between px-4 transition ${t.bar}`}>
        <div className="flex items-center gap-3 min-w-0 flex-shrink">
          <button
            onClick={handleBackToLibrary}
            className={`p-2 rounded-lg transition ${t.btn}`}
            title="Back to library"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xs font-bold truncate max-w-24 sm:max-w-xs">{book.title}</h1>
            <p className="text-[10px] opacity-70 truncate max-w-24 sm:max-w-xs">{book.author}</p>
          </div>
        </div>

        {/* Persistent Session & Cumulative Reading Timer */}
        <div className={`flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 border text-[9px] sm:text-[10px] font-mono tracking-wider select-none rounded-none opacity-90 mx-1.5 sm:mx-2 ${
          settings.theme === 'sepia' ? 'bg-[#5C4033]/5 border-[#5C4033]/15 text-[#5C4033]' :
          settings.theme === 'dim' ? 'bg-[#E3E4E6]/5 border-[#E3E4E6]/15 text-[#E3E4E6]' :
          settings.theme === 'dark' ? 'bg-[#A0A5B5]/5 border-[#A0A5B5]/15 text-[#A0A5B5]' :
          'bg-[#2d2a26]/5 border-[#2d2a26]/10 text-[#2d2a26]'
        }`}>
          <Clock className={`w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse ${
            settings.theme === 'sepia' ? 'text-[#5C4033]/70' :
            settings.theme === 'dim' ? 'text-[#E3E4E6]/70' :
            settings.theme === 'dark' ? 'text-[#A0A5B5]/70' :
            'text-[#5a5a40]'
          }`} />
          <span className="hidden sm:inline opacity-70">Session:</span>
          <span>{formatSessionTime(sessionSeconds)}</span>
          <span className="opacity-30 font-sans">|</span>
          <span className="hidden sm:inline opacity-70">Total:</span>
          <span>{formatTime(totalSeconds)}</span>
        </div>

        {/* Action controllers */}
        <div className="flex items-center gap-1">
          {/* Scroll Play/Pause if in Scroll Mode */}
          {settings.layoutMode === 'scroll' && settings.autoScrollSpeed > 0 && (
            <button
              onClick={() => setIsAutoScrolling(!isAutoScrolling)}
              className={`p-2 rounded-lg transition ${t.btn} ${isAutoScrolling ? 'text-[#5a5a40] bg-[#5a5a40]/10' : ''}`}
              title={isAutoScrolling ? 'Pause Auto Scroll' : 'Play Auto Scroll'}
            >
              {isAutoScrolling ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
          )}

          <button
            onClick={() => setIsSearchOpen(true)}
            className={`p-2 rounded-lg transition ${t.btn}`}
            title="Search inside book"
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            onClick={toggleBookmark}
            className={`p-2 rounded-lg transition ${t.btn} ${isCurrentPageBookmarked() ? 'text-[#5a5a40]' : ''}`}
            title="Bookmark this page"
          >
            <BookmarkIcon className="w-5 h-5" fill={isCurrentPageBookmarked() ? 'currentColor' : 'none'} />
          </button>

          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-lg transition ${t.btn} ${isSettingsOpen ? 'rotate-45' : ''} transition-transform duration-200`}
            title="Display settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsSidebarOpen(true)}
            className={`p-2 rounded-lg transition ${t.btn}`}
            title="Open Table of Contents & annotations"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Display Settings Panel Overlay */}
        <ReadingSettingsPanel
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </header>

      {/* Main viewport area */}
      <main className="flex-grow flex relative h-[calc(100vh-3.5rem)] overflow-hidden">
        
        {/* Core Reader Body */}
        <div
          ref={scrollContainerRef}
          className={`flex-grow overflow-y-auto py-10 md:py-16 no-scrollbar flex flex-col justify-between items-center transition-all`}
        >
          {/* Main Book Text Area */}
          <div className={`w-full ${getMarginClass()} space-y-8 flex-grow`}>
            {/* Chapter Header */}
            {currentPageIndex === 0 && (
              <div className="border-b border-gray-400/20 pb-5 mb-8 text-center">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">{currentChapter.title}</h2>
                <p className="text-xs opacity-60 mt-1 uppercase font-semibold font-mono tracking-wider">
                  Book Section {currentChapterIndex + 1} of {book.chapters.length}
                </p>
              </div>
            )}

            {/* Paragraph Layout columns */}
            <div className={`grid gap-8 ${
              settings.layoutMode === 'double' && activeParagraphsOnPage.length > 2
                ? 'grid-cols-2'
                : 'grid-cols-1'
            }`}>
              
              {/* If Single/Scroll mode, or Column 1 of Double page */}
              <div className="space-y-6">
                {activeParagraphsOnPage.slice(0, settings.layoutMode === 'double' ? 2 : undefined).map((paraText, idx) => {
                  const globalIdx = getGlobalParagraphIndex(idx);
                  const highlight = highlights.find(
                    (h) => h.chapterIndex === currentChapterIndex && h.text === paraText
                  );

                  return (
                    <div
                      key={`p-1-${idx}`}
                      className="group relative rounded-xl p-2 -mx-2 hover:bg-black/5 transition duration-150"
                    >
                      <p
                        className={`text-sm md:text-base leading-relaxed ${getLineSpacingClass()} ${
                          highlight ? getHighlightColorClass(highlight.color) : ''
                        }`}
                        style={{ fontSize: `${settings.fontSize}px` }}
                      >
                        {paraText}
                      </p>

                      {/* Paragraph controls for highlight/notes */}
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition duration-150 flex gap-1 z-20 font-sans">
                        {highlight ? (
                          <button
                            onClick={() => deleteHighlight(highlight.id)}
                            className="p-1 rounded-none bg-rose-600 text-white shadow-md hover:bg-rose-700 transition"
                            title="Delete Annotation"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => addHighlight(globalIdx)}
                            className="p-1 rounded-none bg-[#5a5a40] text-white shadow-md hover:bg-[#4a4a35] transition flex items-center gap-0.5 px-2 py-0.5"
                            title="Annotate Paragraph"
                          >
                            <Highlighter className="w-3 h-3" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider">Annotate</span>
                          </button>
                        )}
                      </div>

                      {/* Display Pin margin note if highlight contains a note */}
                      {highlight?.note && (
                        <div className="mt-1.5 p-2 bg-amber-500/10 border-l-2 border-amber-500 rounded-r-lg text-xs italic flex items-start gap-1.5">
                          <Edit3 className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-[10px] text-amber-800 uppercase not-italic font-mono block">Marginal Note</span>
                            <span className="opacity-90">{highlight.note}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Column 2 of Double page (only loaded in double page layout mode) */}
              {settings.layoutMode === 'double' && activeParagraphsOnPage.length > 2 && (
                <div className="space-y-6 border-l border-gray-400/10 pl-6">
                  {activeParagraphsOnPage.slice(2, 4).map((paraText, idx) => {
                    const globalIdx = getGlobalParagraphIndex(idx + 2);
                    const highlight = highlights.find(
                      (h) => h.chapterIndex === currentChapterIndex && h.text === paraText
                    );

                    return (
                      <div
                        key={`p-2-${idx}`}
                        className="group relative rounded-xl p-2 -mx-2 hover:bg-black/5 transition duration-150"
                      >
                        <p
                          className={`text-sm md:text-base leading-relaxed ${getLineSpacingClass()} ${
                            highlight ? getHighlightColorClass(highlight.color) : ''
                          }`}
                          style={{ fontSize: `${settings.fontSize}px` }}
                        >
                          {paraText}
                        </p>

                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition duration-150 flex gap-1 z-20 font-sans">
                          {highlight ? (
                            <button
                              onClick={() => deleteHighlight(highlight.id)}
                              className="p-1 rounded-none bg-rose-600 text-white shadow-md hover:bg-rose-700 transition"
                              title="Delete Annotation"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              onClick={() => addHighlight(globalIdx)}
                              className="p-1 rounded-none bg-[#5a5a40] text-white shadow-md hover:bg-[#4a4a35] transition flex items-center gap-0.5 px-2 py-0.5"
                              title="Annotate Paragraph"
                            >
                              <Highlighter className="w-3 h-3" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider">Annotate</span>
                            </button>
                          )}
                        </div>

                        {highlight?.note && (
                          <div className="mt-1.5 p-2 bg-amber-500/10 border-l-2 border-amber-500 rounded-r-lg text-xs italic flex items-start gap-1.5">
                            <Edit3 className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-[10px] text-amber-800 uppercase not-italic font-mono block">Marginal Note</span>
                              <span className="opacity-90">{highlight.note}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pagination Controllers (Bottom section of main page container) */}
          {settings.layoutMode !== 'scroll' && (
            <div className="w-full max-w-3xl flex items-center justify-between mt-10 border-t border-gray-400/10 pt-4 px-6 select-none">
              <button
                onClick={handlePrev}
                disabled={currentChapterIndex === 0 && currentPageIndex === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${t.btn} disabled:opacity-30`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Page</span>
              </button>

              <span className="text-[11px] font-semibold font-mono tracking-wide opacity-60">
                Page {currentPageIndex + 1} of {totalPages || 1}
              </span>

              <button
                onClick={handleNext}
                disabled={currentChapterIndex === book.chapters.length - 1 && currentPageIndex === totalPages - 1}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${t.btn} disabled:opacity-30`}
              >
                <span>Next Page</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Scroll Mode Chapter Transitions */}
          {settings.layoutMode === 'scroll' && (
            <div className="w-full max-w-3xl flex items-center justify-between mt-10 border-t border-gray-400/10 pt-4 px-6 select-none">
              <button
                onClick={handlePrev}
                disabled={currentChapterIndex === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${t.btn} disabled:opacity-30`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev Chapter</span>
              </button>

              <span className="text-[11px] font-semibold font-mono tracking-wide opacity-60">
                Chapter {currentChapterIndex + 1} of {book.chapters.length}
              </span>

              <button
                onClick={handleNext}
                disabled={currentChapterIndex === book.chapters.length - 1}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${t.btn} disabled:opacity-30`}
              >
                <span>Next Chapter</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Search Side Panel */}
        {isSearchOpen && (
          <div className={`absolute top-0 right-0 bottom-0 w-80 shadow-2xl border-l z-50 p-4 flex flex-col justify-between ${t.sidebar} animate-in slide-in-from-right duration-200`}>
            <div className="space-y-4 flex-grow overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#5a5a40]" />
                  <span>Search Book Text</span>
                </h3>
                <button
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="p-1 rounded-lg hover:bg-black/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2 font-sans">
                <input
                  type="text"
                  placeholder="Type word or phrase..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-grow text-xs p-2 rounded-none border border-gray-300 bg-white text-gray-800 focus:outline-none focus:border-[#5a5a40]"
                />
                <button
                  onClick={handleSearch}
                  className="bg-[#2d2a26] hover:bg-[#5a5a40] text-white text-xs px-4 py-1.5 rounded-none font-bold transition uppercase tracking-wider"
                >
                  Go
                </button>
              </div>

              {/* Matches List */}
              <div className="flex-grow overflow-y-auto space-y-3 pr-1 font-sans">
                {searchResults.length === 0 ? (
                  <div className="text-center py-10 opacity-50 text-xs">
                    {searchQuery ? 'No occurrences found.' : 'Enter text to scan full book.'}
                  </div>
                ) : (
                  searchResults.map((match, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setCurrentChapterIndex(match.chapterIndex);
                        // Jump to that page where paragraph is found
                        const targetPageIndex = Math.floor(match.paragraphIndex / paragraphsPerPage);
                        setCurrentPageIndex(targetPageIndex);
                        setIsSearchOpen(false);
                      }}
                      className="p-2.5 rounded-none border border-[#5a5a40]/10 hover:border-[#5a5a40]/40 bg-[#5a5a40]/5 hover:bg-[#5a5a40]/10 cursor-pointer transition space-y-1"
                    >
                      <div className="flex justify-between items-center text-[9px] font-bold font-mono text-[#5a5a40] uppercase tracking-wider">
                        <span>{book.chapters[match.chapterIndex].title}</span>
                        <span>p. {match.paragraphIndex + 1}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed line-clamp-3 text-gray-700 dark:text-gray-300">
                        {match.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Inline Annotation Note Popup Modal */}
        {isNoteInputOpen && targetParagraphIndex !== null && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans">
            <div className="bg-[#fbfaf8] rounded-none border border-[#2d2a26]/10 p-5 shadow-2xl max-w-md w-full space-y-4 text-[#2d2a26] animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#2d2a26]/10 pb-2">
                <div className="flex items-center gap-2">
                  <Highlighter className="w-4 h-4 text-[#5a5a40]" />
                  <h3 className="font-serif font-bold text-sm">Add Paragraph Annotation</h3>
                </div>
                <button
                  onClick={() => {
                    setIsNoteInputOpen(false);
                    setTargetParagraphIndex(null);
                  }}
                  className="p-1 rounded-none hover:bg-gray-100 text-[#2d2a26]/55"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Color picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Highlight Color</label>
                <div className="flex gap-2">
                  {(['yellow', 'green', 'blue', 'pink'] as const).map((color) => {
                    const bgColors = {
                      yellow: 'bg-yellow-400',
                      green: 'bg-emerald-400',
                      blue: 'bg-cyan-400',
                      pink: 'bg-rose-400',
                    };
                    return (
                      <button
                        key={color}
                        onClick={() => setSelectedHighlightColor(color)}
                        className={`w-8 h-8 rounded-none ${bgColors[color]} flex items-center justify-center transition ${
                          selectedHighlightColor === color ? 'ring-2 ring-[#5a5a40] ring-offset-2 scale-110' : 'hover:scale-[1.05]'
                        }`}
                      >
                        {selectedHighlightColor === color && <Save className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note entry */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2d2a26]/60 uppercase tracking-wider">Margin Note (Optional)</label>
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Jot down a quick thought, definition, or analysis of this passage..."
                  className="w-full text-xs p-2.5 rounded-none border border-[#2d2a26]/10 focus:outline-none focus:border-[#5a5a40] bg-[#f7f5f2]"
                ></textarea>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setIsNoteInputOpen(false);
                    setTargetParagraphIndex(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#2d2a26]/70 hover:bg-[#2d2a26]/5 transition uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={saveHighlightAndNote}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#2d2a26] hover:bg-[#5a5a40] transition uppercase tracking-widest"
                >
                  Save Highlight
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Left Side Slide-out Table of Contents & annotations drawer */}
        {isSidebarOpen && (
          <div className="absolute inset-0 z-50 flex">
            {/* Backdrop click close */}
            <div
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            ></div>

            {/* Content box */}
            <div className={`relative w-80 max-w-full flex flex-col justify-between h-full shadow-2xl border-r p-5 ${t.sidebar} animate-in slide-in-from-left duration-200 font-sans`}>
              <div className="space-y-6 flex-grow overflow-hidden flex flex-col">
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-[#2d2a26]/10 pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#5a5a40]" />
                    <h3 className="font-serif font-bold text-sm">Table of Contents</h3>
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 rounded-lg hover:bg-black/5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Chapter list selector */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border-b border-[#2d2a26]/10 pb-4">
                  {book.chapters.map((ch, idx) => (
                    <button
                      key={ch.id}
                      onClick={() => {
                        setCurrentChapterIndex(idx);
                        setCurrentPageIndex(0);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full text-left py-2 px-3 text-xs rounded-none transition uppercase tracking-wider ${
                        currentChapterIndex === idx
                          ? 'bg-[#2d2a26] text-[#fbfaf8] font-bold'
                          : 'hover:bg-black/5 opacity-80'
                      }`}
                    >
                      {ch.title}
                    </button>
                  ))}
                </div>

                {/* Bookmarks, highlights & notes lists */}
                <div className="flex-grow overflow-y-auto space-y-4 pr-1">
                  {/* Bookmarks */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold tracking-wider uppercase opacity-50">Saved Bookmarks</h4>
                    {bookmarks.length === 0 ? (
                      <p className="text-[11px] opacity-40 italic px-1">No bookmarks stored yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {bookmarks.map((bm) => (
                          <div
                            key={bm.id}
                            onClick={() => {
                              setCurrentChapterIndex(bm.chapterIndex);
                              // Convert percent back to page index roughly
                              setCurrentPageIndex(Math.min(totalPages - 1, Math.round((bm.progressPercentage / 100) * totalPages)));
                              setIsSidebarOpen(false);
                            }}
                            className="flex items-center justify-between p-2 rounded-lg bg-black/5 text-xs hover:bg-black/10 cursor-pointer transition"
                          >
                            <span className="font-medium truncate pr-2">{bm.label}</span>
                            <span className="text-[10px] font-mono opacity-50">{bm.progressPercentage}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Highlights and Notes */}
                  <div className="space-y-2 pt-2 border-t border-gray-400/10">
                    <h4 className="text-[10px] font-bold tracking-wider uppercase opacity-50">Highlights & Notes</h4>
                    {highlights.length === 0 ? (
                      <p className="text-[11px] opacity-40 italic px-1">No annotations recorded.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {highlights.map((hl) => (
                          <div
                            key={hl.id}
                            onClick={() => {
                              setCurrentChapterIndex(hl.chapterIndex);
                              setIsSidebarOpen(false);
                            }}
                            className="p-2.5 rounded-lg border border-gray-400/10 bg-black/5 text-xs space-y-1 hover:bg-black/10 cursor-pointer transition"
                          >
                            <div className="flex justify-between text-[9px] font-bold font-mono tracking-wide opacity-50 uppercase">
                              <span>Chapter {hl.chapterIndex + 1}</span>
                              <span className={`w-2 h-2 rounded-full ${
                                hl.color === 'yellow' ? 'bg-yellow-400' :
                                hl.color === 'green' ? 'bg-emerald-400' :
                                hl.color === 'blue' ? 'bg-cyan-400' : 'bg-rose-400'
                              }`}></span>
                            </div>
                            <p className="line-clamp-2 italic opacity-85 leading-snug">"{hl.text}"</p>
                            {hl.note && (
                              <div className="mt-1 p-1 bg-amber-500/10 border-l border-amber-500 text-[10px] rounded-r text-gray-700 dark:text-gray-300">
                                <span className="font-bold font-mono text-[9px] text-amber-800 uppercase block">Marginalia</span>
                                {hl.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
