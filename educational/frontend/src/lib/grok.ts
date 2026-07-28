import { API_BASE_URL } from './supabase';

export class GrokAPI {
  private backendUrl = `${API_BASE_URL || 'http://localhost:5000'}/api/counsel`;

  async getAssistantReply(userMessage: string, context?: string) {
    const activeKey = this.getApiKey();

    // If client provided a custom xAI API Key in browser settings, try direct fetch first
    if (activeKey && activeKey.startsWith('xai-')) {
      try {
        const messagesPayload = [
          {
            role: 'system',
            content: 'You are Thambi Robo powered by xAI Grok, an exceptionally intelligent, empathetic AI robotics tutor and student counselor. Provide clear, encouraging, structured, and deep explanations. Always break down complex topics (AI, robotics, programming, sensors, physics, math) step-by-step using bullet points, and offer motivational counseling advice when students express frustration or exam stress.'
          }
        ];

        if (context) {
          messagesPayload.push({ role: 'system', content: `Relevant knowledge context:\n${context}` });
        }

        messagesPayload.push({ role: 'user', content: userMessage });

        let grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'grok-beta',
            messages: messagesPayload,
            temperature: 0.7,
            max_tokens: 600
          })
        });

        if (!grokRes.ok) {
          // Retry with grok-2-latest
          grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${activeKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'grok-2-latest',
              messages: messagesPayload,
              temperature: 0.7,
              max_tokens: 600
            })
          });
        }

        if (grokRes.ok) {
          const data = await grokRes.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) return content;
        }
      } catch (err: any) {
        console.warn('[grok direct] fallback to backend:', err);
      }
    }

    // Default & Primary Path: Send request to Render backend server which uses process.env.XAI_API_KEY / GROK_API_KEY
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (activeKey) {
        headers['x-grok-key'] = activeKey;
      }

      const response = await fetch(this.backendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage,
          context,
          provider: 'grok'
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json() as { content: string };
      return data.content;
    } catch (error) {
      console.error('[grok backend] request failed:', error);
      return this.getFallbackResponse(userMessage);
    }
  }

  private getApiKey() {
    if (typeof window !== 'undefined') {
      const userKey = window.localStorage.getItem('robot-grok-key') || window.localStorage.getItem('robot-groq-key');
      if (userKey) {
        return userKey.replace(/^"|"$/g, '').trim();
      }
    }
    return '';
  }

  private getFallbackResponse(userInput: string) {
    const lastUserMessage = (userInput || '').toLowerCase();
    
    if (lastUserMessage.includes('math') || lastUserMessage.includes('equation') || lastUserMessage.includes('solve')) {
      return "I am Thambi Robo (powered by Grok)! Let's break down your math query. When solving equations:\n\n1. Move all variable terms to one side and constants to the other.\n2. Apply inverse operations step-by-step.\n3. Verify your result by plugging it back into the original equation.\n\nWould you like to start a mathematics practice quiz to build confidence?";
    }
    if (lastUserMessage.includes('physics') || lastUserMessage.includes('gravity') || lastUserMessage.includes('force')) {
      return "Thambi Robo (powered by Grok) here! For physics:\n\n1. Identify what variables you have (e.g., mass, acceleration).\n2. Choose the correct formula (like F = m * a).\n3. Keep your units consistent (e.g., kg, m/s²).\n\nLet's start a physics practice quiz to test this out!";
    }
    if (lastUserMessage.includes('robot') || lastUserMessage.includes('sensor') || lastUserMessage.includes('arduino') || lastUserMessage.includes('code')) {
      return "I am Thambi Robo, your xAI Grok robotics specialist!\n\n1. Design: Pick sensors (ultrasonic, IR) based on what the robot needs to detect.\n2. Coding: Write clean loops in C++/Python to poll sensor inputs and write to actuator outputs.\n3. Testing: Debug subsystems individually before assembling.\n\nLet's keep coding!";
    }
    if (lastUserMessage.includes('stress') || lastUserMessage.includes('fail') || lastUserMessage.includes('anxious') || lastUserMessage.includes('sad')) {
      return "I hear you, and it is completely natural to feel overwhelmed. As Thambi Robo, I suggest taking a short 5-minute breathing break. Break your study topics into tiny, manageable portions. Consistent effort is what matters. I believe in you!";
    }
    
    return `Hi, I am Thambi Robo, your Grok-powered learning companion. I am currently in offline mode, but I can help you review robotics, AI, sensors, physics, math, or give study tips. You can also start a practice quiz from the dashboard!`;
  }
}

export const grokAPI = new GrokAPI('');
export const groqAPI = grokAPI;
