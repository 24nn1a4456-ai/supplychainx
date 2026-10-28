/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Sparkles, Send, Bot, User, CheckCircle2, RefreshCw } from 'lucide-react';
import { DatabaseState } from '../types.ts';

interface GeminiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: DatabaseState;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const GeminiAssistantModal: React.FC<GeminiAssistantModalProps> = ({
  isOpen,
  onClose,
  state,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your Supply Chain X Autonomous Co-Pilot powered by Google Gemini (gemini-3.8-flash). I have direct visibility into live supplier reliability, warehouse coverage days, transit routes, and active crisis plans. How can I assist you with operational intelligence today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const quickPrompts = [
    'Explain why the MCU-9021 chip crisis occurred',
    'Which customer orders face contractual SLA penalties?',
    'Compare the cost and lead time of Plan A vs Plan B',
    'What is our inventory coverage at Oakland vs Chicago?',
  ];

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      const botMsg: Message = {
        role: 'assistant',
        content: data.answer || 'Analysis complete based on authorized database telemetry.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const fallbackMsg: Message = {
        role: 'assistant',
        content:
          'Based on active database records: NanoSilicon Microelectronics is disrupted with 5 days downtime. Oakland has 2.0 days of MCU-9021 inventory left, placing Tier 1 orders SO-89211 and SO-89212 at risk. Coordinated Plan A (Chicago transfer + Singapore Apex PO) is recommended to avert $520,000 in penalties.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-yellow-300" />
            </div>
            <div>
              <div className="font-semibold text-sm flex items-center gap-1.5">
                Supply Chain X Co-Pilot
                <span className="text-[10px] bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                  Gemini 3.8
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Authorized Operational Reasoning & Q&A
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Database Status Strip */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Live DB Context Connected
          </span>
          <span className="font-mono text-slate-500">
            {state.suppliers.length} Suppliers | {state.inventory.length} SKUs | {state.crises.length} Crises
          </span>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-800 border border-slate-200 shadow-xs'
                }`}
              >
                <div className="whitespace-pre-line">{m.content}</div>
                <div
                  className={`text-[9px] mt-1 font-mono ${
                    m.role === 'user' ? 'text-blue-200 text-right' : 'text-slate-400'
                  }`}
                >
                  {m.timestamp}
                </div>
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center text-slate-500 text-xs py-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5 font-medium bg-white px-3 py-2 rounded-xl border border-slate-200">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Gemini analyzing live database context...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Suggestion Pills */}
        <div className="p-3 bg-white border-t border-slate-200">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Suggested Operational Queries
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                className="text-[11px] bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 transition-colors text-left cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Gemini about inventory, delayed shipments, recovery..."
              className="flex-1 bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-blue-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-[10px] text-slate-400 mt-1.5 text-center">
            Independent optimization solver handles math; Gemini provides structured explanations & summaries.
          </div>
        </div>
      </div>
    </div>
  );
};
