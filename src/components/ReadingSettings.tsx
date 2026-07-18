import { ReadingSettings as SettingsType } from '../types';
import { Type, Moon, Sun, AlignJustify, Eye, HelpCircle, Columns, ChevronDown, RefreshCw } from 'lucide-react';

interface ReadingSettingsProps {
  settings: SettingsType;
  onUpdateSettings: (settings: SettingsType) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReadingSettings({
  settings,
  onUpdateSettings,
  isOpen,
  onClose,
}: ReadingSettingsProps) {
  if (!isOpen) return null;

  const updateField = <K extends keyof SettingsType>(field: K, value: SettingsType[K]) => {
    onUpdateSettings({
      ...settings,
      [field]: value,
    });
  };

  const themes = [
    { id: 'light', name: 'Sanctuary', bg: 'bg-[#fbfaf8]', text: 'text-[#2d2a26]', border: 'border-[#2d2a26]/15' },
    { id: 'sepia', name: 'Paper', bg: 'bg-[#F4ECD8]', text: 'text-[#5C4033]', border: 'border-[#E6D5B8]' },
    { id: 'dim', name: 'Dim', bg: 'bg-[#252830]', text: 'text-[#E3E4E6]', border: 'border-[#313644]' },
    { id: 'dark', name: 'Night', bg: 'bg-[#0F1015]', text: 'text-[#A0A5B5]', border: 'border-[#1B1D26]' },
  ] as const;

  const fonts = [
    { id: 'serif', name: 'Bookish (Serif)', class: 'font-serif' },
    { id: 'sans', name: 'Modern (Sans)', class: 'font-sans' },
    { id: 'lexend', name: 'Dyslexic Friend', class: 'font-lexend' },
    { id: 'mono', name: 'Technical (Mono)', class: 'font-mono' },
  ] as const;

  const spacing = [
    { id: 'tight', name: '1.2x', value: 'tight' },
    { id: 'normal', name: '1.5x', value: 'normal' },
    { id: 'relaxed', name: '2.0x', value: 'relaxed' },
  ] as const;

  const margins = [
    { id: 'narrow', name: 'Narrow', desc: 'More content' },
    { id: 'normal', name: 'Normal', desc: 'Balanced' },
    { id: 'wide', name: 'Wide', desc: 'Comfortable' },
  ] as const;

  const layouts = [
    { id: 'single', name: 'One Page', desc: 'Standard single column' },
    { id: 'double', name: 'Book Layout', desc: 'Two columns side-by-side' },
    { id: 'scroll', name: 'Continuous', desc: 'Vertical endless scroll' },
  ] as const;

  return (
    <div className="absolute top-16 right-4 z-40 w-80 rounded-none bg-[#fbfaf8] p-5 shadow-2xl border border-[#2d2a26]/10 max-h-[85vh] overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-200 text-[#2d2a26] font-sans">
      <div className="flex items-center justify-between border-b border-[#2d2a26]/10 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-[#5a5a40]" />
          <h3 className="font-serif font-bold text-sm italic">Display Preferences</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-[#2d2a26]/55 hover:text-[#2d2a26] transition font-bold text-xs uppercase tracking-wider"
        >
          Done
        </button>
      </div>

      {/* Font Family Selection */}
      <div className="space-y-2 mb-4">
        <label className="text-[10px] font-bold text-[#2d2a26]/50 uppercase tracking-widest">Font Family</label>
        <div className="grid grid-cols-2 gap-1.5">
          {fonts.map((f) => (
            <button
              key={f.id}
              onClick={() => updateField('fontStyle', f.id)}
              className={`py-2 px-3 text-left rounded-none border text-xs transition duration-150 ${
                settings.fontStyle === f.id
                  ? 'border-[#2d2a26] bg-[#2d2a26] text-[#fbfaf8] font-bold'
                  : 'border-[#2d2a26]/10 hover:border-[#2d2a26]/30 bg-transparent'
              } ${f.class}`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size Adjuster */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-[#2d2a26]/50 uppercase tracking-widest">Font Size</label>
          <span className="text-xs text-[#2d2a26] font-mono font-medium">{settings.fontSize}px</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateField('fontSize', Math.max(12, settings.fontSize - 1))}
            className="flex-1 py-1.5 px-3 rounded-none border border-[#2d2a26]/10 text-xs text-[#2d2a26]/70 hover:bg-[#2d2a26]/5 transition font-medium active:scale-95 cursor-pointer"
            disabled={settings.fontSize <= 12}
          >
            A -
          </button>
          <button
            onClick={() => updateField('fontSize', Math.min(32, settings.fontSize + 1))}
            className="flex-1 py-1.5 px-3 rounded-none border border-[#2d2a26]/10 text-xs text-[#2d2a26]/70 hover:bg-[#2d2a26]/5 transition font-medium active:scale-95 cursor-pointer"
            disabled={settings.fontSize >= 32}
          >
            A +
          </button>
        </div>
      </div>

      {/* Theme Selection */}
      <div className="space-y-2 mb-4">
        <label className="text-[10px] font-bold text-[#2d2a26]/50 uppercase tracking-widest">Color Theme</label>
        <div className="grid grid-cols-4 gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => updateField('theme', t.id)}
              className={`relative flex flex-col items-center justify-center py-2.5 rounded-none border transition cursor-pointer ${t.bg} ${t.text} ${t.border} ${
                settings.theme === t.id ? 'ring-2 ring-[#5a5a40] ring-offset-1' : 'hover:scale-[1.03]'
              }`}
              title={t.name}
            >
              <span className="text-[9px] font-bold tracking-tight uppercase">{t.name}</span>
              {t.id === 'dark' && <Moon className="w-3 h-3 mt-1 opacity-70" />}
              {t.id === 'light' && <Sun className="w-3 h-3 mt-1 opacity-70" />}
              {t.id === 'sepia' && <AlignJustify className="w-3 h-3 mt-1 opacity-70" />}
              {t.id === 'dim' && <Eye className="w-3 h-3 mt-1 opacity-70" />}
            </button>
          ))}
        </div>
      </div>

      {/* Layout Mode */}
      <div className="space-y-2 mb-4">
        <label className="text-[10px] font-bold text-[#2d2a26]/50 uppercase tracking-widest">Layout Style</label>
        <div className="flex flex-col gap-1.5">
          {layouts.map((l) => (
            <button
              key={l.id}
              onClick={() => updateField('layoutMode', l.id)}
              className={`flex items-start gap-3 p-2.5 rounded-none border text-left transition cursor-pointer ${
                settings.layoutMode === l.id
                  ? 'border-[#2d2a26] bg-[#2d2a26]/5 text-[#2d2a26]'
                  : 'border-[#2d2a26]/10 hover:border-[#2d2a26]/30 bg-transparent'
              }`}
            >
              <div className="mt-0.5">
                {l.id === 'single' && <AlignJustify className="w-4 h-4 text-[#5a5a40]" />}
                {l.id === 'double' && <Columns className="w-4 h-4 text-[#5a5a40]" />}
                {l.id === 'scroll' && <ChevronDown className="w-4 h-4 text-[#5a5a40]" />}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">{l.name}</p>
                <p className="text-[10px] opacity-60 font-serif italic mt-0.5">{l.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Line Spacing */}
      <div className="space-y-2 mb-4">
        <label className="text-[10px] font-bold text-[#2d2a26]/50 uppercase tracking-widest">Line Height</label>
        <div className="grid grid-cols-3 gap-1.5">
          {spacing.map((s) => (
            <button
              key={s.id}
              onClick={() => updateField('lineSpacing', s.value)}
              className={`py-1.5 px-2 rounded-none border text-center text-xs transition cursor-pointer ${
                settings.lineSpacing === s.value
                  ? 'border-[#2d2a26] bg-[#2d2a26] text-[#fbfaf8] font-bold'
                  : 'border-[#2d2a26]/10 hover:bg-[#2d2a26]/5 text-[#2d2a26]/80'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Margins */}
      <div className="space-y-2 mb-4">
        <label className="text-[10px] font-bold text-[#2d2a26]/50 uppercase tracking-widest">Page Margins</label>
        <div className="grid grid-cols-3 gap-1.5">
          {margins.map((m) => (
            <button
              key={m.id}
              onClick={() => updateField('marginSize', m.id)}
              className={`py-1.5 px-2 rounded-none border text-center text-xs transition cursor-pointer ${
                settings.marginSize === m.id
                  ? 'border-[#2d2a26] bg-[#2d2a26] text-[#fbfaf8] font-bold'
                  : 'border-[#2d2a26]/10 hover:bg-[#2d2a26]/5 text-[#2d2a26]/80'
              }`}
              title={m.desc}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Eye Care Blue Light Warm Filter Slider */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold text-[#2d2a26]/50 uppercase tracking-widest">Eye Care Overlay</label>
          <span className="text-[10px] font-medium text-amber-700 font-mono">{settings.blueLightFilter}% warmth</span>
        </div>
        <input
          type="range"
          min="0"
          max="60"
          value={settings.blueLightFilter}
          onChange={(e) => updateField('blueLightFilter', parseInt(e.target.value))}
          className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
        />
      </div>

      {/* Auto Scroll Speed Slider (Scroll Mode Only) */}
      <div className="space-y-2 pt-2 border-t border-[#2d2a26]/10">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold text-[#2d2a26]/50 uppercase tracking-widest">Auto-Scroll Speed</label>
          <span className="text-[11px] font-bold text-[#5a5a40] font-mono">
            {settings.autoScrollSpeed === 0 ? 'Disabled' : `${settings.autoScrollSpeed}x`}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="10"
          value={settings.autoScrollSpeed}
          onChange={(e) => updateField('autoScrollSpeed', parseInt(e.target.value))}
          disabled={settings.layoutMode !== 'scroll'}
          className={`w-full h-1 rounded-none appearance-none cursor-pointer accent-[#5a5a40] ${
            settings.layoutMode !== 'scroll' ? 'bg-gray-150 opacity-40 cursor-not-allowed' : 'bg-gray-200'
          }`}
        />
        {settings.layoutMode !== 'scroll' && (
          <p className="text-[9px] text-[#2d2a26]/50 italic font-serif">Enable "Continuous" layout style to activate auto-scroll.</p>
        )}
      </div>
    </div>
  );
}
