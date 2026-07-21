import { API_BASE_URL } from './supabase';

export class GroqAPI {
  private backendUrl = `${API_BASE_URL || 'http://localhost:5000'}/api/counsel`;

  async getAssistantReply(userMessage: string, context?: string) {
    const activeKey = this.getApiKey();
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (activeKey) {
        headers['x-groq-key'] = activeKey;
      }

      const response = await fetch(this.backendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage,
          context,
          provider: 'groq'
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json() as { content: string };
      return data.content;
    } catch (error) {
      console.error('[groq] request failed:', error);
      return this.getFallbackResponse(userMessage);
    }
  }

  private getApiKey() {
    if (typeof window !== 'undefined') {
      const userKey = window.localStorage.getItem('robot-groq-key');
      if (userKey) {
        return userKey.replace(/^"|"$/g, '').trim();
      }
    }
    return '';
  }

  private getFallbackResponse(userInput: string) {
    const lastUserMessage = (userInput || '').toLowerCase();
    
    if (lastUserMessage.includes('math') || lastUserMessage.includes('equation') || lastUserMessage.includes('solve')) {
      return "I am Thambi Robo! Let's break down your math query. When solving equations:\n\n1. Move all variable terms to one side and constants to the other.\n2. Apply inverse operations step-by-step.\n3. Verify your result by plugging it back into the original equation.\n\nWould you like to start a mathematics practice quiz to build confidence?";
    }
    if (lastUserMessage.includes('physics') || lastUserMessage.includes('gravity') || lastUserMessage.includes('force')) {
      return "Thambi Robo here! For physics:\n\n1. Identify what variables you have (e.g., mass, acceleration).\n2. Choose the correct formula (like F = m * a).\n3. Keep your units consistent (e.g., kg, m/s²).\n\nLet's start a physics practice quiz to test this out!";
    }
    if (lastUserMessage.includes('robot') || lastUserMessage.includes('sensor') || lastUserMessage.includes('arduino') || lastUserMessage.includes('code')) {
      return "I am Thambi Robo, your robotics specialist!\n\n1. Design: Pick sensors (ultrasonic, IR) based on what the robot needs to detect.\n2. Coding: Write clean loops in C++/Python to poll sensor inputs and write to actuator outputs.\n3. Testing: Debug subsystems individually before assembling.\n\nLet's keep coding!";
    }
    if (lastUserMessage.includes('stress') || lastUserMessage.includes('fail') || lastUserMessage.includes('anxious') || lastUserMessage.includes('sad')) {
      return "I hear you, and it is completely natural to feel overwhelmed. As Thambi Robo, I suggest taking a short 5-minute breathing break. Break your study topics into tiny, manageable portions. Consistent effort is what matters. I believe in you!";
    }
    
    return `Hi, I am Thambi Robo, your learning companion. I am currently in offline mode, but I can help you review robotics, AI, sensors, physics, math, or give study tips. You can also start a practice quiz from the dashboard!`;
  }
}

export const groqAPI = new GroqAPI('');
