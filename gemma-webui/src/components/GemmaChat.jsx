import { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.min.css';
import { 
  Bot, User, Paperclip, Send, Loader2, Plus, X, 
  Trash2, MessageSquare, UploadCloud 
} from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { motion, AnimatePresence } from 'framer-motion';

const OLLAMA_URL = "/gemma-api/generate";

const renderer = new marked.Renderer();
renderer.code = ({ text, lang }) => {
  const validLang = hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language: validLang }).value;
  const encodedCode = encodeURIComponent(text); 
  return `
    <div class="relative group my-6 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-[#0d0d0e]">
      <div class="flex items-center justify-between px-4 py-2 bg-[#1e1e20] border-b border-white/5">
        <span class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">${validLang}</span>
        <button class="copy-code-btn flex items-center gap-1.5 hover:text-white text-slate-400 transition-colors text-xs" data-code="${encodedCode}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          <span>Copiar</span>
        </button>
      </div>
      <pre class="p-4 overflow-x-auto custom-scrollbar"><code class="hljs ${validLang} text-sm">${highlighted}</code></pre>
    </div>
  `;
};
marked.setOptions({ renderer, gfm: true, breaks: true });

export default function GemmaChat() {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('gemma-sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([{ 
    role: "ai", 
    content: "¡Hola! Soy Gemma. Todo el sistema está listo. ¿En qué puedo ayudarte?", 
    isThinking: false 
  }]);
  
  const globalHistoryRef = useRef("");
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachedFileText, setAttachedFileText] = useState("");
  const [attachedFileName, setAttachedFileName] = useState("");
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!isProcessing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isProcessing]);

  useEffect(() => {
    const handleCopy = async (e) => {
      const btn = e.target.closest('.copy-code-btn');
      if (btn) {
        const code = decodeURIComponent(btn.getAttribute('data-code'));
        await navigator.clipboard.writeText(code);
        const span = btn.querySelector('span');
        span.innerText = "¡Copiado!";
        btn.classList.add("text-emerald-400");
        setTimeout(() => {
          span.innerText = "Copiar";
          btn.classList.remove("text-emerald-400");
        }, 2000);
      }
    };
    const container = chatContainerRef.current;
    if (container) container.addEventListener('click', handleCopy);
    return () => { if (container) container.removeEventListener('click', handleCopy); };
  }, []);

  useEffect(() => {
    localStorage.setItem('gemma-sessions', JSON.stringify(sessions));
  }, [sessions]);

  const handleNewChat = () => {
    if (isProcessing) return;
    setCurrentSessionId(null);
    setMessages([{ role: "ai", content: "¿En qué puedo ayudarte hoy?", isThinking: false }]);
    globalHistoryRef.current = "";
    if (textareaRef.current) textareaRef.current.focus();
  };

  const loadSession = (id) => {
    if (isProcessing) return;
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
      globalHistoryRef.current = session.rawHistory;
    }
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    if (isProcessing) return;
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) handleNewChat();
  };

  const processFile = async (file) => {
    if (!file) return;
    setAttachedFileName(file.name);
    setIsFileLoading(true);
    const reader = new FileReader();
    
    if (file.type === "application/pdf") {
      reader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target.result);
          const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + "\n";
          }
          setAttachedFileText(fullText);
        } catch (err) { setAttachedFileName("Error leyendo PDF"); }
        finally { setIsFileLoading(false); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        setAttachedFileText(e.target.result);
        setIsFileLoading(false);
      };
      reader.readAsText(file);
    }
  };

  const handleSendMessage = async () => {
    const text = prompt.trim();
    if (!text && !attachedFileText) return;

    let userDisplay = text;
    if (attachedFileName) userDisplay += `\n\n[📎 Documento: ${attachedFileName}]`;

    const newMessages = [...messages, { role: "user", content: userDisplay }];
    setMessages(newMessages);
    setPrompt("");
    setIsProcessing(true);
    setMessages([...newMessages, { role: "ai", content: "", isThinking: true }]);

    let activeId = currentSessionId || Date.now().toString();
    if (!currentSessionId) setCurrentSessionId(activeId);

    let promptContent = text;
    if (attachedFileText) promptContent += `\n\nContenido del adjunto:\n${attachedFileText}\n`;

    const turnPrompt = `<|turn>user\n${promptContent}<turn|>\n<|turn>model\n<|channel>thought\n`;
    const fullPrompt = globalHistoryRef.current + turnPrompt;
    
    setAttachedFileText("");
    setAttachedFileName("");

    try {
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: "gemma4:26b", 
          prompt: fullPrompt, 
          stream: true, 
          raw: true,
          options: { num_predict: 8192, temperature: 0.2 }
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let finalMsgs = [...newMessages];
      let buffer = ""; // Buffer para evitar romper los paquetes JSON por la mitad

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Guardamos la última línea en el buffer por si está incompleta
        buffer = lines.pop(); 
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.response) {
              acc += json.response;
              const parts = acc.split("<channel|>");
              if (parts.length > 1) {
                const content = parts[1].trim();
                finalMsgs = [...newMessages, { role: "ai", content, isThinking: false }];
                setMessages(finalMsgs);
              }
            }
          } catch (e) {
            // Si el JSON viene roto de Ollama, lo ignoramos y seguimos leyendo
            console.warn("JSON chunk ignorado", e);
          }
        }
      }
      
      globalHistoryRef.current += turnPrompt + acc + "\n";
      setSessions(prev => {
        const idx = prev.findIndex(s => s.id === activeId);
        const session = {
          id: activeId,
          title: text.slice(0, 30) || "Chat de archivo",
          messages: finalMsgs,
          rawHistory: globalHistoryRef.current,
          updatedAt: Date.now()
        };
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = session;
          return copy.sort((a, b) => b.updatedAt - a.updatedAt);
        }
        return [session, ...prev];
      });

    } catch (err) {
      setMessages([...newMessages, { role: "ai", content: "Error de servidor local", isThinking: false }]);
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="flex h-full w-full bg-transparent overflow-hidden">
      <div className="w-72 bg-white/2 border-r border-white/5 hidden lg:flex flex-col p-4">
        <button onClick={handleNewChat} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 transition-all mb-6 font-semibold shadow-lg shadow-blue-900/20">
          <Plus size={18} /> Nuevo Chat
        </button>
        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
          {sessions.map(s => (
            <div key={s.id} onClick={() => loadSession(s.id)} className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${currentSessionId === s.id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'hover:bg-white/5 text-slate-400'}`}>
              <div className="flex items-center gap-3 truncate">
                <MessageSquare size={16} />
                <span className="text-sm truncate">{s.title}</span>
              </div>
              <Trash2 size={14} onClick={(e) => deleteSession(s.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative min-w-0" onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]); }}>
        <AnimatePresence>{isDragging && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-blue-600/10 backdrop-blur-md z-50 flex flex-col items-center justify-center border-2 border-dashed border-blue-500/50 m-4 rounded-3xl"><UploadCloud size={48} className="text-blue-400 mb-2 animate-bounce" /><p className="font-bold">Analizar este archivo</p></motion.div>}</AnimatePresence>

        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 md:p-12 space-y-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto flex flex-col gap-8">
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-5 ${msg.role === 'ai' ? 'items-start' : 'items-start flex-row-reverse'}`}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${msg.role === 'ai' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                  {msg.role === 'ai' ? <Bot size={22} /> : <User size={22} />}
                </div>
                <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.isThinking ? (
                    <div className="bg-white/5 rounded-2xl px-6 py-4 border border-white/5 flex items-center gap-3 text-slate-400 text-sm">
                      <Loader2 size={16} className="animate-spin text-blue-400" /> <span className="animate-pulse">Pensando...</span>
                    </div>
                  ) : (
                    <div className={`rounded-3xl px-6 py-4 shadow-xl ${msg.role === 'ai' ? 'bg-white/5 border border-white/10 text-slate-200' : 'bg-blue-600 text-white'}`}>
                      <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }} />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-linear-to-t from-zinc-950 to-transparent">
          <div className="max-w-4xl mx-auto">
            <AnimatePresence>{attachedFileName && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-3 flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 w-max px-4 py-2 rounded-full shadow-lg">{isFileLoading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}<span>{attachedFileName}</span><X size={14} className="ml-2 cursor-pointer" onClick={() => { setAttachedFileText(""); setAttachedFileName(""); }} /></motion.div>}</AnimatePresence>
            <div className="relative flex items-end bg-[#18181b] border border-white/10 rounded-2xl focus-within:border-blue-500/50 shadow-2xl">
              <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => processFile(e.target.files[0])} />
              <button onClick={() => fileInputRef.current.click()} disabled={isProcessing} className="p-4 text-slate-500 hover:text-white"><Paperclip size={22} /></button>
              <TextareaAutosize 
                ref={textareaRef}
                maxRows={10} 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)} 
                onKeyDown={(e) => { 
                  if(e.key === 'Enter' && !e.shiftKey && !isProcessing) { 
                    e.preventDefault(); 
                    handleSendMessage(); 
                  } 
                }} 
                className="w-full bg-transparent text-white py-4 pr-16 focus:outline-none resize-none text-sm placeholder:text-slate-600" 
                placeholder={isProcessing ? "Generando respuesta..." : "Envía un mensaje a Gemma..."} 
                disabled={isProcessing} 
              />
              <button onClick={handleSendMessage} disabled={isProcessing || (!prompt.trim() && !attachedFileText)} className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 shadow-lg"><Send size={18} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}