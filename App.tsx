
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Settings, Play, Download, Trash2, CheckCircle, AlertCircle, Loader2, Sparkles, BookOpen, ClipboardList } from 'lucide-react';
import { SRTBlock, ProcessingState } from './types';
import { parseSRT, buildSRT } from './utils/srtParser';
import { rewriteSRTBlocks } from './services/geminiService';

const App: React.FC = () => {
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [pastedContent, setPastedContent] = useState<string>('');
  const [originalFile, setOriginalFile] = useState<{ name: string; blocks: SRTBlock[] } | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>(
    "Tập trung vào sự kịch tính khi sinh tồn. Nhấn mạnh vào các quyết định xây dựng và chiến đấu với quái vật."
  );
  
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    error: null,
    result: null,
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.isProcessing && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.result, state.isProcessing]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const blocks = parseSRT(content);
        setOriginalFile({ name: file.name, blocks });
        setState({ isProcessing: false, progress: 0, error: null, result: null });
      } catch (err) {
        setState(prev => ({ ...prev, error: `Lỗi định dạng file ${file.name}. Vui lòng kiểm tra lại.` }));
      }
    };
    reader.readAsText(file);
  };

  const handlePasteProcess = () => {
    if (!pastedContent.trim()) {
      setState(prev => ({ ...prev, error: "Vui lòng dán nội dung SRT." }));
      return;
    }
    try {
      const blocks = parseSRT(pastedContent);
      setOriginalFile({ name: 'pasted_subtitles.srt', blocks });
      setState(prev => ({ ...prev, error: null }));
    } catch (err) {
      setState(prev => ({ ...prev, error: "Định dạng mã SRT không hợp lệ." }));
    }
  };

  const processSRT = async () => {
    let blocksToProcess = originalFile?.blocks;

    if (inputMode === 'paste' && !originalFile) {
        try {
            const blocks = parseSRT(pastedContent);
            blocksToProcess = blocks;
            setOriginalFile({ name: 'pasted_subtitles.srt', blocks });
        } catch (e) {
            setState(prev => ({ ...prev, error: "Vui lòng kiểm tra mã SRT đã dán." }));
            return;
        }
    }

    if (!blocksToProcess || blocksToProcess.length === 0) {
      setState(prev => ({ ...prev, error: "Chưa có nội dung phụ đề để xử lý." }));
      return;
    }

    setState({ isProcessing: true, progress: 0, error: null, result: [] });

    try {
      await rewriteSRTBlocks(
        blocksToProcess,
        customPrompt,
        (newBatch) => {
          setState(prev => ({
            ...prev,
            result: [...(prev.result || []), ...newBatch]
          }));
        },
        (progress) => setState(prev => ({ ...prev, progress }))
      );
      setState(prev => ({ ...prev, isProcessing: false }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: `Lỗi: ${err.message || 'Không thể kết nối với AI'}` 
      }));
    }
  };

  const downloadResult = () => {
    if (!state.result) return;
    const srtContent = buildSRT(state.result);
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `[VIET]_${originalFile?.name || 'subtitles.srt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setOriginalFile(null);
    setPastedContent('');
    setState({ isProcessing: false, progress: 0, error: null, result: null });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-600 rounded-lg minecraft-shadow">
            <Sparkles className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">MC Subtitle AI</h1>
            <p className="text-slate-400 text-sm italic">Dịch và viết lại phụ đề phong cách kể chuyện kịch tính</p>
          </div>
        </div>
        <button 
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-800"
        >
          <Trash2 size={18} /> Làm mới toàn bộ
        </button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* Main Input Section */}
          <section className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText size={20} className="text-blue-400" /> Nhập phụ đề
              </h2>
            </div>

            <div className="flex p-1 bg-slate-950 rounded-xl mb-6 border border-slate-800">
              <button 
                onClick={() => setInputMode('upload')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${inputMode === 'upload' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Upload size={14} /> Tải File .srt
              </button>
              <button 
                onClick={() => setInputMode('paste')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${inputMode === 'paste' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <ClipboardList size={14} /> Dán Mã trực tiếp
              </button>
            </div>
            
            <div className="space-y-4">
              {inputMode === 'upload' ? (
                <div className={`relative border-2 border-dashed rounded-2xl p-8 transition-all group ${originalFile && inputMode === 'upload' ? 'border-green-500 bg-green-500/5' : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/20'}`}>
                  <input 
                    type="file" 
                    accept=".srt" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center text-center">
                    {originalFile && inputMode === 'upload' ? (
                      <>
                        <CheckCircle className="text-green-500 mb-3" size={32} />
                        <span className="text-sm font-bold text-green-400 truncate w-full px-4">{originalFile.name}</span>
                        <span className="text-[10px] text-slate-500 mt-1 uppercase">Sẵn sàng xử lý</span>
                      </>
                    ) : (
                      <>
                        <div className="p-3 bg-slate-800 rounded-full mb-3 group-hover:scale-110 transition-transform">
                          <Upload className="text-slate-400" size={24} />
                        </div>
                        <span className="text-sm font-medium text-slate-400">Kéo thả hoặc Click để chọn file</span>
                        <span className="text-[10px] text-slate-600 mt-1 uppercase">Định dạng hỗ trợ: .SRT</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                   <textarea 
                    value={pastedContent}
                    onChange={(e) => {
                        setPastedContent(e.target.value);
                        if (originalFile?.name === 'pasted_subtitles.srt') setOriginalFile(null);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-slate-400 h-56 focus:ring-2 focus:ring-blue-500/50 outline-none resize-none transition-all placeholder:text-slate-800"
                    placeholder="Dán toàn bộ mã (nội dung) của file SRT vào đây..."
                  />
                  <button 
                    onClick={handlePasteProcess}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700"
                  >
                    Xác nhận mã vừa dán
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* AI Settings Section */}
          <section className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings size={20} className="text-orange-400" /> Tùy chỉnh câu chuyện
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Yêu cầu bổ sung cho AI</label>
                <textarea 
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 h-28 focus:ring-2 focus:ring-green-500/50 outline-none resize-none transition-all"
                  placeholder="Ví dụ: Kể theo tông giọng hài hước, hoặc thêm các câu cảm thán khi thấy Creeper..."
                />
              </div>

              <button 
                onClick={processSRT}
                disabled={state.isProcessing || (!originalFile && !pastedContent.trim())}
                className={`w-full py-5 rounded-xl flex items-center justify-center gap-3 font-bold uppercase tracking-[0.2em] text-sm minecraft-btn shadow-lg transition-all ${
                  state.isProcessing || (!originalFile && !pastedContent.trim())
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-500 text-white minecraft-shadow'
                }`}
              >
                {state.isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    {state.progress}%
                  </>
                ) : (
                  <>
                    <Play size={20} fill="currentColor" />
                    Bắt đầu dịch ngay
                  </>
                )}
              </button>
            </div>
          </section>

          <div className="bg-blue-600/5 border border-blue-600/10 p-5 rounded-2xl">
            <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
              <BookOpen size={14} /> Phong cách kể chuyện
            </h3>
            <ul className="space-y-2 text-[12px] text-slate-500 leading-relaxed">
              <li className="flex gap-2"><span>•</span> <span>Xưng <b>"tôi"</b>, ngôi thứ nhất.</span></li>
              <li className="flex gap-2"><span>•</span> <span>Dịch gãy gọn, tập trung hành động.</span></li>
              <li className="flex gap-2"><span>•</span> <span>Giữ nguyên thời gian cho <b>AI Voice/CapCut</b>.</span></li>
            </ul>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {state.error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 animate-in fade-in zoom-in duration-300">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{state.error}</p>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[750px] overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${state.isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                <h2 className="text-lg font-bold text-white">Kết quả xem trước</h2>
              </div>
              
              {state.result && state.result.length > 0 && !state.isProcessing && (
                <button 
                  onClick={downloadResult}
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all minecraft-shadow minecraft-btn text-sm"
                >
                  <Download size={18} /> Tải file .SRT
                </button>
              )}
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-[13px] scroll-smooth bg-slate-950/20"
            >
              {(!originalFile && !pastedContent.trim()) && !state.result && (
                <div className="h-full flex flex-col items-center justify-center text-slate-800 gap-6 opacity-40">
                  <div className="p-8 bg-slate-900/50 rounded-full border border-slate-800">
                    <ClipboardList size={80} strokeWidth={1} />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-sans font-bold text-lg text-slate-700">Chưa có dữ liệu</p>
                    <p className="font-sans text-sm max-w-[240px]">Hãy dán mã SRT hoặc tải file từ cột bên trái để AI bắt đầu viết truyện.</p>
                  </div>
                </div>
              )}

              {(state.result && state.result.length > 0) ? (
                <>
                  {state.result.map((block) => (
                    <div key={block.index} className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800/50 hover:border-green-800/30 transition-all group animate-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="bg-green-600/20 text-green-500 px-2 py-0.5 rounded text-[10px] font-bold">BLOCK #{block.index}</span>
                        <span className="text-slate-600 bg-slate-950 px-3 py-1 rounded-lg text-[11px] font-mono border border-slate-800">{block.timestamp}</span>
                        <span className="text-[10px] text-slate-700 ml-auto font-sans font-bold uppercase tracking-widest">{block.duration.toFixed(2)}s</span>
                      </div>
                      <div className="text-slate-100 leading-relaxed font-sans text-[17px] font-medium">
                        {block.content}
                      </div>
                    </div>
                  ))}
                  
                  {state.isProcessing && (
                    <div className="flex items-center justify-center py-10 gap-4 text-slate-500 font-sans animate-pulse">
                      <Loader2 className="animate-spin text-green-500" size={24} />
                      <span className="text-sm font-bold tracking-widest uppercase">AI đang kể tiếp...</span>
                    </div>
                  )}
                </>
              ) : originalFile && !state.isProcessing ? (
                <div className="space-y-4 opacity-50">
                  <p className="text-center text-slate-700 text-xs uppercase tracking-[0.3em] py-4">Sẵn sàng để xử lý nội dung bên dưới</p>
                  {originalFile.blocks.map((block) => (
                    <div key={block.index} className="bg-slate-900/20 p-4 rounded-xl border border-slate-800/30">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-slate-600 font-bold text-[10px]">#{block.index}</span>
                        <span className="text-slate-700 text-[10px]">{block.timestamp}</span>
                      </div>
                      <div className="text-slate-600 font-sans italic text-sm">
                        {block.content}
                      </div>
                    </div>
                  ))}
                </div>
              ) : state.isProcessing && (!state.result || state.result.length === 0) ? (
                <div className="h-full flex flex-col items-center justify-center space-y-8">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full border-4 border-slate-900 border-t-green-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="text-green-500 animate-bounce" size={32} />
                    </div>
                  </div>
                  <div className="text-center space-y-3">
                    <p className="text-2xl font-black text-white tracking-tighter uppercase">Đang khởi tạo cốt truyện...</p>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">AI đang phân tích nội dung phụ đề gốc để viết lại kịch tính nhất.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
      
      <footer className="max-w-6xl mx-auto mt-12 py-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-600 text-[11px] font-bold uppercase tracking-[0.2em]">
        <p>MC Subtitle AI Storyteller &copy; 2024</p>
        <p>Phát triển cho Minecraft Content Creators</p>
      </footer>
    </div>
  );
};

export default App;
