import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageSquareText, Mic, MicOff, RefreshCcw, Send, Sparkles, Trash2, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { bhoomiVoiceService, type BhoomiVoiceItem, type BhoomiVoiceMessage, type BhoomiVoiceSession } from '@/services/bhoomiVoiceService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Json } from '@/types/database';

interface BhoomiSpeechRecognitionResult extends ArrayLike<{ transcript: string }> {
  isFinal: boolean;
}

interface BhoomiSpeechRecognitionEvent extends Event {
  results: ArrayLike<BhoomiSpeechRecognitionResult>;
}

interface BhoomiSpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface BhoomiSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BhoomiSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BhoomiSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BhoomiSpeechRecognition;
    webkitSpeechRecognition?: new () => BhoomiSpeechRecognition;
  }
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  items?: BhoomiVoiceItem[];
  summary?: string;
  status?: 'success' | 'unsupported' | 'error';
}

const starterQuestions = [
  'How many land records are there?',
  'Show pending verification tasks',
  'Show high-risk records',
  'Show active alerts',
  'Show duplicate candidates',
  'Show records in Coimbatore',
  'Show analytics summary',
];

const toChatMessage = (message: BhoomiVoiceMessage): ChatMessage => {
  const storedMetadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
    ? message.metadata
    : {};
  const status = ['success', 'unsupported', 'error'].includes(String(storedMetadata.status))
    ? storedMetadata.status as ChatMessage['status']
    : undefined;

  return {
    id: message.id,
    role: message.role === 'user' ? 'user' : 'assistant',
    content: message.content,
    ...(typeof storedMetadata.summary === 'string' ? { summary: storedMetadata.summary } : {}),
    ...(Array.isArray(storedMetadata.items) ? { items: storedMetadata.items as unknown as BhoomiVoiceItem[] } : {}),
    ...(status ? { status } : {}),
  };
};

export default function BhoomiVoicePage() {
  const { user, loading: isAuthLoading, hasPermission } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<BhoomiVoiceSession[]>([]);
  const [sessionsLoadedForUserId, setSessionsLoadedForUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<BhoomiSpeechRecognition | null>(null);
  const authUserId = user?.id;

  const canUseAssistant = hasPermission('assistant:use');
  const isSessionListLoading = isAuthLoading || isSessionsLoading || Boolean(authUserId && authUserId !== sessionsLoadedForUserId);
  const visibleSessions = authUserId === sessionsLoadedForUserId ? sessions : [];
  const visibleSessionId = authUserId === sessionsLoadedForUserId ? sessionId : null;
  const visibleMessages = authUserId === sessionsLoadedForUserId ? messages : [];

  const assistantIntro = useMemo(
    () => 'BhoomiVoice connects natural-language asks to the existing LAND-IQ records, verification, risk, monitoring, duplicate, and analytics workflows.',
    []
  );

  useEffect(() => {
    if (isAuthLoading) return;
    if (!authUserId) return;

    let isCurrent = true;
    void bhoomiVoiceService.listSessions()
      .then((nextSessions) => {
        if (isCurrent) {
          setSessions(nextSessions);
          setSessionsLoadedForUserId(authUserId);
          setMessages([]);
          setSessionId(null);
          setHistoryError(null);
        }
      })
      .catch((err: unknown) => {
        if (isCurrent) {
          setSessions([]);
          setSessionsLoadedForUserId(authUserId);
          setMessages([]);
          setSessionId(null);
          setHistoryError(err instanceof Error ? err.message : 'Unable to load BhoomiVoice sessions.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsSessionsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isAuthLoading, authUserId]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const loadSession = async (nextSessionId: string) => {
    if (!nextSessionId) {
      setSessionId(null);
      setMessages([]);
      setHistoryError(null);
      return;
    }
    if (authUserId !== sessionsLoadedForUserId || !sessions.some((session) => session.id === nextSessionId)) {
      setHistoryError('That session is unavailable or you do not have access to it.');
      return;
    }

    setIsHistoryLoading(true);
    setHistoryError(null);
    stopSpeech();
    try {
      const loadedMessages = await bhoomiVoiceService.loadMessages(nextSessionId);
      setSessionId(nextSessionId);
      setMessages(loadedMessages.map(toChatMessage));
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Unable to load this session.');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechError('Speech recognition is not supported in this browser. You can still type your question.');
      return;
    }

    setSpeechError(null);
    stopSpeech();
    try {
      const recognition = new Recognition();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results, (result) => result[0]?.transcript ?? '').join('');
        setInput(transcript);
      };
      recognition.onerror = (event) => {
        const messages: Record<string, string> = {
          'not-allowed': 'Microphone access was denied. Allow microphone access or type your question.',
          'service-not-allowed': 'The browser blocked microphone recognition. You can still type your question.',
          'audio-capture': 'No microphone was found. Connect a microphone or type your question.',
          'no-speech': 'No speech was detected. Try again or type your question.',
        };
        setSpeechError(messages[event.error] ?? `Speech recognition failed (${event.error}). You can still type your question.`);
      };
      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (err) {
      setIsListening(false);
      setSpeechError(err instanceof Error ? err.message : 'Unable to start the microphone. You can still type your question.');
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch (err) {
      setSpeechError(err instanceof Error ? err.message : 'Unable to stop speech recognition.');
      setIsListening(false);
    }
  };

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  };

  const speakMessage = (message: ChatMessage) => {
    if (typeof window.speechSynthesis === 'undefined' || typeof window.SpeechSynthesisUtterance === 'undefined') {
      setSpeechError('Speech output is not supported in this browser.');
      return;
    }

    setSpeechError(null);
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(message.content);
    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingMessageId(message.id);
    };
    utterance.onend = stopSpeech;
    utterance.onerror = (event) => {
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setSpeechError(`Speech output failed (${event.error}).`);
      }
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };
    window.speechSynthesis.speak(utterance);
  };

  const deleteCurrentSession = async () => {
    if (!visibleSessionId) return;
    setIsDeletingSession(true);
    setHistoryError(null);
    try {
      await bhoomiVoiceService.deleteSession(visibleSessionId);
      setSessions((current) => current.filter((session) => session.id !== visibleSessionId));
      setSessionId(null);
      setMessages([]);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Unable to delete this session.');
    } finally {
      setIsDeletingSession(false);
    }
  };

  const retryHistory = async () => {
    if (visibleSessionId) {
      await loadSession(visibleSessionId);
      return;
    }

    setIsSessionsLoading(true);
    setHistoryError(null);
    try {
      setSessions(await bhoomiVoiceService.listSessions());
      setSessionsLoadedForUserId(authUserId ?? null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Unable to load BhoomiVoice sessions.');
    } finally {
      setIsSessionsLoading(false);
    }
  };

  const submitQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;

    setError(null);
    setHistoryError(null);
    setIsLoading(true);

    try {
      let activeSessionId = authUserId === sessionsLoadedForUserId ? sessionId : null;
      if (!activeSessionId) {
        const createdSession = await bhoomiVoiceService.createSession();
        activeSessionId = createdSession.id;
        setSessionId(createdSession.id);
        setSessions((current) => [createdSession, ...current.filter((session) => session.id !== createdSession.id)]);
      }

      const userMessage = await bhoomiVoiceService.addMessage(activeSessionId, 'user', trimmed);
      setMessages((current) => [...current, toChatMessage(userMessage)]);
      setInput('');

      const response = await bhoomiVoiceService.ask(
        trimmed,
        visibleMessages.slice(-12).map(({ role, content }) => ({ role, content })),
      );
      const responseMetadata = {
        intent: response.intent,
        status: response.status,
        ...(response.summary ? { summary: response.summary } : {}),
        ...(response.count !== undefined ? { count: response.count } : {}),
        ...(response.items ? { items: response.items } : {}),
        ...(response.error ? { error: response.error } : {}),
      } as unknown as Json;
      const assistantMessage = await bhoomiVoiceService.addMessage(
        activeSessionId,
        'assistant',
        response.answer,
        response.status,
        responseMetadata,
      );

      setMessages((current) => [...current, toChatMessage(assistantMessage)]);
      setSessions((current) => current.map((session) =>
        session.id === activeSessionId ? { ...session, updated_at: assistantMessage.created_at } : session
      ).sort((left, right) => right.updated_at.localeCompare(left.updated_at)));

      if (response.status === 'error' || response.status === 'unsupported') {
        setError(response.error ?? response.answer);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to process the request.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewSession = () => {
    stopSpeech();
    setSessionId(null);
    setMessages([]);
    setInput('');
    setError(null);
  };

  if (!canUseAssistant) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Bot className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>You do not have permission to use BhoomiVoice.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BhoomiVoice</h1>
          <p className="text-sm text-muted-foreground">Ask BhoomiVoice about LAND-IQ or any other topic.</p>
          <p className="mt-1 text-xs text-muted-foreground">Your question and permitted LAND-IQ context are processed by the configured AI provider. Avoid entering sensitive personal information.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <select
            value={visibleSessionId ?? ''}
            onChange={(event) => void loadSession(event.target.value)}
            disabled={isSessionListLoading || isLoading || isHistoryLoading}
            aria-label="BhoomiVoice session history"
            className="h-9 max-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">
              {isSessionListLoading ? 'Loading sessions…' : visibleSessions.length ? 'Session history' : 'No saved sessions'}
            </option>
            {visibleSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {new Date(session.created_at).toLocaleString()}
              </option>
            ))}
          </select>
          {visibleSessionId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void deleteCurrentSession()}
              disabled={isDeletingSession || isLoading}
              aria-label="Delete current session"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeletingSession ? 'Deleting…' : 'Delete'}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={startNewSession} disabled={isLoading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> New chat
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            What BhoomiVoice can answer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{assistantIntro}</p>
          <div className="flex flex-wrap gap-2">
            {starterQuestions.map((question) => (
              <Button
                key={question}
                type="button"
                variant="secondary"
                size="sm"
                className="justify-start"
                onClick={() => submitQuestion(question)}
                disabled={isLoading || isHistoryLoading}
              >
                {question}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex max-h-[440px] min-h-[240px] flex-col gap-3 overflow-y-auto rounded-md border bg-muted/20 p-3">
            {isHistoryLoading ? (
              <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-muted-foreground">
                Loading session…
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <MessageSquareText className="h-8 w-8" />
                <div>
                  <p className="font-medium text-foreground">Ask a question to get started</p>
                  <p className="text-sm">Examples: “Show pending verification tasks” or “How many land records are there?”</p>
                </div>
              </div>
            ) : (
              visibleMessages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg border p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-foreground'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      {message.role === 'assistant' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2"
                          onClick={() => isSpeaking && speakingMessageId === message.id ? stopSpeech() : speakMessage(message)}
                          aria-label={isSpeaking && speakingMessageId === message.id ? 'Stop speaking response' : 'Speak response'}
                          title={isSpeaking && speakingMessageId === message.id ? 'Stop speaking' : 'Speak response'}
                        >
                          {isSpeaking && speakingMessageId === message.id
                            ? <><VolumeX className="mr-1 h-4 w-4" /> Stop</>
                            : <><Volume2 className="mr-1 h-4 w-4" /> Speak</>}
                        </Button>
                      )}
                    </div>

                    {message.summary && (
                      <p className="mt-2 text-xs opacity-80">{message.summary}</p>
                    )}

                    {message.items && message.items.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.items.map((item) => (
                          <div key={`${message.id}-${item.title}`} className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{item.title}</span>
                              {item.href ? (
                                <a href={item.href} className="text-primary underline underline-offset-2">Open</a>
                              ) : null}
                            </div>
                            {item.subtitle && <p className="mt-1 text-muted-foreground">{item.subtitle}</p>}
                            {item.meta && item.meta.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.meta.map((metaItem) => (
                                  <span key={`${item.title}-${metaItem}`} className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {metaItem}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Unable to complete the request</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {historyError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Session history unavailable</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                {historyError}
                <Button type="button" variant="outline" size="sm" onClick={() => void retryHistory()} disabled={isHistoryLoading || isSessionListLoading}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {speechError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Speech unavailable</AlertTitle>
              <AlertDescription>{speechError}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void submitQuestion(input);
                }
              }}
              placeholder="Ask BhoomiVoice about land records, verification tasks, alerts, or analytics..."
              aria-label="Ask BhoomiVoice a question"
            />
            <Button
              type="button"
              variant="outline"
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading || isHistoryLoading}
              aria-label={isListening ? 'Stop microphone' : 'Start microphone'}
              title={isListening ? 'Stop microphone' : 'Start microphone'}
            >
              {isListening ? <><MicOff className="mr-2 h-4 w-4" /> Listening</> : <><Mic className="mr-2 h-4 w-4" /> Mic</>}
            </Button>
            <Button type="button" onClick={() => void submitQuestion(input)} disabled={isLoading || isHistoryLoading || !input.trim()}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
