import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { promises as fs } from 'fs';
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'crypto';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../frontend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAnonClient = null;
let supabaseAdminClient = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseAnonClient = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('[Supabase] Failed to initialize anon client:', error);
  }
}

if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  } catch (error) {
    console.error('[Supabase] Failed to initialize admin client:', error);
  }
}

const activeSessions = new Map();
const profileStore = new Map();
const fileStoreDirectory = path.join(__dirname, 'data');
const fileStorePath = path.join(fileStoreDirectory, 'shared-files.json');
const localUserStorePath = path.join(fileStoreDirectory, 'local-users.json');
const frontendBuildDirectory = path.resolve(__dirname, '../frontend/dist');
const frontendIndexPath = path.join(frontendBuildDirectory, 'index.html');
const scryptAsync = promisify(scrypt);

const loadSharedFiles = async () => {
  try {
    const stored = await fs.readFile(fileStorePath, 'utf8');
    const records = JSON.parse(stored);
    return Array.isArray(records) ? records : [];
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[Files] Unable to read shared file store:', error);
    }
    return [];
  }
};

const sharedFiles = await loadSharedFiles();

const saveSharedFiles = async () => {
  await fs.mkdir(fileStoreDirectory, { recursive: true });
  await fs.writeFile(fileStorePath, JSON.stringify(sharedFiles, null, 2), 'utf8');
};

const loadLocalUsers = async () => {
  try {
    const stored = await fs.readFile(localUserStorePath, 'utf8');
    const users = JSON.parse(stored);
    return Array.isArray(users) ? users : [];
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[Auth] Unable to read local user store:', error);
    }
    return [];
  }
};

const localUsers = new Map((await loadLocalUsers())
  .filter((user) => user?.email && user?.passwordHash)
  .map((user) => [user.email.toLowerCase(), user]));

const saveLocalUsers = async () => {
  await fs.mkdir(fileStoreDirectory, { recursive: true });
  await fs.writeFile(localUserStorePath, JSON.stringify([...localUsers.values()], null, 2), 'utf8');
};

const getToken = (req) => {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const getSessionFromToken = (token) => {
  if (!token) return null;
  return activeSessions.get(token) || null;
};

const getUserFromRequest = async (req) => {
  const token = getToken(req);
  const localSession = getSessionFromToken(token);
  if (localSession?.user?.id) {
    return localSession.user;
  }

  // OAuth sessions are held by Supabase in the browser. Verify their bearer
  // tokens before using them for ownership-sensitive actions.
  if (token && (supabaseAdminClient || supabaseAnonClient)) {
    const client = supabaseAdminClient || supabaseAnonClient;
    try {
      const { data, error } = await client.auth.getUser(token);
      if (!error && data?.user?.id) {
        return data.user;
      }
    } catch (error) {
      console.error('[Files] Unable to validate Supabase session:', error);
    }
  }

  return null;
};

const getGuestIdFromRequest = (req) => {
  const guestId = req.headers['x-guest-id'];

  // Guest IDs are generated with crypto.randomUUID() in the browser. Keeping
  // this value private lets it act as the guest uploader's ownership token.
  if (typeof guestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(guestId)) {
    return null;
  }

  return guestId;
};

const getFileOwner = async (req) => {
  const user = await getUserFromRequest(req);
  if (user?.id) {
    return { id: user.id, email: user.email || 'Unknown uploader' };
  }

  const guestId = getGuestIdFromRequest(req);
  return guestId ? { id: `guest-${guestId}`, email: 'Guest User' } : null;
};

const publicFileRecord = (file, requesterId = null) => ({
  id: file.id,
  name: file.name,
  type: file.type,
  size: file.size,
  uploadedAt: file.uploadedAt,
  contentBase64: file.contentBase64,
  ownerEmail: file.ownerEmail || 'Unknown uploader',
  // Never expose ownerId: guest IDs are private ownership credentials.
  canDelete: Boolean(requesterId && file.ownerId === requesterId),
});

const getLocalUserId = (email) => `local-${createHash('sha256')
  .update(email.trim().toLowerCase())
  .digest('hex')}`;

const hashPassword = async (password) => {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
};

const passwordMatches = async (password, passwordHash) => {
  const [salt, storedHash] = (passwordHash || '').split(':');
  if (!salt || !storedHash) return false;

  const hash = await scryptAsync(password, salt, 64);
  const expected = Buffer.from(storedHash, 'hex');
  return expected.length === hash.length && timingSafeEqual(expected, hash);
};

const createLocalSession = (user) => {
  const accessToken = randomUUID();
  const session = {
    access_token: accessToken,
    user: { id: user.id, email: user.email, user_metadata: { guest: false } },
    provider_token: null,
  };
  activeSessions.set(accessToken, session);
  return session;
};

app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/api/supabase-status', (_req, res) => {
  res.json({
    configured: Boolean(supabaseAnonClient || supabaseAdminClient),
    url: supabaseUrl || null,
    message: supabaseAnonClient || supabaseAdminClient ? 'Supabase backend client is ready.' : 'Supabase backend client is not configured yet.'
  });
});

app.get('/api/files', async (req, res) => {
  // Try to identify the requester for the canDelete flag, but never block file listing.
  let requesterId = null;
  try {
    const owner = await getFileOwner(req);
    requesterId = owner?.id || null;
  } catch {
    // Authentication is not required for reading shared files.
  }
  res.json({ files: sharedFiles.map((file) => publicFileRecord(file, requesterId)) });
});

app.post('/api/files', async (req, res) => {
  const owner = await getFileOwner(req);

  // Allow upload if authenticated or from the browser's private guest session.
  if (!owner) {
    return res.status(401).json({ error: 'Please sign in or provide a guest session before uploading files.' });
  }

  const payload = req.body || {};
  const incomingFiles = Array.isArray(payload.files) ? payload.files : [payload];
  if (incomingFiles.length === 0 || incomingFiles.some((file) => !file?.name || typeof file.size !== 'number')) {
    return res.status(400).json({ error: 'Invalid file payload.' });
  }

  const records = incomingFiles.map((file) => ({
    id: randomUUID(),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    uploadedAt: file.uploadedAt || new Date().toISOString(),
    contentBase64: file.contentBase64 || '',
    ownerId: owner.id,
    ownerEmail: owner.email,
  }));

  sharedFiles.push(...records);
  try {
    await saveSharedFiles();
  } catch (error) {
    sharedFiles.splice(sharedFiles.length - records.length, records.length);
    console.error('[Files] Unable to save uploaded files:', error);
    return res.status(500).json({ error: 'Unable to save files right now.' });
  }

  return res.json({
    files: sharedFiles.map((file) => publicFileRecord(file, owner.id)),
    uploaded: records.map((file) => publicFileRecord(file, owner.id)),
  });
});

app.delete('/api/files/:id', async (req, res) => {
  const owner = await getFileOwner(req);

  // Need either an authenticated user or a valid guest session to delete.
  if (!owner) {
    return res.status(401).json({ error: 'Authentication required to delete files.' });
  }

  const index = sharedFiles.findIndex((file) => file.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'File not found.' });
  }

  const file = sharedFiles[index];
  if (file.ownerId !== owner.id) {
    return res.status(403).json({ error: 'You can only remove files you uploaded.' });
  }

  const [removedFile] = sharedFiles.splice(index, 1);
  try {
    await saveSharedFiles();
  } catch (error) {
    sharedFiles.splice(index, 0, removedFile);
    console.error('[Files] Unable to save file deletion:', error);
    return res.status(500).json({ error: 'Unable to remove file right now.' });
  }

  return res.json({ ok: true, files: sharedFiles.map((record) => publicFileRecord(record, owner.id)) });
});

app.get('/api/auth/session', (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.json({ session: null });
  }

  const session = activeSessions.get(token) || null;
  return res.json({ session });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (supabaseAnonClient) {
    try {
      const { data, error } = await supabaseAnonClient.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }

      const session = {
        access_token: data.session?.access_token || randomUUID(),
        user: data.user || { id: 'unknown', email },
        provider_token: null,
      };
      activeSessions.set(session.access_token, session);
      return res.json({ session });
    } catch (error) {
      console.error('[Supabase Auth] Login failed:', error);
      // A local password-protected account keeps the app usable when a
      // Supabase project is configured but temporarily unavailable.
    }
  }

  const localUser = localUsers.get(email.trim().toLowerCase());
  if (!localUser || !(await passwordMatches(password, localUser.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  return res.json({ session: createLocalSession(localUser) });
});

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (supabaseAdminClient && supabaseAnonClient) {
    try {
      const { data: createdUser, error: createError } = await supabaseAdminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { created_via: 'backend' }
      });

      if (createError) {
        throw createError;
      }

      const { data: loginData, error: loginError } = await supabaseAnonClient.auth.signInWithPassword({ email, password });
      if (loginError) {
        throw loginError;
      }

      const session = {
        access_token: loginData.session?.access_token || randomUUID(),
        user: createdUser.user || loginData.user || { id: 'unknown', email },
        provider_token: null,
      };
      activeSessions.set(session.access_token, session);
      return res.json({ session });
    } catch (error) {
      console.error('[Supabase Auth] Signup failed:', error);
      // Fall back to the local password-protected account store.
    }
  }

  const emailKey = email.trim().toLowerCase();
  if (localUsers.has(emailKey)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const localUser = {
    id: getLocalUserId(email),
    email,
    passwordHash: await hashPassword(password),
  };
  localUsers.set(emailKey, localUser);
  try {
    await saveLocalUsers();
  } catch (error) {
    localUsers.delete(emailKey);
    console.error('[Auth] Unable to save local account:', error);
    return res.status(500).json({ error: 'Unable to create this account right now.' });
  }

  return res.json({ session: createLocalSession(localUser) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getToken(req);
  if (token) {
    activeSessions.delete(token);
  }
  return res.json({ ok: true });
});

app.get('/api/profiles/:id', async (req, res) => {
  const userId = req.params.id;

  if (supabaseAdminClient) {
    try {
      const { data, error } = await supabaseAdminClient.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) {
        throw error;
      }
      return res.json({ profile: data });
    } catch (error) {
      console.error('[Supabase Profile] Fetch failed:', error);
    }
  }

  const profile = profileStore.get(userId) || null;
  return res.json({ profile });
});

app.post('/api/profiles', async (req, res) => {
  const payload = req.body || {};

  if (supabaseAdminClient && payload.id) {
    try {
      const { error } = await supabaseAdminClient.from('profiles').upsert({ id: payload.id, ...payload }, { onConflict: 'id' });
      if (error) {
        throw error;
      }
      return res.json({ ok: true });
    } catch (error) {
      console.error('[Supabase Profile] Save failed:', error);
    }
  }

  if (payload.id) {
    profileStore.set(payload.id, payload);
  }
  return res.json({ ok: true });
});

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

// A production build can be hosted by this same server. In development, Vite
// serves the UI and proxies /api requests to this process instead.
const hasFrontendBuild = await fs.access(frontendIndexPath)
  .then(() => true)
  .catch(() => false);

if (hasFrontendBuild) {
  app.use(express.static(frontendBuildDirectory));
  app.get('*', (_req, res) => res.sendFile(frontendIndexPath));
}

app.listen(PORT, () => {
  console.log(`[Server] StudyMentor Backend running on port ${PORT}`);
});
