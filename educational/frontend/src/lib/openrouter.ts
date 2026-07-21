export class OpenRouterAPI {
  private backendUrl = 'http://localhost:5000/api';

  async generateQuiz(subject: string, difficulty: string, questionCount: number = 5) {
    const activeKey = this.getApiKey();
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (activeKey) {
        headers['x-openrouter-key'] = activeKey;
      }

      const response = await fetch(`${this.backendUrl}/quiz`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subject,
          difficulty,
          questionCount
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error generating quiz:', error);
      return this.getSampleQuestions(subject);
    }
  }

  async getCounselingResponse(message: string, context?: string) {
    const activeKey = this.getApiKey();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (activeKey) {
        headers['x-openrouter-key'] = activeKey;
      }

      const response = await fetch(`${this.backendUrl}/counsel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          context,
          provider: 'openrouter'
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json() as { content: string };
      return data.content;
    } catch (error) {
      console.error('Error getting counseling response:', error);
      return "I'm having trouble connecting right now, but I want you to know that struggling with subjects is completely normal. Would you like to try some practice questions to help improve?";
    }
  }

  private getApiKey() {
    if (typeof window !== 'undefined') {
      const userKey = window.localStorage.getItem('robot-openrouter-key');
      if (userKey) {
        return userKey.replace(/^"|"$/g, '').trim();
      }
    }
    return '';
  }

  private getSampleQuestions(subject: string) {
    const samples: Record<string, any> = {
      mathematics: {
        questions: [
          {
            question: "What is the value of x in the equation 2x + 5 = 13?",
            options: ["2", "4", "6", "8"],
            correctAnswer: 1,
            explanation: "Subtract 5 from both sides: 2x = 8, then divide by 2: x = 4"
          },
          {
            question: "What is the area of a triangle with base 8 and height 6?",
            options: ["24", "28", "32", "48"],
            correctAnswer: 0,
            explanation: "Area = (1/2) × base × height = (1/2) × 8 × 6 = 24"
          }
        ]
      },
      physics: {
        questions: [
          {
            question: "What is the unit of force?",
            options: ["Joule", "Watt", "Newton", "Pascal"],
            correctAnswer: 2,
            explanation: "Newton (N) is the SI unit of force, named after Sir Isaac Newton"
          }
        ]
      }
    };
    
    return samples[subject.toLowerCase()] || samples.mathematics;
  }
}

export const openRouterAPI = new OpenRouterAPI('');

export async function getLocalResources(topic: string) {
  try {
    const mod = await import('../data/resources');
    const resources = mod.studyResources || {};
    return resources[topic.toLowerCase()] || [];
  } catch (e) {
    return [];
  }
}