import { useMemo, useState } from 'react';
import { Bot, MessageSquareText, RefreshCcw, Send, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { bhoomiVoiceService, type BhoomiVoiceItem } from '@/services/bhoomiVoiceService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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

export default function BhoomiVoicePage() {
  const { user, hasPermission } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCounter, setMessageCounter] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUseAssistant = hasPermission('assistant:use');

  const assistantIntro = useMemo(
    () => 'BhoomiVoice connects natural-language asks to the existing LAND-IQ records, verification, risk, monitoring, duplicate, and analytics workflows.',
    []
  );

  const submitQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;

    const userMessageId = `msg-${messageCounter}-user`;
    const assistantMessageId = `msg-${messageCounter + 1}-assistant`;
    setMessageCounter((current) => current + 2);

    const nextUserMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: trimmed,
    };

    setMessages((current) => [...current, nextUserMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await bhoomiVoiceService.ask(trimmed, user?.permissions ?? []);

      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: response.answer,
          summary: response.summary,
          items: response.items,
          status: response.status,
        },
      ]);

      if (response.status === 'error' || response.status === 'unsupported') {
        setError(response.error ?? response.answer);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to process the request.';
      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: 'The request could not be completed from the current database view.',
          status: 'error',
        },
      ]);
      setError(message);
    } finally {
      setIsLoading(false);
    }
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
          <p className="text-sm text-muted-foreground">Deterministic assistant for land records, verification, risk, duplicates, alerts, geography, and analytics.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMessages([])}
          disabled={messages.length === 0}
        >
          <RefreshCcw className="mr-2 h-4 w-4" /> Clear
        </Button>
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
                disabled={isLoading}
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
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <MessageSquareText className="h-8 w-8" />
                <div>
                  <p className="font-medium text-foreground">Ask a question to get started</p>
                  <p className="text-sm">Examples: “Show pending verification tasks” or “How many land records are there?”</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg border p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>

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
            <Button type="button" onClick={() => void submitQuestion(input)} disabled={isLoading || !input.trim()}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
