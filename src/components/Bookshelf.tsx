import React, { useState, useRef } from 'react';
import { Book, ReadingProgress, Chapter } from '../types';
import { saveStoredBook, deleteStoredBook } from '../lib/db';
import { Search, UploadCloud, BookOpen, Clock, Heart, Filter, Trash2, CheckCircle2, ChevronRight, FileText } from 'lucide-react';

interface BookshelfProps {
  books: Book[];
  progressList: ReadingProgress[];
  onSelectBook: (bookId: string) => void;
  onRefreshLibrary: () => void;
}

export default function Bookshelf({
  books,
  progressList,
  onSelectBook,
  onRefreshLibrary,
}: BookshelfProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categories list
  const categories = ['All', ...Array.from(new Set(books.map((b) => b.category))), 'My Uploads'];

  // Filtered books
  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedCategory === 'All') return matchesSearch;
    if (selectedCategory === 'My Uploads') return matchesSearch && book.isCustom;
    return matchesSearch && book.category === selectedCategory;
  });

  const getBookProgress = (bookId: string): ReadingProgress | undefined => {
    return progressList.find((p) => p.bookId === bookId);
  };

  // TXT file parsing engine
  const parseAndSaveTxtBook = async (fileName: string, textContent: string) => {
    try {
      // Basic validation
      if (!textContent.trim()) {
        throw new Error('The uploaded file is empty.');
      }

      // Detect title and author
      let title = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
      let author = 'Unknown Author';

      // Simple scanning for title / author patterns
      const lines = textContent.split('\n').slice(0, 15);
      for (const line of lines) {
        const titleMatch = line.match(/(?:Title|TITLE):\s*(.*)/i);
        if (titleMatch) title = titleMatch[1].trim();

        const authorMatch = line.match(/(?:Author|AUTHOR):\s*(.*)/i);
        if (authorMatch) author = authorMatch[1].trim();
      }

      // Parse chapters
      // Split by lines and group into chapters
      const textLines = textContent.split('\n');
      const chapters: Chapter[] = [];
      let currentChapterTitle = 'Chapter I: Introduction';
      let currentChapterLines: string[] = [];

      for (let i = 0; i < textLines.length; i++) {
        const line = textLines[i];
        const isChapterHeading =
          /^(?:CHAPTER|Chapter|Letter|LETTER|PROLOGUE|Prologue)\s+[IVXLCDM\d]+/i.test(line.trim()) ||
          (line.trim().length < 60 &&
            /^(?:CHAPTER|Chapter|Letter|LETTER)\s+\w+/i.test(line.trim())) ||
          /^[IVXLCDM\d]+\.\s+[A-Z]/i.test(line.trim());

        if (isChapterHeading && i > 5) {
          // Push previous chapter
          if (currentChapterLines.join('\n').trim()) {
            chapters.push({
              id: `custom-ch-${chapters.length}-${Math.random()}`,
              title: currentChapterTitle,
              content: currentChapterLines.join('\n').trim(),
            } as any);
          }
          currentChapterTitle = line.trim();
          currentChapterLines = [];
        } else {
          currentChapterLines.push(line);
        }
      }

      // Add remaining lines
      if (currentChapterLines.join('\n').trim()) {
        chapters.push({
          id: `custom-ch-${chapters.length}-${Math.random()}`,
          title: currentChapterTitle,
          content: currentChapterLines.join('\n').trim(),
        } as any);
      }

      // If no chapter headers were identified, partition text into pages of ~1000 words
      if (chapters.length <= 1) {
        const allText = currentChapterLines.join('\n');
        const words = allText.split(/\s+/);
        const chunkSize = 1200; // Words per chapter
        const chunkedChapters = [];
        
        for (let i = 0; i < words.length; i += chunkSize) {
          const chunkWords = words.slice(i, i + chunkSize);
          const partNum = Math.floor(i / chunkSize) + 1;
          chunkedChapters.push({
            id: `custom-ch-${partNum}-${Math.random()}`,
            title: `Part ${partNum}`,
            content: chunkWords.join(' '),
          });
        }
        
        if (chunkedChapters.length > 0) {
          chapters.length = 0; // Clear
          chapters.push(...chunkedChapters);
        }
      }

      // Generate colorful gradients dynamically for the custom cover
      const gradients = [
        { start: 'from-violet-600', end: 'to-fuchsia-800' },
        { start: 'from-amber-600', end: 'to-orange-800' },
        { start: 'from-cyan-600', end: 'to-blue-800' },
        { start: 'from-emerald-600', end: 'to-teal-800' },
        { start: 'from-rose-600', end: 'to-pink-800' },
      ];
      const selectedGradient = gradients[Math.floor(Math.random() * gradients.length)];

      const totalWords = textContent.split(/\s+/).length;
      const sizeKB = Math.round(textContent.length / 1024);

      const newBook: Book = {
        id: `book-${Date.now()}`,
        title,
        author,
        description: `Custom text document parsed into ${chapters.length} reading sections. Imported locally on ${new Date().toLocaleDateString()}.`,
        category: 'My Uploads',
        coverColor: selectedGradient.start,
        coverColorEnd: selectedGradient.end,
        chapters,
        fileSize: `${sizeKB} KB`,
        isCustom: true,
        totalWords,
        addedAt: new Date().toISOString(),
      };

      await saveStoredBook(newBook);
      setUploadSuccess(`"${title}" imported successfully! Parsed ${chapters.length} chapters.`);
      onRefreshLibrary();
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to parse text document.');
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      setUploadError('Currently only plain text (.txt) files are supported for auto-parsing.');
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseAndSaveTxtBook(file.name, content);
    };
    reader.readAsText(file);
  };

  const handleDeleteBook = async (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering open book
    if (confirm('Are you sure you want to delete this book from your library?')) {
      await deleteStoredBook(bookId);
      onRefreshLibrary();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          parseAndSaveTxtBook(file.name, content);
        };
        reader.readAsText(file);
      } else {
        setUploadError('Drag & Drop only supports plain text (.txt) files.');
        setTimeout(() => setUploadError(null), 5000);
      }
    }
  };

  const getEditorialCoverColor = (title: string) => {
    const editorialColors = [
      'bg-[#2d2a26]', // notes / charcoal
      'bg-[#5a5a40]', // sage olive
      'bg-[#7a3b2c]', // terracotta
      'bg-[#3f4f60]', // slate steel
      'bg-[#7d6b58]', // vintage leather
      'bg-[#4f3824]', // mahogany
      'bg-[#4a533c]', // forest
      'bg-[#7a6240]', // mustard ochre
    ];
    const sum = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return editorialColors[sum % editorialColors.length];
  };

  const formatReadingTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 font-serif">
      {/* Search and Upload Top bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-[#2d2a26]/10 pb-6">
        <div className="relative w-full md:w-96 font-sans">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2d2a26]/40" />
          <input
            type="text"
            placeholder="Search volumes, authors, or markers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#f7f5f2] border border-[#2d2a26]/10 text-sm text-[#2d2a26] focus:outline-none focus:border-[#5a5a40] focus:ring-1 focus:ring-[#5a5a40] transition rounded-none"
          />
        </div>

        {/* Dynamic Category Selector */}
        <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto pb-1 max-w-full no-scrollbar font-sans">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition cursor-pointer rounded-none ${
                selectedCategory === cat
                  ? 'bg-[#2d2a26] text-[#fbfaf8]'
                  : 'bg-transparent border border-[#2d2a26]/10 text-[#2d2a26]/70 hover:border-[#2d2a26]/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Library and Drag/Drop Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Bookshelf Shelf (Col span 3) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex justify-between items-center border-b border-[#2d2a26]/10 pb-3">
            <h2 className="font-bold text-[#2d2a26] text-lg flex items-center gap-2 italic">
              <BookOpen className="w-5 h-5 text-[#5a5a40]" />
              <span>Volumes on Your Shelf</span>
              <span className="text-[10px] bg-[#5a5a40]/10 text-[#5a5a40] py-0.5 px-2.5 rounded-full font-bold ml-2 font-sans tracking-widest">
                {filteredBooks.length} TOTAL
              </span>
            </h2>
          </div>

          {filteredBooks.length === 0 ? (
            <div className="text-center py-24 bg-[#f7f5f2]/50 border border-dashed border-[#2d2a26]/15 space-y-4">
              <FileText className="w-10 h-10 text-[#2d2a26]/30 mx-auto" />
              <div className="space-y-1">
                <p className="font-serif italic text-[#2d2a26]/70 text-lg">Your library is silent</p>
                <p className="text-xs text-[#2d2a26]/50 max-w-xs mx-auto font-sans">
                  No books match this category. Drag and drop a .txt document into the workspace panel.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {filteredBooks.map((book) => {
                const progress = getBookProgress(book.id);
                const solidCoverColor = getEditorialCoverColor(book.title);
                return (
                  <div
                    key={book.id}
                    onClick={() => onSelectBook(book.id)}
                    className="group flex flex-col cursor-pointer bg-[#f7f5f2]/30 border border-[#2d2a26]/10 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                  >
                    {/* Cover Art - Vintage Style */}
                    <div className={`relative aspect-[3/4] ${solidCoverColor} p-5 flex flex-col justify-between text-[#fbfaf8] overflow-hidden`}>
                      {/* Classy Gold/Cream Inset Line Border */}
                      <div className="absolute inset-3.5 border border-white/10 pointer-events-none z-20"></div>

                      {/* Cover Spine Shadow Overlay */}
                      <div className="absolute left-0 top-0 bottom-0 w-3 bg-black/15 shadow-inner z-10 pointer-events-none"></div>
                      
                      {/* Metadata tag */}
                      <span className="text-[8px] font-sans bg-white/10 px-2 py-0.5 rounded-none font-bold self-start border border-white/10 uppercase tracking-[0.15em] z-20">
                        {book.category}
                      </span>

                      {/* Cover Title */}
                      <div className="space-y-1.5 z-20">
                        <h3 className="font-serif text-sm md:text-base leading-snug line-clamp-3 drop-shadow-sm font-bold">
                          {book.title}
                        </h3>
                        <p className="text-[10px] text-[#fbfaf8]/75 line-clamp-1 font-sans uppercase tracking-wider italic">
                          {book.author}
                        </p>
                      </div>

                      {/* Cover footer progress or actions */}
                      <div className="flex items-center justify-between z-20 pt-2 border-t border-white/10 font-sans text-[9px] text-[#fbfaf8]/60 uppercase tracking-widest">
                        <span>
                          {book.fileSize}
                        </span>

                        {book.isCustom && (
                          <button
                            onClick={(e) => handleDeleteBook(book.id, e)}
                            className="p-1 rounded-none bg-white/10 hover:bg-white/25 text-white transition z-30"
                            title="Remove volume"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Book Details below cover */}
                    <div className="p-4 space-y-3 flex-grow flex flex-col justify-between">
                      <div>
                        <h4 className="font-serif font-bold text-xs text-[#2d2a26] line-clamp-1 group-hover:text-[#5a5a40] transition">
                          {book.title}
                        </h4>
                        <p className="text-[10px] text-[#2d2a26]/60 font-sans uppercase tracking-wider">{book.author}</p>
                      </div>

                      {/* Progress Bar in Editorial Aesthetics */}
                      <div className="space-y-1.5 pt-1 border-t border-[#2d2a26]/5 font-sans">
                        <div className="flex justify-between text-[9px] text-[#2d2a26]/50 font-bold tracking-widest uppercase">
                          <span>Progress</span>
                          <span>{progress ? `${Math.round(progress.percentComplete)}%` : '0%'}</span>
                        </div>
                        <div className="w-full bg-[#e8e4de] h-[1px] relative">
                          <div
                            className="bg-[#2d2a26] h-[1px] absolute left-0 top-0 transition-all duration-500"
                            style={{ width: `${progress ? progress.percentComplete : 0}%` }}
                          ></div>
                        </div>
                        {progress && progress.readingTime && progress.readingTime > 0 && (
                          <div className="flex items-center gap-1 text-[9px] text-[#5a5a40] font-bold tracking-wider uppercase mt-1 select-none">
                            <Clock className="w-3 h-3" />
                            <span>Read for {formatReadingTime(progress.readingTime)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Upload & Info (Col span 1) */}
        <div className="space-y-6">
          <div className="bg-[#f7f5f2] border border-[#2d2a26]/10 p-6 space-y-5">
            <div>
              <h3 className="font-serif font-bold text-[#2d2a26] text-base italic">Add Personal Volumes</h3>
              <p className="text-xs text-[#2d2a26]/60 font-sans mt-1">Auto-parse raw plain text manuscripts (.txt) into beautiful, paginated reading chapters offline.</p>
            </div>

            {/* Error notifications */}
            {uploadError && (
              <div className="p-3 bg-red-50 text-red-800 text-xs font-sans border border-red-100">
                {uploadError}
              </div>
            )}

            {/* Success notifications */}
            {uploadSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-sans border border-emerald-100 flex gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {/* Drag and Drop Zone - Editorial Look */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 font-sans ${
                isDragOver
                  ? 'border-[#5a5a40] bg-[#5a5a40]/5 text-[#2d2a26]'
                  : 'border-[#2d2a26]/20 hover:border-[#2d2a26]/40 bg-[#fbfaf8] text-[#2d2a26]/60'
              }`}
            >
              <UploadCloud className="w-7 h-7 text-[#5a5a40]" />
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[#2d2a26]">Choose .txt file</p>
                <p className="text-[10px] opacity-60">or drag & drop text document here</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Quick Stats Panel styled with deep vintage charcoal */}
          <div className="bg-[#2d2a26] text-[#fbfaf8] p-6 space-y-5 shadow-lg border border-black/15">
            <h3 className="font-serif italic text-lg tracking-tight border-b border-white/10 pb-2 text-white">Active Reading Sanctuary</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-2 font-sans">
              <div className="space-y-0.5">
                <p className="text-[8px] text-[#fbfaf8]/50 uppercase tracking-widest font-bold">Total Library</p>
                <p className="text-lg font-serif italic text-white">{books.length} Volumes</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] text-[#fbfaf8]/50 uppercase tracking-widest font-bold">In Progress</p>
                <p className="text-lg font-serif italic text-white">
                  {progressList.filter((p) => p.percentComplete > 0 && p.percentComplete < 100).length} Books
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] text-[#fbfaf8]/50 uppercase tracking-widest font-bold">Completed</p>
                <p className="text-lg font-serif italic text-white">
                  {progressList.filter((p) => p.percentComplete === 100).length} Books
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] text-[#fbfaf8]/50 uppercase tracking-widest font-bold">Local Uploads</p>
                <p className="text-lg font-serif italic text-white">{books.filter((b) => b.isCustom).length} Volumes</p>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-[#fbfaf8]/60 font-sans uppercase tracking-widest">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#5a5a40]" />
                <span>Sandbox Offline Handshake Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
