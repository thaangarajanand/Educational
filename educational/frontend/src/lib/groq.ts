import { API_BASE_URL } from './supabase';

export class GroqAPI {
  private backendUrl = `${API_BASE_URL || 'http://localhost:5000'}/api/counsel`;

  async getAssistantReply(userMessage: string, context?: string) {
    const activeKey = this.getApiKey();

    if (activeKey && (activeKey.startsWith('gsk_') || activeKey.startsWith('groq-'))) {
      try {
        const messagesPayload = [
          {
            role: 'system',
            content: 'You are Thambi Robo powered by Groq LLaMA 3.3 Ultra-Fast AI, an exceptionally intelligent, empathetic AI robotics tutor and student counselor. Provide clear, encouraging, structured, and deep explanations. Always break down complex topics (AI, robotics, programming, sensors, physics, math) step-by-step using bullet points.'
          }
        ];

        if (context) {
          messagesPayload.push({ role: 'system', content: `Relevant knowledge context:\n${context}` });
        }

        messagesPayload.push({ role: 'user', content: userMessage });

        // Primary: llama-3.3-70b-versatile
        let groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: messagesPayload,
            temperature: 0.7,
            max_tokens: 650
          })
        });

        if (!groqRes.ok) {
          // Fallback: llama-3.1-8b-instant
          groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${activeKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: messagesPayload,
              temperature: 0.7,
              max_tokens: 650
            })
          });
        }

        if (groqRes.ok) {
          const data = await groqRes.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) return content;
        }
      } catch (err) {
        console.warn('[Direct Groq API Call Error, falling back to backend]:', err);
      }
    }

    // Fallback to backend /api/counsel
    try {
      const response = await fetch(this.backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, context, provider: 'groq' })
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.response) return data.response;
      }
    } catch (err) {
      console.warn('[Backend Groq Fallback Error]:', err);
    }

    return null;
  }

  setApiKey(key: string) {
    try {
      if (key) {
        window.localStorage.setItem('groq_api_key', key.trim());
      } else {
        window.localStorage.removeItem('groq_api_key');
      }
    } catch {}
  }

  getApiKey(): string | null {
    try {
      return window.localStorage.getItem('groq_api_key');
    } catch {
      return null;
    }
  }
}

export const groqAPI = new GroqAPI();
