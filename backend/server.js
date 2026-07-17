import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper to validate API keys
const isValidKey = (key) => {
  return key && !key.startsWith('your-') && key.trim() !== '';
};

// Canned Fallback Questions Database (from openrouter.ts)
const getFallbackQuestions = (subject) => {
  const samples = {
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
};

// Local Thambi Robo offline counselor simulation engine
const getOfflineCounselResponse = (userInput) => {
  const text = (userInput || '').toLowerCase();
  
  if (text.includes('math') || text.includes('equation') || text.includes('solve')) {
    return "I am Thambi Robo! Let's break down your math query. When solving equations:\n\n1. Move all variable terms to one side and constants to the other.\n2. Apply inverse operations step-by-step.\n3. Verify your result by plugging it back into the original equation.\n\nWould you like to start a mathematics practice quiz to build confidence?";
  }
  if (text.includes('physics') || text.includes('gravity') || text.includes('force')) {
    return "Thambi Robo here! For physics:\n\n1. Identify what variables you have (e.g., mass, acceleration).\n2. Choose the correct formula (like F = m * a).\n3. Keep your units consistent (e.g., kg, m/s²).\n\nLet's start a physics practice quiz to test this out!";
  }
  if (text.includes('robot') || text.includes('sensor') || text.includes('arduino') || text.includes('code')) {
    return "I am Thambi Robo, your robotics specialist!\n\n1. Design: Pick sensors (ultrasonic, IR) based on what the robot needs to detect.\n2. Coding: Write clean loops in C++/Python to poll sensor inputs and write to actuator outputs.\n3. Testing: Debug subsystems individually before assembling.\n\nLet's keep coding!";
  }
  if (text.includes('stress') || text.includes('fail') || text.includes('anxious') || text.includes('sad')) {
    return "I hear you, and it is completely natural to feel overwhelmed. As Thambi Robo, I suggest taking a short 5-minute breathing break. Break your study topics into tiny, manageable portions. Consistent effort is what matters. I believe in you!";
  }

  return "Hi, I am Thambi Robo, your learning companion. I am currently operating offline, but I can help you review study topics, manage stress, or run a practice quiz. Try checking the dashboard for resources!";
};

// POST /api/counsel
app.post('/api/counsel', async (req, res) => {
  const { message, context, provider } = req.body;
  const clientGroqKey = req.headers['x-groq-key'];
  const clientOpenRouterKey = req.headers['x-openrouter-key'];

  // Determine active keys, checking client header overrides first
  const activeGroqKey = isValidKey(clientGroqKey) ? clientGroqKey : process.env.GROQ_API_KEY;
  const activeOpenRouterKey = isValidKey(clientOpenRouterKey) ? clientOpenRouterKey : process.env.OPENROUTER_API_KEY;

  if (provider === 'openrouter') {
    if (!isValidKey(activeOpenRouterKey)) {
      console.warn('[Server] OpenRouter key missing or placeholder — using offline fallback.');
      return res.json({ content: getOfflineCounselResponse(message) });
    }

    const systemPrompt = `You are Thambi Robo, an exceptionally intelligent, empathetic AI robotics tutor and student counselor. Provide clear, encouraging, structured, and deep explanations. Always break down complex topics (AI, programming, sensors, physics, math) step-by-step using bullet points, and offer motivational counseling advice when students express frustration or exam stress. Keep responses supportive, warm, and highly engaging. ${context ? `Context: ${context}` : ''}`;

    try {
      const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeOpenRouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ]
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`OpenRouter responded with code ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      const content = data.choices?.[0]?.message?.content || getOfflineCounselResponse(message);
      return res.json({ content });
    } catch (err) {
      console.error('[OpenRouter Error]', err);
      return res.json({ content: getOfflineCounselResponse(message) });
    }
  } 
  
  // Default Provider: Groq
  if (provider === 'groq' || !provider) {
    if (!isValidKey(activeGroqKey)) {
      console.warn('[Server] Groq key missing or placeholder — using offline fallback.');
      return res.json({ content: getOfflineCounselResponse(message) });
    }

    try {
      const messagesPayload = [
        {
          role: 'system',
          content: 'You are Thambi Robo, an exceptionally intelligent, empathetic AI robotics tutor and student counselor. Provide clear, encouraging, structured, and deep explanations. Always break down complex topics (AI, programming, sensors, physics, math) step-by-step using bullet points, and offer motivational counseling advice when students express frustration or exam stress.'
        }
      ];

      if (context) {
        messagesPayload.push({ role: 'system', content: `Relevant knowledge context:\n${context}` });
      }

      messagesPayload.push({ role: 'user', content: message });

      const apiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeGroqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: messagesPayload,
          temperature: 0.7,
          max_tokens: 400
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`Groq responded with code ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      const content = data.choices?.[0]?.message?.content || getOfflineCounselResponse(message);
      return res.json({ content });
    } catch (err) {
      console.error('[Groq Error]', err);
      return res.json({ content: getOfflineCounselResponse(message) });
    }
  }

  // Fallback
  return res.json({ content: getOfflineCounselResponse(message) });
});

// POST /api/quiz
app.post('/api/quiz', async (req, res) => {
  const { subject, difficulty, questionCount = 5 } = req.body;
  const clientOpenRouterKey = req.headers['x-openrouter-key'];
  const activeOpenRouterKey = isValidKey(clientOpenRouterKey) ? clientOpenRouterKey : process.env.OPENROUTER_API_KEY;

  if (!isValidKey(activeOpenRouterKey)) {
    console.warn('[Server] OpenRouter API key missing — returning sample questions.');
    return res.json(getFallbackQuestions(subject));
  }

  const prompt = `Generate ${questionCount} multiple-choice questions for ${subject} at ${difficulty} level. 
  Format as JSON with this structure:
  {
    "questions": [
      {
        "question": "Question text",
        "options": ["A", "B", "C", "D"],
        "correctAnswer": 0,
        "explanation": "Why this is correct"
      }
    ]
  }`;

  try {
    const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeOpenRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`OpenRouter responded with code ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      // Find the JSON block if LLM responds with surrounding conversational text
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const cleanJson = content.substring(jsonStart, jsonEnd + 1);
        return res.json(JSON.parse(cleanJson));
      }
      return res.json(JSON.parse(content));
    }
    throw new Error('No content returned from AI');
  } catch (err) {
    console.error('[Quiz Generation Error]', err);
    return res.json(getFallbackQuestions(subject));
  }
});

app.listen(PORT, () => {
  console.log(`[Server] StudyMentor Backend running on port ${PORT}`);
});
