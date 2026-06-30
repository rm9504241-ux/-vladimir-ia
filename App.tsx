"use client";

import { useEffect, useRef, useCallback, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
    ImageIcon,
    FileUp,
    Figma,
    MonitorIcon,
    CircleUserRound,
    ArrowUpIcon,
    Paperclip,
    PlusIcon,
    SendIcon,
    XIcon,
    LoaderIcon,
    Sparkles,
    Command,
    Trash2,
    RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react"

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            textarea.style.height = `${minHeight}px`;
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

interface CommandSuggestion {
    icon: React.ReactNode;
    label: string;
    description: string;
    prefix: string;
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    
    return (
      <div className={cn(
        "relative",
        containerClassName
      )}>
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-all duration-200 ease-in-out",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing ? "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" : "",
            className
          )}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {showRing && isFocused && (
          <motion.span 
            className="absolute inset-0 rounded-md pointer-events-none ring-2 ring-offset-0 ring-violet-500/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

interface Message {
    id: string;
    role: "user" | "model";
    text: string;
    timestamp: Date;
    command?: string;
    attachments?: string[];
}

export function AnimatedAIChat() {
    const [value, setValue] = useState("");
    const [attachments, setAttachments] = useState<string[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [recentCommand, setRecentCommand] = useState<string | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });
    const [inputFocused, setInputFocused] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [language, setLanguage] = useState<"ar" | "en">("en");
    
    const commandPaletteRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const commandSuggestions: CommandSuggestion[] = [
        { 
            icon: <ImageIcon className="w-4 h-4" />, 
            label: language === "ar" ? "إنشاء واجهة" : "Clone UI", 
            description: language === "ar" ? "إنشاء واجهة برمجة من الوصف أو الصورة" : "Generate a UI from description", 
            prefix: "/clone" 
        },
        { 
            icon: <Figma className="w-4 h-4" />, 
            label: language === "ar" ? "استيراد فيجما" : "Import Figma", 
            description: language === "ar" ? "تحويل كود تصميم فيجما" : "Import a design from Figma", 
            prefix: "/figma" 
        },
        { 
            icon: <MonitorIcon className="w-4 h-4" />, 
            label: language === "ar" ? "إنشاء صفحة" : "Create Page", 
            description: language === "ar" ? "إنشاء صفحة ويب كاملة" : "Generate a new web page", 
            prefix: "/page" 
        },
        { 
            icon: <Sparkles className="w-4 h-4" />, 
            label: language === "ar" ? "تحسين الكود" : "Improve", 
            description: language === "ar" ? "تحسين الكود أو التصميم الحالي" : "Improve existing UI design", 
            prefix: "/improve" 
        },
    ];

    useEffect(() => {
        if (value.startsWith('/') && !value.includes(' ')) {
            setShowCommandPalette(true);
            
            const matchingSuggestionIndex = commandSuggestions.findIndex(
                (cmd) => cmd.prefix.startsWith(value)
            );
            
            if (matchingSuggestionIndex >= 0) {
                setActiveSuggestion(matchingSuggestionIndex);
            } else {
                setActiveSuggestion(-1);
            }
        } else {
            setShowCommandPalette(false);
        }
    }, [value, language]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    // Auto scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const commandButton = document.querySelector('[data-command-button]');
            
            if (commandPaletteRef.current && 
                !commandPaletteRef.current.contains(target) && 
                !commandButton?.contains(target)) {
                setShowCommandPalette(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showCommandPalette) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestion(prev => 
                    prev < commandSuggestions.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestion(prev => 
                    prev > 0 ? prev - 1 : commandSuggestions.length - 1
                );
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                if (activeSuggestion >= 0) {
                    const selectedCommand = commandSuggestions[activeSuggestion];
                    setValue(selectedCommand.prefix + ' ');
                    setShowCommandPalette(false);
                    
                    setRecentCommand(selectedCommand.label);
                    setTimeout(() => setRecentCommand(null), 3500);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowCommandPalette(false);
            }
        } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) {
                handleSendMessage();
            }
        }
    };

    const handleSendMessage = async (textToSend?: string) => {
        const currentText = textToSend || value;
        if (!currentText.trim()) return;

        setErrorMessage(null);
        
        // Extract command if any
        let detectedCommand: string | undefined;
        if (currentText.startsWith("/")) {
            const spaceIndex = currentText.indexOf(" ");
            detectedCommand = spaceIndex !== -1 ? currentText.substring(0, spaceIndex) : currentText;
        }

        const newUserMessage: Message = {
            id: Math.random().toString(36).substring(7),
            role: "user",
            text: currentText,
            timestamp: new Date(),
            command: detectedCommand,
            attachments: [...attachments],
        };

        setMessages(prev => [...prev, newUserMessage]);
        setValue("");
        setAttachments([]);
        adjustHeight(true);
        setIsTyping(true);

        try {
            // Prepare the payload for full stack route
            const chatHistory = messages.map(msg => ({
                role: msg.role,
                text: msg.text
            }));

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: currentText,
                    history: chatHistory,
                    command: detectedCommand,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || (language === "ar" ? "فشل الاتصال بخادم الذكاء الاصطناعي" : "Failed to communicate with the AI server"));
            }

            const data = await response.json();
            
            const newAIMessage: Message = {
                id: Math.random().toString(36).substring(7),
                role: "model",
                text: data.reply || (language === "ar" ? "لم يتم استلام رد صالح." : "No valid reply received."),
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, newAIMessage]);
        } catch (error: any) {
            console.error("Chat API error:", error);
            setErrorMessage(error.message || (language === "ar" ? "حدث خطأ غير متوقع." : "An unexpected error occurred."));
        } finally {
            setIsTyping(false);
        }
    };

    const handleFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files) as File[];
            filesArray.forEach(file => {
                setAttachments(prev => [...prev, file.name]);
            });
        }
    };

    const handleAttachFile = () => {
        fileInputRef.current?.click();
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };
    
    const selectCommandSuggestion = (index: number) => {
        const selectedCommand = commandSuggestions[index];
        setValue(selectedCommand.prefix + ' ');
        setShowCommandPalette(false);
        
        setRecentCommand(selectedCommand.label);
        setTimeout(() => setRecentCommand(null), 2000);
        textareaRef.current?.focus();
    };

    const clearChat = () => {
        setMessages([]);
        setErrorMessage(null);
    };

    return (
        <div className="min-h-screen flex flex-col w-full items-center justify-between bg-zinc-950 text-white p-4 md:p-6 relative overflow-hidden font-sans" dir={language === "ar" ? "rtl" : "ltr"}>
            {/* Ambient Background Lights */}
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
                <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-fuchsia-500/10 rounded-full mix-blend-normal filter blur-[96px] animate-pulse delay-1000" />
            </div>

            {/* Hidden File Input */}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileUploadChange}
                multiple
            />

            {/* Main Content Area */}
            <main className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center relative z-10 my-4 h-[calc(100vh-140px)] overflow-hidden">
                <AnimatePresence mode="wait">
                    {messages.length === 0 ? (
                        // Welcome Layout
                        <motion.div 
                            key="welcome"
                            className="space-y-12 text-center py-12"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        >
                            <div className="space-y-3">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, duration: 0.5 }}
                                    className="inline-block"
                                >
                                    <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/95 to-white/50 pb-2">
                                        {language === "ar" ? "كيف يمكنني مساعدتك اليوم؟" : "How can I help today?"}
                                    </h1>
                                    <motion.div 
                                        className="h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent"
                                        initial={{ width: 0, opacity: 0 }}
                                        animate={{ width: "100%", opacity: 1 }}
                                        transition={{ delay: 0.5, duration: 0.8 }}
                                    />
                                </motion.div>
                                <motion.p 
                                    className="text-sm text-white/50"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    {language === "ar" ? "اطرح أي سؤال أو استخدم الأوامر الذكية لبناء وتحسين الواجهات" : "Type a command or ask a question to build and design"}
                                </motion.p>
                            </div>

                            {/* Suggestion Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                                {commandSuggestions.map((suggestion, index) => (
                                    <motion.button
                                        key={suggestion.prefix}
                                        onClick={() => selectCommandSuggestion(index)}
                                        className="flex items-start text-right gap-3 p-4 bg-white/[0.02] hover:bg-white/[0.06] rounded-xl border border-white/[0.04] hover:border-violet-500/20 text-white/70 hover:text-white transition-all relative group"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        whileHover={{ y: -2 }}
                                    >
                                        <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400 group-hover:bg-violet-500/20 group-hover:text-violet-300 transition-colors mt-0.5">
                                            {suggestion.icon}
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="font-semibold text-sm flex items-center gap-1.5">
                                                <span>{suggestion.label}</span>
                                                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono text-white/40">{suggestion.prefix}</span>
                                            </div>
                                            <p className="text-[11px] text-white/40 group-hover:text-white/50 transition-colors">
                                                {suggestion.description}
                                            </p>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        // Chat Thread Layout
                        <motion.div 
                            key="chat-thread"
                            className="w-full h-full overflow-y-auto pr-2 space-y-4 custom-scrollbar pb-16 flex flex-col"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    className={cn(
                                        "flex gap-3 max-w-[85%] rounded-2xl p-4 border relative group",
                                        msg.role === "user" 
                                            ? "bg-violet-600/10 border-violet-500/10 self-end ml-12" 
                                            : "bg-white/[0.01] border-white/[0.04] self-start mr-12"
                                    )}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {/* Avatar */}
                                    <div className="flex-shrink-0">
                                        {msg.role === "user" ? (
                                            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center border border-violet-500/20">
                                                <CircleUserRound className="w-4 h-4 text-violet-400" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center border border-white/10">
                                                <Sparkles className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2 justify-between">
                                            <span className="text-xs font-semibold text-white/40">
                                                {msg.role === "user" ? (language === "ar" ? "أنت" : "You") : (language === "ar" ? "فلاديمير الذكي" : "Vladimir IA")}
                                            </span>
                                            <span className="text-[9px] text-white/20">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        {msg.command && (
                                            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded text-[10px] font-mono mb-1">
                                                <Command className="w-2.5 h-2.5" />
                                                <span>{msg.command}</span>
                                            </div>
                                        )}

                                        <MessageContent text={msg.text} language={language} />

                                        {/* Attachments inside message */}
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/[0.05] mt-2">
                                                {msg.attachments.map((file, i) => (
                                                    <div key={i} className="flex items-center gap-1 text-[10px] bg-white/[0.04] px-2 py-1 rounded text-white/60">
                                                        <Paperclip className="w-3 h-3" />
                                                        <span>{file}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {/* Loading Indicator */}
                            {isTyping && (
                                <motion.div 
                                    className="flex gap-3 max-w-[85%] rounded-2xl p-4 bg-white/[0.01] border border-white/[0.04] self-start mr-12"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center border border-white/10">
                                        <LoaderIcon className="w-4 h-4 animate-spin text-white" />
                                    </div>
                                    <div className="space-y-2 flex-1">
                                        <span className="text-xs font-semibold text-white/40">
                                            {language === "ar" ? "جاري المعالجة..." : "Processing..."}
                                        </span>
                                        <div className="flex items-center gap-2 text-sm text-white/70">
                                            <span>{language === "ar" ? "يفكر فلاديمير" : "Vladimir IA is thinking"}</span>
                                            <TypingDots />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Error Box */}
                            {errorMessage && (
                                <motion.div 
                                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs self-center w-full max-w-xl text-center space-y-2"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    <p>{errorMessage}</p>
                                    <button 
                                        onClick={() => handleSendMessage()}
                                        className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-100 font-semibold transition-colors flex items-center gap-1 mx-auto"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        <span>{language === "ar" ? "إعادة المحاولة" : "Retry"}</span>
                                    </button>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Input Floating Box at the Bottom */}
            <div className="w-full max-w-2xl mx-auto relative z-20">
                <motion.div 
                    className="relative backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.05] shadow-2xl"
                    initial={{ scale: 0.98 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    {/* Command Suggestions Popup overlay */}
                    <AnimatePresence>
                        {showCommandPalette && (
                            <motion.div 
                                ref={commandPaletteRef}
                                className="absolute left-4 right-4 bottom-full mb-2 backdrop-blur-xl bg-black/95 rounded-lg z-50 shadow-lg border border-white/10 overflow-hidden"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                transition={{ duration: 0.15 }}
                            >
                                <div className="py-1 bg-black/95">
                                    {commandSuggestions.map((suggestion, index) => (
                                        <motion.div
                                            key={suggestion.prefix}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer",
                                                activeSuggestion === index 
                                                    ? "bg-violet-600/30 text-white" 
                                                    : "text-white/70 hover:bg-white/5"
                                            )}
                                            onClick={() => selectCommandSuggestion(index)}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.03 }}
                                        >
                                            <div className="w-5 h-5 flex items-center justify-center text-violet-400">
                                                {suggestion.icon}
                                            </div>
                                            <div className="font-semibold">{suggestion.label}</div>
                                            <div className="text-white/40 text-[10px] ml-1">
                                                {suggestion.prefix}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Chat Text Input */}
                    <div className="p-3">
                        <Textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                adjustHeight();
                            }}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setInputFocused(true)}
                            onBlur={() => setInputFocused(false)}
                            placeholder={language === "ar" ? "اسأل فلاديمير أو ابدأ بأمر..." : "Ask Vladimir IA a question or use a command..."}
                            containerClassName="w-full"
                            className={cn(
                                "w-full px-4 py-3",
                                "resize-none",
                                "bg-transparent",
                                "border-none text-white",
                                "text-sm focus:outline-none",
                                "placeholder:text-white/20",
                                "min-h-[60px]"
                            )}
                            style={{
                                overflow: "hidden",
                            }}
                            showRing={false}
                        />
                    </div>

                    {/* Current Files Attached display */}
                    <AnimatePresence>
                        {attachments.length > 0 && (
                            <motion.div 
                                className="px-4 pb-3 flex gap-2 flex-wrap"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                {attachments.map((file, index) => (
                                    <motion.div
                                        key={index}
                                        className="flex items-center gap-2 text-xs bg-white/[0.04] py-1.5 px-3 rounded-lg text-white/70"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                    >
                                        <span>{file}</span>
                                        <button 
                                            onClick={() => removeAttachment(index)}
                                            className="text-white/40 hover:text-white transition-colors"
                                        >
                                            <XIcon className="w-3 h-3" />
                                        </button>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Buttons Controls Footer */}
                    <div className="p-3 border-t border-white/[0.05] flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <motion.button
                                type="button"
                                onClick={handleAttachFile}
                                whileTap={{ scale: 0.94 }}
                                className="p-2 text-white/40 hover:text-white/90 rounded-lg transition-colors relative group"
                                title={language === "ar" ? "إرفاق ملف" : "Attach File"}
                            >
                                <Paperclip className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                                type="button"
                                data-command-button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowCommandPalette(prev => !prev);
                                }}
                                whileTap={{ scale: 0.94 }}
                                className={cn(
                                    "p-2 text-white/40 hover:text-white/90 rounded-lg transition-colors relative group",
                                    showCommandPalette && "bg-white/10 text-white/90"
                                )}
                                title={language === "ar" ? "فتح قائمة الأوامر" : "Open Commands"}
                            >
                                <Command className="w-4 h-4" />
                            </motion.button>
                        </div>
                        
                        <motion.button
                            type="button"
                            onClick={() => handleSendMessage()}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={isTyping || !value.trim()}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                "flex items-center gap-2",
                                value.trim()
                                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                                    : "bg-white/[0.05] text-white/40"
                            )}
                        >
                            {isTyping ? (
                                <LoaderIcon className="w-4 h-4 animate-spin" />
                            ) : (
                                <SendIcon className="w-4 h-4" />
                            )}
                            <span>{language === "ar" ? "إرسال" : "Send"}</span>
                        </motion.button>
                    </div>
                </motion.div>

                {/* Subtitle footer */}
                <p className="text-[10px] text-center text-white/20 mt-3">
                    {language === "ar" ? "فلاديمير مساعد ذكي قد يخطئ أحياناً، يرجى التحقق من الكود المولد." : "Vladimir IA can make mistakes. Please verify important code outputs."}
                </p>
            </div>

            {/* Custom Mouse Light Tracker */}
            {inputFocused && (
                <motion.div 
                    className="fixed w-[40rem] h-[40rem] rounded-full pointer-events-none z-0 opacity-[0.02] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 blur-[96px]"
                    animate={{
                        x: mousePosition.x - 320,
                        y: mousePosition.y - 320,
                    }}
                    transition={{
                        type: "spring",
                        damping: 25,
                        stiffness: 150,
                        mass: 0.5,
                    }}
                />
            )}
        </div>
    );
}

// Subcomponents

function TypingDots() {
    return (
        <div className="flex items-center ml-1">
            {[1, 2, 3].map((dot) => (
                <motion.div
                    key={dot}
                    className="w-1.5 h-1.5 bg-white/90 rounded-full mx-0.5"
                    initial={{ opacity: 0.3 }}
                    animate={{ 
                        opacity: [0.3, 0.9, 0.3],
                        scale: [0.85, 1.1, 0.85]
                    }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: dot * 0.15,
                        ease: "easeInOut",
                    }}
                    style={{
                        boxShadow: "0 0 4px rgba(255, 255, 255, 0.3)"
                    }}
                />
            ))}
        </div>
    );
}

function MessageContent({ text, language }: { text: string; language: "ar" | "en" }) {
    // Elegant regex-based text parsing for code blocks and basic markdown elements
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return (
        <div className="space-y-3 text-sm text-white/90 leading-relaxed break-words whitespace-pre-wrap">
            {parts.map((part, index) => {
                if (part.startsWith("```")) {
                    const match = part.match(/```(\w*)\n([\s\S]*?)```/);
                    const lang = match ? match[1] : "";
                    const code = match ? match[2] : part.slice(3, -3);
                    
                    return (
                        <div key={index} className="my-3 rounded-lg border border-white/10 bg-black/40 overflow-hidden font-mono text-xs max-w-full">
                            <div className="flex justify-between items-center px-4 py-1.5 bg-white/[0.05] border-b border-white/10 text-white/40 text-[10px] uppercase tracking-wider font-sans">
                                <span>{lang || "code"}</span>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(code)}
                                    className="hover:text-white transition-colors"
                                >
                                    {language === "ar" ? "نسخ" : "Copy"}
                                </button>
                            </div>
                            <pre className="p-4 overflow-x-auto text-violet-300">
                                <code>{code.trim()}</code>
                            </pre>
                        </div>
                    );
                }
                
                // Bold markdown formatter
                const subParts = part.split(/(\*\*.*?\*\*)/g);
                return (
                    <span key={index}>
                        {subParts.map((subPart, subIndex) => {
                            if (subPart.startsWith("**") && subPart.endsWith("**")) {
                                return <strong key={subIndex} className="font-semibold text-white bg-white/5 px-1 py-0.5 rounded">{subPart.slice(2, -2)}</strong>;
                            }
                            return subPart;
                        })}
                    </span>
                );
            })}
        </div>
    );
}

// Inline styles injection on startup
if (typeof document !== 'undefined') {
    const styleId = "chat-ripple-keyframes";
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
        @keyframes ripple {
          0% { transform: scale(0.5); opacity: 0.6; }
          100% { transform: scale(2); opacity: 0; }
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        `;
        document.head.appendChild(style);
    }
}
