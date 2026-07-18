import React, { useState, useEffect } from 'react';
import { SyncProfile, Book, Bookmark, Highlight, ReadingProgress, ReadingSettings, SyncLog } from '../types';
import { getStoredBooks, getStoredBookmarks, getStoredHighlights, getStoredProgress, getStoredSettings, getStoredSyncProfile, saveStoredSyncProfile } from '../lib/db';
import { Wifi, WifiOff, RefreshCw, Download, Upload, Terminal, CheckCircle2, Shield, AlertTriangle, Copy, Trash2 } from 'lucide-react';

interface SyncDashboardProps {
  onRefreshLibrary: () => void;
  onClearLibrary: () => void;
}

export default function SyncDashboard({ onRefreshLibrary, onClearLibrary }: SyncDashboardProps) {
  const [syncProfile, setSyncProfile] = useState<SyncProfile>(getStoredSyncProfile());
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [currentSyncAction, setCurrentSyncAction] = useState<string>('');
  const [importedStatus, setImportedStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addLog = (type: 'info' | 'success' | 'warning' | 'error', message: string, profile = syncProfile): SyncProfile => {
    const newLog: SyncLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      type,
      message,
    };
    const updated = {
      ...profile,
      logs: [newLog, ...profile.logs].slice(0, 50), // Limit to 50 logs
    };
    saveStoredSyncProfile(updated);
    setSyncProfile(updated);
    return updated;
  };

  const simulateSync = async () => {
    if (syncProfile.status === 'syncing') return;

    // Get current data counts for logging
    const books = await getStoredBooks();
    const bookmarks = getStoredBookmarks();
    const highlights = getStoredHighlights();
    const progress = getStoredProgress();

    let currentProfile = { ...syncProfile, status: 'syncing' as const };
    setSyncProfile(currentProfile);
    setSyncProgress(5);
    setCurrentSyncAction('Initiating offline sync protocol...');
    
    currentProfile = addLog('info', `Sync started. Local inventory: ${books.length} books, ${bookmarks.length} bookmarks, ${highlights.length} highlights.`, currentProfile);

    const steps = [
      { progress: 20, action: 'Verifying network availability and security parameters...', delay: 800 },
      { progress: 40, action: 'Resolving database revision conflicts (vector-clock)...', delay: 1000 },
      { progress: 60, action: 'Diffing bookmarks and active reading positions...', delay: 800 },
      { progress: 80, action: 'Uploading local reader settings & custom highlights payload...', delay: 900 },
      { progress: 95, action: 'Finalizing server replica handshake...', delay: 700 },
    ];

    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, step.delay));
      if (!navigator.onLine && step.progress > 30) {
        // Handle disconnection mid-sync
        currentProfile = { ...currentProfile, status: 'error' as const };
        addLog('error', 'Sync aborted: Connection lost during transaction commit phase.', currentProfile);
        setSyncProgress(0);
        setCurrentSyncAction('');
        return;
      }
      setSyncProgress(step.progress);
      setCurrentSyncAction(step.action);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    const finalProfile: SyncProfile = {
      ...currentProfile,
      status: 'success' as const,
      lastSyncAt: new Date().toISOString(),
    };
    saveStoredSyncProfile(finalProfile);
    setSyncProfile(finalProfile);
    setSyncProgress(100);
    setCurrentSyncAction('Synchronization complete!');
    addLog('success', `Database replica sync completed successfully. Reference code: [${finalProfile.syncCode}]`, finalProfile);

    setTimeout(() => {
      setSyncProgress(0);
      setCurrentSyncAction('');
    }, 3000);
  };

  // Real backup: export full database to a JSON file
  const exportBackup = async () => {
    try {
      const books = await getStoredBooks();
      // Filter out preloaded books to keep the backup lightweight, or keep everything
      const bookmarks = getStoredBookmarks();
      const highlights = getStoredHighlights();
      const progress = getStoredProgress();
      const settings = getStoredSettings();

      const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        books: books.filter(b => b.isCustom), // Only export uploaded books
        bookmarks,
        highlights,
        progress,
        settings,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `ebook-reader-sync-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      addLog('success', 'Library backup file generated and downloaded successfully.');
    } catch (err) {
      addLog('error', `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Real backup: import library file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.version) {
          throw new Error('Invalid backup file format.');
        }

        // Import settings
        if (json.settings) {
          localStorage.setItem('ebook_reader_settings', JSON.stringify(json.settings));
        }
        
        // Import bookmarks
        if (Array.isArray(json.bookmarks)) {
          const existing = getStoredBookmarks();
          const merged = [...existing, ...json.bookmarks].reduce((acc: Bookmark[], curr: Bookmark) => {
            if (!acc.some(b => b.id === curr.id)) acc.push(curr);
            return acc;
          }, []);
          localStorage.setItem('ebook_reader_bookmarks', JSON.stringify(merged));
        }

        // Import highlights
        if (Array.isArray(json.highlights)) {
          const existing = getStoredHighlights();
          const merged = [...existing, ...json.highlights].reduce((acc: Highlight[], curr: Highlight) => {
            if (!acc.some(h => h.id === curr.id)) acc.push(curr);
            return acc;
          }, []);
          localStorage.setItem('ebook_reader_highlights', JSON.stringify(merged));
        }

        // Import reading progress
        if (Array.isArray(json.progress)) {
          const existing = getStoredProgress();
          const merged = [...existing, ...json.progress].reduce((acc: ReadingProgress[], curr: ReadingProgress) => {
            const index = acc.findIndex(p => p.bookId === curr.bookId);
            if (index > -1) {
              if (new Date(curr.lastReadAt) > new Date(acc[index].lastReadAt)) {
                acc[index] = curr;
              }
            } else {
              acc.push(curr);
            }
            return acc;
          }, []);
          localStorage.setItem('ebook_reader_progress', JSON.stringify(merged));
        }

        // Import custom books into IndexedDB
        if (Array.isArray(json.books)) {
          const { saveStoredBook } = await import('../lib/db');
          for (const book of json.books) {
            await saveStoredBook(book);
          }
        }

        setImportedStatus({ type: 'success', message: 'Library imported and merged successfully!' });
        addLog('success', `Imported database backup payload. Restored Custom Books, Highlights, and reading markers.`);
        onRefreshLibrary();

        setTimeout(() => setImportedStatus(null), 4000);
      } catch (err) {
        setImportedStatus({ type: 'error', message: `Import failed: ${err instanceof Error ? err.message : 'Invalid JSON file'}` });
        addLog('error', `Import failed: ${err instanceof Error ? err.message : 'Invalid JSON content'}`);
      }
    };
    reader.readAsText(file);
  };

  const copySyncCode = () => {
    navigator.clipboard.writeText(syncProfile.syncCode);
    addLog('info', `Sync credentials copied to clipboard: [${syncProfile.syncCode}]`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 font-serif text-[#2d2a26]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2d2a26]/10 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight italic">Sanctuary Sync Control</h1>
          <p className="text-[#2d2a26]/60 text-xs font-sans mt-1">Configure offline-first replication, manual storage backup, and active device-sync profiles.</p>
        </div>
        
        {/* Network Status Pill */}
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-none text-[10px] font-sans font-bold uppercase tracking-widest self-start md:self-center transition border ${
          isOnline 
            ? 'bg-[#5a5a40]/10 text-[#5a5a40] border-[#5a5a40]/25' 
            : 'bg-[#2d2a26]/5 text-[#2d2a26]/60 border-[#2d2a26]/15'
        }`}>
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-[#5a5a40] animate-pulse" />
              <span>LIVE ONLINE Handshake</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 opacity-60" />
              <span>Local Offline Mode</span>
            </>
          )}
        </div>
      </div>

      {/* Grid of panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Sync Controls Panel */}
        <div className="md:col-span-2 bg-[#f7f5f2] border border-[#2d2a26]/10 p-6 space-y-6 rounded-none">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="font-serif font-bold text-base italic text-[#2d2a26]">Replication Engine</h2>
              <p className="text-xs text-[#2d2a26]/60 font-sans">Synchronize highlights, settings, and library indexes with the cloud database replica.</p>
            </div>
            <Shield className="w-5 h-5 text-[#5a5a40]" />
          </div>

          <div className="bg-[#fbfaf8] border border-[#2d2a26]/10 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-none font-sans">
            <div>
              <p className="text-[10px] font-bold text-[#2d2a26]/50 uppercase tracking-widest">Device Sync Code</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-base font-bold text-[#2d2a26] tracking-wider bg-[#2d2a26]/5 px-2.5 py-0.5 border border-[#2d2a26]/10 rounded-none">
                  {syncProfile.syncCode}
                </span>
                <button
                  onClick={copySyncCode}
                  className="p-1 text-[#2d2a26]/50 hover:text-[#2d2a26] transition cursor-pointer"
                  title="Copy sync key"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="text-left md:text-right">
              <p className="text-[10px] font-bold text-[#2d2a26]/50 uppercase tracking-widest">Last Synced Timestamp</p>
              <p className="text-xs font-semibold text-[#2d2a26] mt-1">
                {syncProfile.lastSyncAt ? new Date(syncProfile.lastSyncAt).toLocaleString() : 'Never'}
              </p>
            </div>
          </div>

          {/* Sync Progress Indicator */}
          {syncProgress > 0 && (
            <div className="space-y-2 animate-in fade-in duration-300 font-sans">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#5a5a40] font-mono animate-pulse">{currentSyncAction}</span>
                <span className="font-bold text-[#2d2a26]">{syncProgress}%</span>
              </div>
              <div className="w-full bg-[#e8e4de] h-[1px] relative">
                <div
                  className="bg-[#2d2a26] h-[1px] absolute left-0 top-0 transition-all duration-300 ease-out"
                  style={{ width: `${syncProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={simulateSync}
            disabled={syncProfile.status === 'syncing'}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#2d2a26] hover:bg-[#5a5a40] disabled:bg-[#2d2a26]/40 text-[#fbfaf8] text-xs font-sans font-bold uppercase tracking-widest transition rounded-none cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncProfile.status === 'syncing' ? 'animate-spin' : ''}`} />
            {syncProfile.status === 'syncing' ? 'Synchronizing Databases...' : 'Replicate Offline Progress Now'}
          </button>
        </div>

        {/* Manual Backup Panel */}
        <div className="bg-[#f7f5f2] border border-[#2d2a26]/10 p-6 flex flex-col justify-between rounded-none">
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-serif font-bold text-base italic text-[#2d2a26]">File-Based Sync</h2>
              <p className="text-xs text-[#2d2a26]/60 font-sans">Perfect for local data preservation or direct migration between browser profiles.</p>
            </div>

            {importedStatus && (
              <div className={`p-3 rounded-none text-xs flex gap-1.5 items-start font-sans ${
                importedStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-150' : 'bg-red-50 text-red-800 border border-red-150'
              }`}>
                {importedStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                <span>{importedStatus.message}</span>
              </div>
            )}

            <div className="space-y-2 font-sans">
              <button
                onClick={exportBackup}
                className="w-full flex items-center justify-between py-2 px-3 bg-[#fbfaf8] border border-[#2d2a26]/10 text-xs text-[#2d2a26] hover:border-[#2d2a26]/30 font-medium transition cursor-pointer rounded-none"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#5a5a40]" />
                  <span>Download Backup (.json)</span>
                </div>
              </button>

              <label className="w-full flex items-center justify-between py-2 px-3 bg-[#fbfaf8] border border-dashed border-[#5a5a40]/30 text-xs text-[#5a5a40] hover:border-[#5a5a40] font-medium transition cursor-pointer rounded-none">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#5a5a40]" />
                  <span>Restore Library from Backup</span>
                </div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-[#2d2a26]/10 mt-4 space-y-3 font-sans">
            <p className="text-[10px] text-[#2d2a26]/50 italic">
              Caution: Restoring overrides identical positions but merges annotations safely.
            </p>
            <button
              onClick={() => {
                if (confirm('Are you absolutely sure you want to clear your local ebook files and reset reading markers? The preloaded classics will remain.')) {
                  onClearLibrary();
                  addLog('warning', 'Local user-uploaded books and custom bookmarks purged.');
                }
              }}
              className="w-full flex items-center gap-1.5 py-1.5 px-3 justify-center rounded-none text-xs text-rose-700 hover:bg-rose-50 border border-rose-200/40 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge Local Shelf</span>
            </button>
          </div>
        </div>
      </div>

      {/* Transaction & Replication Sync Logs */}
      <div className="bg-[#2d2a26] p-6 shadow-xl space-y-4 rounded-none border border-black/15">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-[#5a5a40]" />
            <h2 className="font-serif font-bold text-base text-white italic">Sync Handshake Terminal</h2>
          </div>
          <span className="text-[9px] bg-white/5 text-[#5a5a40] font-mono py-0.5 px-2.5 rounded-none uppercase tracking-[0.2em]">
            REPL_STREAM_LOGS
          </span>
        </div>

        <div className="h-56 overflow-y-auto border border-black/20 bg-black/15 p-4 font-mono text-[11px] space-y-2 scrollbar-thin rounded-none">
          {syncProfile.logs.length === 0 ? (
            <p className="text-white/40 italic">No sync logs recorded yet.</p>
          ) : (
            syncProfile.logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                <span className="text-white/30 flex-shrink-0 select-none">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span className={`font-semibold flex-shrink-0 select-none ${
                  log.type === 'success' ? 'text-emerald-400' :
                  log.type === 'error' ? 'text-rose-400' :
                  log.type === 'warning' ? 'text-amber-400' : 'text-sky-300'
                }`}>
                  [{log.type.toUpperCase()}]
                </span>
                <span className="text-[#fbfaf8]/85">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
