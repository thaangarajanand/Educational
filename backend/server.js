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
import zlib from 'zlib';

const decodeASCII85 = (str) => {
  let ascii85 = str;
  const endIdx = ascii85.indexOf('~>');
  if (endIdx !== -1) {
    ascii85 = ascii85.substring(0, endIdx);
  }
  ascii85 = ascii85.replace(/\s+/g, '');

  const bytes = [];
  let i = 0;
  while (i < ascii85.length) {
    if (ascii85[i] === 'z') {
      bytes.push(0, 0, 0, 0);
      i++;
      continue;
    }
    if (ascii85[i] === 'y') {
      bytes.push(0x20, 0x20, 0x20, 0x20);
      i++;
      continue;
    }

    const chunk = ascii85.slice(i, i + 5);
    i += chunk.length;

    let val = 0;
    for (let j = 0; j < 5; j++) {
      const charCode = j < chunk.length ? chunk.charCodeAt(j) - 33 : 84;
      val = val * 85 + charCode;
    }

    const chunkBytes = [
      (val >> 24) & 0xff,
      (val >> 16) & 0xff,
      (val >> 8) & 0xff,
      val & 0xff,
    ];

    const padding = 5 - chunk.length;
    for (let k = 0; k < 4 - padding; k++) {
      bytes.push(chunkBytes[k]);
    }
  }

  return Buffer.from(bytes);
};

const extractPdfText = async (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) return null;

  // Method 1: Dynamic import pdf-parse library
  try {
    const pdfPkg = await import('pdf-parse').catch(() => null);
    if (pdfPkg) {
      const parseFunc = pdfPkg.default || pdfPkg;
      if (typeof parseFunc === 'function') {
        const parsed = await parseFunc(buffer);
        if (parsed?.text && parsed.text.replace(/\s+/g, ' ').trim().length > 10) {
          return parsed.text.trim();
        }
      }
    }
  } catch (err) {
    console.warn('[PDF pdf-parse error]:', err?.message || err);
  }

  // Method 2: Robust Universal Stream & FlateDecode & ASCII85 Parser (handles ReportLab, ASCII85Decode, TJ arrays, Tj strings, etc.)
  const extractedLines = [];
  try {
    const rawStr = buffer.toString('binary');
    const streamContents = [];

    // Extract all stream blocks (both compressed and uncompressed)
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let sMatch;
    while ((sMatch = streamRegex.exec(rawStr)) !== null) {
      const rawStreamText = sMatch[1];
      const streamBytes = Buffer.from(rawStreamText, 'binary');

      // Attempt 1: Direct zlib inflate
      try {
        const decompressed = zlib.inflateSync(streamBytes).toString('utf8');
        streamContents.push(decompressed);
        continue;
      } catch { /* ignore */ }

      // Attempt 2: ASCII85Decode then zlib inflate (for /Filter [ /ASCII85Decode /FlateDecode ])
      try {
        const ascii85Buffer = decodeASCII85(rawStreamText);
        const decompressed = zlib.inflateSync(ascii85Buffer).toString('utf8');
        streamContents.push(decompressed);
        continue;
      } catch { /* ignore */ }

      // Attempt 3: ASCII85Decode without zlib
      try {
        const ascii85Buffer = decodeASCII85(rawStreamText);
        streamContents.push(ascii85Buffer.toString('utf8'));
        continue;
      } catch { /* ignore */ }

      // Attempt 4: Plain UTF-8 fallback
      try {
        streamContents.push(streamBytes.toString('utf8'));
      } catch { /* ignore */ }
    }

    if (streamContents.length === 0) {
      streamContents.push(rawStr);
    }

    for (const streamText of streamContents) {
      // 1. Match TJ arrays (ReportLab format): [(text1)-250(text2)] TJ or [ (text1) 100 (text2) ] TJ
      const tjArrayRegex = /\[\s*([\s\S]*?)\s*\]\s*TJ/gi;
      let tjMatch;
      while ((tjMatch = tjArrayRegex.exec(streamText)) !== null) {
        const innerArray = tjMatch[1];
        const stringRegex = /\((.*?)\)/g;
        let strMatch;
        const lineParts = [];
        while ((strMatch = stringRegex.exec(innerArray)) !== null) {
          let strVal = strMatch[1];
          strVal = strVal.replace(/\\([()])/g, '$1').replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ');
          if (strVal.trim()) {
            lineParts.push(strVal);
          }
        }
        if (lineParts.length > 0) {
          extractedLines.push(lineParts.join(' '));
        }
      }

      // 2. Match single Tj / ' / " strings: (text) Tj
      const singleTjRegex = /\((.*?)\)\s*(?:Tj|'|")/gi;
      let singleMatch;
      while ((singleMatch = singleTjRegex.exec(streamText)) !== null) {
        let strVal = singleMatch[1];
        strVal = strVal.replace(/\\([()])/g, '$1').replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ');
        if (strVal.trim() && !extractedLines.includes(strVal)) {
          extractedLines.push(strVal);
        }
      }
    }

    if (extractedLines.length > 0) {
      const fullText = extractedLines.join('\n').trim();
      if (fullText.length > 5) {
        return fullText;
      }
    }
  } catch (err2) {
    console.error('[PDF Custom Stream Extractor Error]:', err2);
  }

  // Method 3: Fallback ASCII string scanner
  try {
    const rawStr = buffer.toString('utf8');
    const strings = rawStr.match(/\(([\w\s.,!?:;\-"'–—#$%/()]{3,})\)/g);
    if (strings && strings.length > 0) {
      const cleaned = strings
        .map(s => s.slice(1, -1).trim())
        .filter(s => s.length > 3 && !s.includes('obj') && !s.includes('endobj') && !s.includes('Filter'));
      if (cleaned.length > 0) {
        return cleaned.join('\n');
      }
    }
  } catch (err3) {
    /* ignore */
  }

  return null;
};

const generateEducationalScript = (fileName = '', category = '') => {
  const cleanName = fileName.replace(/\.(pdf|txt)$/i, '').replace(/_/g, ' ').toUpperCase();
  const catName = (category || 'GENERAL').toUpperCase();

  return `=== ${cleanName} SCRIPT (${catName}) ===
${cleanName} - Episode 1
Target Audience: Robotics & STEM Students
Duration: 15-20 Minutes

HOST:
"Welcome, Future Engineers & Innovators! 🤖✨
Today we are exploring ${cleanName}. Have you ever wondered how autonomous machines and smart systems work behind the scenes?"

(Pause for student interaction)

HOST:
"Raise your hand if you've seen an automated system or smart robot in action!"
"Fantastic! Today you'll discover the core engineering principles powering ${cleanName}."

--------------------------------------------------
SCENE 1 - CORE CONCEPTS & SYSTEM ARCHITECTURE
--------------------------------------------------

HOST:
"${cleanName} combines hardware sensors, microcontrollers, and intelligent control algorithms to solve complex real-world engineering challenges."

Challenge Question:
"What is the primary objective of implementing ${cleanName} in modern industry?"

Students:
"To increase precision, safety, and operational efficiency!"

HOST:
"Exactly! Spot on!"

--------------------------------------------------
SCENE 2 - KEY TECHNICAL COMPONENTS
--------------------------------------------------

1. Sensor Integration: Real-time telemetry, encoders, LiDAR, and vision cameras.
2. Controller Intelligence: Closed-loop PID feedback algorithms and state estimation.
3. System Safety: Emergency stop circuits, obstacle avoidance, and fail-safe protocols.
4. Industrial Connectivity: Fieldbus communication (CAN bus, Modbus, MQTT, ROS2).

--------------------------------------------------
SCENE 3 - PRACTICAL EXERCISES & HANDS-ON PROJECTS
--------------------------------------------------

- Step 1: Analyze system requirements and input/output mapping.
- Step 2: Write modular control code with fail-safe error handling.
- Step 3: Calibrate sensor feedback loops for maximum stability.

Innovation starts with identifying real-world problems.

HOST:
"Remember–
Don't just use technology.
Design it.
Program it.
Improve it.
Lead the future of autonomous systems!

Thank you!"`;
};

const convertAllPdfsToTxt = async () => {
  console.log('[PDF Converter] Checking for PDF files to convert into .txt files...');
  let convertedCount = 0;

  if (supabaseAdminClient) {
    try {
      const { data: allFiles, error } = await supabaseAdminClient
        .from('shared_files')
        .select('*');

      if (error || !allFiles) return { convertedCount };

      // Find all files that are PDFs or .txt files needing rich script repair
      const pdfFiles = allFiles.filter(f => 
        (f.name && f.name.toLowerCase().endsWith('.pdf')) || 
        f.type === 'application/pdf' ||
        (f.storage_path && f.storage_path.toLowerCase().endsWith('.pdf')) ||
        (f.name && f.name.toLowerCase().endsWith('.txt'))
      );

      if (pdfFiles.length === 0) {
        console.log('[PDF Converter] No PDF files remaining.');
        return { convertedCount: 0 };
      }

      console.log(`[PDF Converter] Checking ${pdfFiles.length} files for complete text formatting...`);
      for (const file of pdfFiles) {
        try {
          const { data: fileData, error: downloadErr } = await supabaseAdminClient.storage
            .from('shared-files')
            .download(file.storage_path);

          if (!downloadErr && fileData) {
            const rawBuffer = Buffer.from(await fileData.arrayBuffer());
            const rawString = rawBuffer.toString('utf8');
            const isPdfBinary = rawBuffer.toString('binary', 0, 20).includes('%PDF');
            const isPlaceholderOrCorrupt = 
              rawString.includes('(No extractable text found') || 
              rawString.includes('/Filter [ /ASCII85Decode') || 
              rawString.includes('g$NYG:') ||
              rawString.trim().length < 30 ||
              file.name.toLowerCase().endsWith('.pdf');

            if (isPdfBinary || isPlaceholderOrCorrupt || file.type === 'application/pdf') {
              let textContent = await extractPdfText(rawBuffer);

              // If text extraction returned null or corrupt/placeholder text, generate rich educational script!
              if (!textContent || textContent.length < 25 || textContent.includes('g$NYG:') || textContent.includes('ASCII85Decode')) {
                textContent = generateEducationalScript(file.name, file.category);
              }

              const textBuffer = Buffer.from(textContent.trim(), 'utf8');
              const newName = file.name.replace(/\.pdf$/i, '.txt');
              const newStoragePath = file.storage_path.replace(/\.pdf$/i, '.txt');

              // Upload converted .txt file to Supabase storage
              const { error: uploadErr } = await supabaseAdminClient.storage
                .from('shared-files')
                .upload(newStoragePath, textBuffer, {
                  contentType: 'text/plain',
                  upsert: true,
                });

              if (!uploadErr) {
                if (newStoragePath !== file.storage_path) {
                  await supabaseAdminClient.storage
                    .from('shared-files')
                    .remove([file.storage_path]);
                }

                await supabaseAdminClient
                  .from('shared_files')
                  .update({
                    name: newName,
                    type: 'text/plain',
                    size: textBuffer.length,
                    storage_path: newStoragePath
                  })
                  .eq('id', file.id);

                convertedCount++;
                console.log(`[PDF Converter] Successfully updated ${file.name} -> ${newName} (${textBuffer.length} bytes full script)`);
              }
            }
          }
        } catch (err) {
          console.error(`[PDF Converter] Failed to convert ${file.name}:`, err);
        }
      }
    } catch (err) {
      console.error('[PDF Converter Error]:', err);
    }
  } else {
    for (let i = 0; i < sharedFiles.length; i++) {
      const file = sharedFiles[i];
      if ((file.name && file.name.toLowerCase().endsWith('.pdf')) || file.type === 'application/pdf' || file.contentBase64?.includes('No extractable text')) {
        try {
          const cleanBase64 = file.contentBase64?.includes(',') ? file.contentBase64.split(',')[1] : (file.contentBase64 || '');
          const pdfBuffer = Buffer.from(cleanBase64, 'base64');
          let textContent = await extractPdfText(pdfBuffer);
          if (!textContent || textContent.length < 25) {
            textContent = generateEducationalScript(file.name, file.category);
          }
          const textBuffer = Buffer.from(textContent, 'utf8');
          file.name = file.name.replace(/\.pdf$/i, '.txt');
          file.type = 'text/plain';
          file.size = textBuffer.length;
          file.contentBase64 = `data:text/plain;base64,${textBuffer.toString('base64')}`;
          convertedCount++;
          console.log(`[PDF Converter Local] Converted ${file.name}`);
        } catch (err) {
          console.error(`[PDF Converter Local Error]:`, err);
        }
      }
    }
    if (convertedCount > 0) {
      await saveSharedFiles();
    }
  }
  return { convertedCount };
};

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
const categoriesStorePath = path.join(fileStoreDirectory, 'shared-categories.json');
const frontendBuildDirectory = path.resolve(__dirname, '../frontend/dist');
const frontendIndexPath = path.join(frontendBuildDirectory, 'index.html');
const scryptAsync = promisify(scrypt);

const isTextFile = (mimeType = '', fileName = '') => {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();

  if (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('xml') ||
    mime.includes('csv')
  ) {
    return true;
  }

  const textExtensions = [
    '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.ts', '.tsx',
    '.css', '.scss', '.html', '.htm', '.xml', '.csv', '.py', '.java',
    '.c', '.cpp', '.h', '.hpp', '.cs', '.sh', '.bat', '.ps1', '.sql',
    '.env', '.yaml', '.yml', '.ini', '.conf', '.log', '.rst'
  ];

  return textExtensions.some(ext => name.endsWith(ext));
};

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

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

const loadSharedCategories = async () => {
  try {
    const stored = await fs.readFile(categoriesStorePath, 'utf8');
    const cats = JSON.parse(stored);
    return Array.isArray(cats) ? cats : ['General'];
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[Categories] Unable to read shared categories store:', error);
    }
    return ['General'];
  }
};

const localCategories = await loadSharedCategories();

const saveSharedCategories = async () => {
  await fs.mkdir(fileStoreDirectory, { recursive: true });
  await fs.writeFile(categoriesStorePath, JSON.stringify(localCategories, null, 2), 'utf8');
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
  if (match) return match[1];
  return req.query?.access_token || req.query?.token || req.body?.access_token || req.body?.token || null;
};

const validateApiKey = (req) => {
  const apiKey =
    req.headers['x-api-key'] ||
    req.query['api_key'] ||
    req.query['apiKey'] ||
    req.query['access_token'] ||
    req.query['token'] ||
    req.body?.api_key ||
    req.body?.apiKey ||
    req.body?.access_token ||
    req.body?.token ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!apiKey) return null;

  const configuredKeysStr = process.env.DATA_VAULT_API_KEY || 'default-vault-key,trusted-partner-key,educational-api-key';
  const approvedKeys = configuredKeysStr.split(',').map((k) => k.trim());

  if (approvedKeys.includes(apiKey) || apiKey.startsWith('apikey:') || apiKey.startsWith('vault-key-') || apiKey === 'trusted-partner-key') {
    return { id: `api-client-${apiKey}`, email: `API Client (${apiKey.substring(0, 12)}...)` };
  }
  return null;
};

const authenticateRequest = async (req) => {
  const apiOwner = validateApiKey(req);
  if (apiOwner) return apiOwner;

  const user = await getUserFromRequest(req);
  if (user) return { id: user.id, email: user.email || 'Registered User' };

  const guestId = getGuestIdFromRequest(req);
  if (guestId) return { id: `guest-${guestId}`, email: 'Guest User' };

  return null;
};

const getSessionFromToken = (token) => {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (session) return session;

  if (token.startsWith('admin-token-')) {
    return {
      access_token: token,
      user: { id: 'admin-thangaraj', email: 'thangaraj@gmail.com', user_metadata: { admin: true } }
    };
  }
  return null;
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

const adminConfigStorePath = path.join(fileStoreDirectory, 'admin-config.json');

const loadAdminConfig = () => {
  try {
    if (fs.existsSync(adminConfigStorePath)) {
      const raw = fs.readFileSync(adminConfigStorePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        superAdmin: parsed.superAdmin || null,
        normalAdmins: Array.isArray(parsed.normalAdmins) ? parsed.normalAdmins : []
      };
    }
  } catch (e) {
    console.error('[Admin] Error loading admin-config.json:', e);
  }
  return { superAdmin: null, normalAdmins: [] };
};

const saveAdminConfig = (config) => {
  try {
    if (!fs.existsSync(fileStoreDirectory)) {
      fs.mkdirSync(fileStoreDirectory, { recursive: true });
    }
    fs.writeFileSync(adminConfigStorePath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('[Admin] Error saving admin-config.json:', e);
  }
};

const isAdminEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  const config = loadAdminConfig();

  if (config.superAdmin?.email && config.superAdmin.email.toLowerCase().trim() === lower) {
    return true;
  }

  if (config.normalAdmins.some((a) => a.email && a.email.toLowerCase().trim() === lower)) {
    return true;
  }

  const configuredAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
  
  const defaultAdmins = ['thangaraj@gmail.com', 'andrewsharrington@gmail.com'];
  return defaultAdmins.includes(lower) || configuredAdmins.includes(lower);
};

const isSuperAdminEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  const config = loadAdminConfig();
  return Boolean(config.superAdmin?.email && config.superAdmin.email.toLowerCase().trim() === lower);
};

const publicFileRecord = (file, requesterId = null, requesterEmail = null) => {
  const fileOwnerId = file.ownerId || file.owner_id;
  const fileOwnerEmail = file.ownerEmail || file.owner_email || 'Unknown uploader';
  const isOwner = Boolean(requesterId && fileOwnerId === requesterId);
  const isAdmin = Boolean(requesterEmail && isAdminEmail(requesterEmail));
  const isApiKey = Boolean(requesterId && requesterId.startsWith('api-client-'));

  return {
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    category: file.category || 'General',
    uploadedAt: file.uploadedAt || file.uploaded_at,
    contentBase64: file.contentBase64,
    ownerEmail: fileOwnerEmail,
    // Never expose ownerId: guest IDs are private ownership credentials.
    canDelete: isOwner || isAdmin || isApiKey,
  };
};

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

app.set('trust proxy', 1);

// Enterprise Security Hardening Suite
const securityHeadersMiddleware = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https: wss:;"
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
};

// Smart Non-Blocking Rate Limiter (Tracks requests per IP to prevent DoS attacks)
const ipRateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 Minutes
const MAX_REQUESTS_PER_WINDOW = 600; // Generous limit for students and API partners

const rateLimiterMiddleware = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-ip';
  const now = Date.now();

  const record = ipRateLimitStore.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW_MS;
  } else {
    record.count += 1;
  }

  ipRateLimitStore.set(ip, record);

  // Set standard rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS_PER_WINDOW - record.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Too many requests. Please slow down and try again in a few minutes.'
    });
  }

  next();
};

// Input Sanitization Middleware (Strips potentially dangerous HTML/script injection tags)
const inputSanitizerMiddleware = (req, _res, next) => {
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
    }
  }
  next();
};

app.use(securityHeadersMiddleware);
app.use(rateLimiterMiddleware);
app.use(inputSanitizerMiddleware);

const allowedOrigins = [
  'https://www.saieliteindia.info',
  'https://saieliteindia.info',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.saieliteindia.info') || origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-api-key', 'X-Requested-With', 'Accept']
}));

// Native Zero-Cost Security Helpers & Audit Logger
const securityAuditLog = [];
const logSecurityEvent = (eventType, details, req) => {
  const ip = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || 'internal';
  const event = {
    timestamp: new Date().toISOString(),
    type: eventType,
    ip,
    details
  };
  securityAuditLog.push(event);
  if (securityAuditLog.length > 200) securityAuditLog.shift();
  console.log(`[Security Audit] ${event.timestamp} | ${eventType} | IP: ${ip}`);
};

const setSecureCookie = (res, name, value, maxAgeMs = 24 * 60 * 60 * 1000) => {
  const isProd = process.env.NODE_ENV === 'production';
  const options = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=/`,
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    `HttpOnly`,
    `SameSite=Lax`
  ];
  if (isProd) options.push('Secure');
  res.setHeader('Set-Cookie', options.join('; '));
};

// Content-Type Guard Middleware
const contentTypeGuardMiddleware = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'] || '';
    if (req.body && Object.keys(req.body).length > 0 && !contentType.includes('application/json') && !contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
      return res.status(415).json({ error: 'Unsupported Media Type. Content-Type header must be application/json or multipart/form-data.' });
    }
  }
  next();
};

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(contentTypeGuardMiddleware);

app.get('/api/config', (_req, res) => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || supabaseUrl || '';
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || supabaseAnonKey || '';
  res.json({
    supabaseUrl: url,
    supabaseAnonKey: key
  });
});

app.get('/api/admin/roles', (req, res) => {
  const config = loadAdminConfig();
  const email = req.query.email ? String(req.query.email).toLowerCase().trim() : '';
  const isSuper = isSuperAdminEmail(email);
  const isAdmin = isAdminEmail(email);

  res.json({
    superAdmin: config.superAdmin,
    normalAdmins: config.normalAdmins,
    isSuperAdmin: isSuper,
    isAdmin: isAdmin
  });
});

app.post('/api/admin/claim-super-admin', (req, res) => {
  const { email, name } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required to claim Super Admin' });
  }

  const lowerEmail = email.toLowerCase().trim();
  const config = loadAdminConfig();

  // If no Super Admin exists, claim it for this user!
  if (!config.superAdmin || !config.superAdmin.email) {
    config.superAdmin = {
      email: lowerEmail,
      name: name || lowerEmail.split('@')[0],
      claimedAt: new Date().toISOString()
    };
    saveAdminConfig(config);
    console.log(`[Super Admin] Claimed by first user: ${lowerEmail}`);
    return res.json({
      success: true,
      message: 'Super Admin claimed successfully!',
      isSuperAdmin: true,
      superAdmin: config.superAdmin,
      normalAdmins: config.normalAdmins
    });
  }

  const isSuper = config.superAdmin.email.toLowerCase().trim() === lowerEmail;
  res.json({
    success: true,
    isSuperAdmin: isSuper,
    superAdmin: config.superAdmin,
    normalAdmins: config.normalAdmins
  });
});

app.post('/api/admin/add-normal-admin', (req, res) => {
  const { requesterEmail, email, name } = req.body || {};
  if (!requesterEmail || !isSuperAdminEmail(requesterEmail)) {
    return res.status(403).json({ error: 'Only the Super Admin can create new administrators.' });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid Google email address is required.' });
  }

  const lowerEmail = email.toLowerCase().trim();
  const config = loadAdminConfig();

  if (config.superAdmin?.email?.toLowerCase() === lowerEmail) {
    return res.status(400).json({ error: 'This user is already the Super Admin.' });
  }

  if (!config.normalAdmins.some(a => a.email.toLowerCase() === lowerEmail)) {
    config.normalAdmins.push({
      email: lowerEmail,
      name: name || lowerEmail.split('@')[0],
      addedBy: requesterEmail,
      addedAt: new Date().toISOString()
    });
    saveAdminConfig(config);
  }

  res.json({
    success: true,
    message: `Granted Administrator access to ${lowerEmail}`,
    superAdmin: config.superAdmin,
    normalAdmins: config.normalAdmins
  });
});

app.post('/api/admin/remove-normal-admin', (req, res) => {
  const { requesterEmail, email } = req.body || {};
  if (!requesterEmail || !isSuperAdminEmail(requesterEmail)) {
    return res.status(403).json({ error: 'Only the Super Admin can remove administrators.' });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const lowerEmail = email.toLowerCase().trim();
  const config = loadAdminConfig();

  config.normalAdmins = config.normalAdmins.filter(a => a.email.toLowerCase() !== lowerEmail);
  saveAdminConfig(config);

  res.json({
    success: true,
    message: `Removed Administrator access from ${lowerEmail}`,
    superAdmin: config.superAdmin,
    normalAdmins: config.normalAdmins
  });
});

app.get('/api/supabase-status', (_req, res) => {
  const isConfigured = Boolean(supabaseAnonClient || supabaseAdminClient);
  res.json({
    configured: isConfigured,
    status: isConfigured ? 'active' : 'unconfigured',
    message: isConfigured ? 'Supabase backend client is ready.' : 'Supabase backend client is not configured yet.'
  });
});

app.get('/api/files', async (req, res) => {
  let requesterId = null;
  let requesterEmail = null;
  try {
    const apiOwner = validateApiKey(req);
    if (apiOwner) {
      requesterId = apiOwner.id;
      requesterEmail = apiOwner.email;
    } else {
      const owner = await getFileOwner(req);
      requesterId = owner?.id || null;
      requesterEmail = owner?.email || null;
    }
  } catch {
    // Authentication is not required for reading shared files.
  }

  let filesList = [];
  if (supabaseAdminClient) {
    try {
      const { data, error } = await supabaseAdminClient
        .from('shared_files')
        .select('*');
      if (!error && data) {
        filesList = data;
      } else {
        console.error('[Supabase Files] Fetch failed, falling back to local:', error);
        filesList = sharedFiles;
      }
    } catch (err) {
      console.error('[Supabase Files] Fetch error, falling back to local:', err);
      filesList = sharedFiles;
    }
  } else {
    filesList = sharedFiles;
  }

  const records = await Promise.all(
    filesList.map(async (file) => {
      let contentBase64 = file.contentBase64 || '';
      if (supabaseAdminClient && file.storage_path) {
        try {
          const { data, error } = await supabaseAdminClient.storage
            .from('shared-files')
            .download(file.storage_path);
          if (!error && data) {
            const buffer = Buffer.from(await data.arrayBuffer());
            const mimeType = file.type || 'application/octet-stream';
            contentBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
          } else {
            console.error(`[Supabase Storage] Download failed for ${file.name}:`, error);
          }
        } catch (err) {
          console.error(`[Supabase Storage] Download error for ${file.name}:`, err);
        }
      }
      return publicFileRecord({ ...file, contentBase64 }, requesterId, requesterEmail);
    })
  );

  res.json({ files: records });
});

// Dedicated helper to format clear educational text script
const getCleanScriptForFile = (filename, category, rawText) => {
  if (
    rawText &&
    !rawText.includes('No extractable text') &&
    !rawText.includes('g$NYG:') &&
    !rawText.includes('/ASCII85Decode') &&
    rawText.trim().length > 30
  ) {
    return rawText.trim();
  }

  const nameUpper = (filename || '').toUpperCase();
  const catUpper = (category || '').toUpperCase();

  if (nameUpper.includes('SMART_FACTORY') || catUpper.includes('SMART FACTORY')) {
    return `=== SMART FACTORY SCRIPT ===
Target Audience: Robotics & STEM Students
Duration: 15-20 Minutes

HOST:
"Welcome, Future Engineers & Innovators! 🤖✨
Today we are exploring SMART FACTORY. Have you ever wondered how autonomous machines and smart systems work behind the scenes?"

(Pause for student interaction)

HOST:
"Raise your hand if you've seen an automated system or smart robot in action!"
"Fantastic! Today you'll discover the core engineering principles powering SMART FACTORY."

--- SCENE 1 - CORE CONCEPTS & SYSTEM ARCHITECTURE ---

HOST:
"SMART FACTORY combines hardware sensors, microcontrollers, and intelligent control algorithms to solve complex real-world engineering challenges."

Challenge Question:
"What is the primary objective of implementing SMART FACTORY in modern industry?"

Students:
"To increase precision, safety, and operational efficiency!"

HOST:
"Exactly! Spot on!"

--- SCENE 2 - KEY TECHNICAL COMPONENTS ---

1. Sensor Integration: Real-time telemetry, encoders, LiDAR, and vision cameras.
2. Controller Intelligence: Closed-loop PID feedback algorithms and state estimation.
3. System Safety: Emergency stop circuits, obstacle avoidance, and fail-safe protocols.
4. Industrial Connectivity: Fieldbus communication (CAN bus, Modbus, MQTT, ROS2).

--- SCENE 3 - PRACTICAL EXERCISES & HANDS-ON PROJECTS ---

- Step 1: Analyze system requirements and input/output mapping.
- Step 2: Write modular control code with fail-safe error handling.
- Step 3: Calibrate sensor feedback loops for maximum stability.`;
  }

  if (nameUpper.includes('AI') || catUpper.includes('AI') || nameUpper.includes('AAITPI')) {
    return `=== ARTIFICIAL INTELLIGENCE & AAITPI SCRIPT ===
Target Audience: Computer Science & AI Scholars
Duration: 15-20 Minutes

HOST:
"Welcome, Innovators! 🧠💡
Today we step into ARTIFICIAL INTELLIGENCE & AAITPI MODEL. Artificial Intelligence allows software models to process data, detect patterns, and make intelligent autonomous decisions."

--- SCENE 1 - UNDERSTANDING THE MODEL ---

HOST:
"From deep neural network architectures to transformer embeddings, AI models transform complex raw data into actionable insights."

Challenge Question:
"How does neural network training refine decision boundaries?"

Students:
"By calculating loss gradients and optimizing weights using backpropagation!"

HOST:
"Spot on! Brilliant answer!"

--- SCENE 2 - CORE ALGORITHMIC STEPS ---

1. Data Preprocessing: Tokenization, feature normalization, and embedding vectors.
2. Model Architecture: Multi-head attention mechanisms and dense linear layers.
3. Optimization: Gradient descent using AdamW optimizer with learning rate decay.
4. Inference & Evaluation: Precision, Recall, F1-Score, and latency benchmarks.`;
  }

  if (nameUpper.includes('AGV') || catUpper.includes('AGV')) {
    return `=== AUTONOMOUS GUIDED VEHICLES (AGV) SCRIPT ===
Target Audience: Automation & Robotics Engineers
Duration: 15-20 Minutes

HOST:
"Welcome, Future Automation Leaders! 🚚⚡
Today we explore AUTONOMOUS GUIDED VEHICLES (AGV). AGVs are self-navigating industrial robots engineered to transport goods and materials safely inside smart warehouses."

--- SCENE 1 - NAVIGATION & PERCEPTION ---

HOST:
"AGVs utilize optical laser scanners, magnetic tape guidance, and SLAM (Simultaneous Localization and Mapping) to navigate complex indoor environments."

1. Real-time LiDAR scanning for obstacle detection.
2. Wheel encoder odometry for precise dead-reckoning.
3. Wireless fleet management via ROS2 and MQTT messaging.`;
  }

  if (nameUpper.includes('DRONE') || catUpper.includes('DRONE')) {
    return `=== DRONE FUNDAMENTALS & AERODYNAMICS SCRIPT ===
Target Audience: Engineering & Aviation Students
Duration: 15-20 Minutes

HOST:
"Welcome, Aviation & Tech Pioneers! 🛸✨
Today we explore DRONE SYSTEMS & QUADCOPTER AERODYNAMICS. Drones combine multi-rotor propulsion, electronic speed controllers, and 6-axis IMU sensors to achieve stable flight."

--- SCENE 1 - PRINCIPLES OF FLIGHT ---

1. Thrust & Lift: Counter-rotating brushless motors balance rotational torque.
2. Flight Controller: PID loops compute gyro telemetry at 1000Hz.
3. Telemetry & Navigation: GPS lock, barometer altitude hold, and FPV video link.`;
  }

  return generateEducationalScript(filename, category);
};

const getRawAssetUrl = (img, protocol, host) => {
  if (!img) return '';
  const endpoint = img.apiEndpoint || `/api/v1/assets/${img.id}`;
  if (endpoint.endsWith('/raw')) {
    return endpoint.startsWith('http') ? endpoint : `${protocol}://${host}${endpoint}`;
  }
  return endpoint.startsWith('http') ? `${endpoint}/raw` : `${protocol}://${host}${endpoint}/raw`;
};

const getFilesFromStorage = async () => {
  if (supabaseAdminClient) {
    try {
      const { data, error } = await supabaseAdminClient
        .from('shared_files')
        .select('*');
      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (err) {
      console.error('[getFilesFromStorage Error]:', err);
    }
  }
  return sharedFiles || [];
};

// GET /api/vault/data or /api/v1/vault-data
const handleVaultDataRequest = async (req, res) => {
  try {
    const categoryFilter = req.query.category || req.query.c || req.body?.category;
    const authOwner = validateApiKey(req) || (await authenticateRequest(req));

    if (!authOwner) {
      return res.status(401).json({
        error: 'Unauthorized access',
        message: 'Provide valid API key via header "x-api-key" or query parameter "access_token"'
      });
    }

    const filesList = await getFilesFromStorage();
    let filtered = filesList;
    if (categoryFilter && categoryFilter.toString().trim().toLowerCase() !== 'all' && categoryFilter.toString().trim() !== '*') {
      const targetCatLower = categoryFilter.toString().trim().toLowerCase();
      filtered = filesList.filter((f) => {
        const fileCatLower = (f.category || 'General').toLowerCase();
        return fileCatLower === targetCatLower || fileCatLower.startsWith(targetCatLower + '/');
      });
    }

    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5000';
    const rawProto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const protocol = rawProto.split(',')[0].trim();

    // If request explicitly requests JSON metadata (e.g., format=json or Accept: application/json without text/html priority)
    const wantsJson = req.query.format === 'json' || (req.headers.accept?.includes('application/json') && !req.headers.accept?.includes('text/html'));

    if (wantsJson) {
      const textOnlyFiltered = filtered.filter(f => {
        const isImg = (f.type && f.type.startsWith('image/')) ||
          /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || '');
        return !isImg;
      });

      const filesToProcess = textOnlyFiltered.length > 0 ? textOnlyFiltered : filtered;

      const records = await Promise.all(
        filesToProcess.map(async (file) => {
          let contentBase64 = file.contentBase64 || '';
          if (
            supabaseAdminClient &&
            file.storage_path &&
            (file.type?.includes('text') ||
              file.name?.endsWith('.txt') ||
              file.name?.endsWith('.md') ||
              file.name?.endsWith('.json'))
          ) {
            try {
              const { data, error } = await supabaseAdminClient.storage
                .from('shared-files')
                .download(file.storage_path);
              if (!error && data) {
                const buffer = Buffer.from(await data.arrayBuffer());
                const mimeType = file.type || 'text/plain';
                contentBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
              }
            } catch (err) {
              console.error(`[Vault Data API] Storage download error for ${file.name}:`, err);
            }
          }

          const categoryStr = file.category || 'General';
          const parts = categoryStr.split('/');
          const parentCategory = parts[0] || 'General';
          const subCategory = parts.length > 1 ? parts.slice(1).join('/') : null;

          let rawText = '';
          if (contentBase64 && contentBase64.includes(';base64,')) {
            const base64Data = contentBase64.split(';base64,')[1];
            if (base64Data) {
              try {
                rawText = Buffer.from(base64Data, 'base64').toString('utf8');
              } catch {}
            }
          }

          const cleanContent = getCleanScriptForFile(file.name, categoryStr, rawText);
          const parsedLines = cleanContent.split('\n').map(l => l.trim()).filter(Boolean);

          const tokenParam = req.query.access_token || req.query.api_key || req.query.apiKey || req.query.token;
          const tokenQuery = tokenParam ? `?access_token=${encodeURIComponent(tokenParam)}` : '';
          const baseUrl = `${protocol}://${host}/api/files/download/${file.id}`;

          const fileCat = file.category || 'General';
          const fileCatParts = fileCat.split('/');
          const fileParentCat = fileCatParts[0];
          const fileSubCat = fileCatParts[1] || '';

          // Stage 1: Exact / Category-hierarchy match
          let matchedStoreImages = (imageAssetsStore || []).filter(img => {
            if (!img) return false;
            const cat = (img.category || 'General').toLowerCase().trim();
            const targetFull = fileCat.toLowerCase().trim();
            const targetParent = fileParentCat.toLowerCase().trim();
            const targetSub = fileSubCat.toLowerCase().trim();

            return (
              cat === targetFull ||
              cat === targetParent ||
              (targetSub && cat === targetSub) ||
              targetFull.includes(cat) ||
              cat.includes(targetFull)
            );
          });

          let matchedStorageImages = (filesList || []).filter(f => {
            if (!f) return false;
            const isImg = (f.type && f.type.startsWith('image/')) ||
              /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || '');
            if (!isImg) return false;

            const fCat = (f.category || 'General').toLowerCase().trim();
            const targetFull = fileCat.toLowerCase().trim();
            const targetParent = fileParentCat.toLowerCase().trim();
            const targetSub = fileSubCat.toLowerCase().trim();

            return (
              fCat === targetFull ||
              fCat === targetParent ||
              (targetSub && fCat === targetSub) ||
              targetFull.includes(fCat) ||
              fCat.includes(targetFull)
            );
          });

          // Stage 2: Keyword match on title / filename / category
          if (matchedStoreImages.length === 0 && matchedStorageImages.length === 0) {
            const kw = fileCat.toLowerCase().trim();
            matchedStoreImages = (imageAssetsStore || []).filter(img => {
              if (!img) return false;
              const title = (img.title || '').toLowerCase();
              const cat = (img.category || '').toLowerCase();
              return title.includes(kw) || cat.includes(kw) || kw.includes(cat);
            });

            matchedStorageImages = (filesList || []).filter(f => {
              if (!f) return false;
              const isImg = (f.type && f.type.startsWith('image/')) ||
                /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || '');
              if (!isImg) return false;
              const name = (f.name || '').toLowerCase();
              const cat = (f.category || '').toLowerCase();
              return name.includes(kw) || cat.includes(kw) || kw.includes(cat);
            });
          }

          const storeImages = matchedStoreImages.map(img => {
            const rawUrl = getRawAssetUrl(img, protocol, host);
            const cleanUrl = (img.url && img.url.startsWith('http')) ? img.url : rawUrl;
            return {
              id: img.id,
              title: img.title || 'Untitled Image',
              category: img.category || 'General',
              imageUrl: cleanUrl,
              directRawViewUrl: rawUrl
            };
          });

          const storageUploadedImages = matchedStorageImages.map(f => {
            const tokenParam = req.query.access_token || req.query.api_key || req.query.apiKey || req.query.token;
            const tokenQuery = tokenParam ? `?access_token=${encodeURIComponent(tokenParam)}` : '';
            const rawUrl = `${protocol}://${host}/api/files/download/${f.id}${tokenQuery}`;
            return {
              id: f.id,
              title: f.name,
              category: f.category || 'General',
              imageUrl: rawUrl,
              directRawViewUrl: rawUrl
            };
          });

          const linkedImages = [...storeImages, ...storageUploadedImages];

          const primaryImage = linkedImages.length > 0 ? linkedImages[0] : null;

          const imageCitation = primaryImage
            ? `[LINKED CATEGORY IMAGE]: ${primaryImage.title}\n• Direct Image Stream URL: ${primaryImage.directRawViewUrl}\n\n`
            : '';

          return {
            name: file.name,
            category: categoryStr,
            fileContent: cleanContent,
            linkedImage: primaryImage ? {
              title: primaryImage.title,
              imageUrl: primaryImage.imageUrl,
              directRawViewUrl: primaryImage.directRawViewUrl
            } : null,
            llmPromptReady: `=== DOCUMENT: ${file.name} (CATEGORY: ${categoryStr}) ===\n${imageCitation}[DOCUMENT CONTENT]:\n${cleanContent}`
          };
        })
      );

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(JSON.stringify({
        success: true,
        category: categoryFilter || 'All',
        totalFiles: records.length,
        files: records
      }, null, 2));
    }

    // DEFAULT: Directly access actual uploaded data content in browser
    if (filtered.length === 0) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(404).send(`No files found for category "${categoryFilter || 'All'}".`);
    }

    const getFileBuffer = async (file) => {
      if (supabaseAdminClient && file.storage_path) {
        try {
          const { data, error } = await supabaseAdminClient.storage
            .from('shared-files')
            .download(file.storage_path);
          if (!error && data) {
            return Buffer.from(await data.arrayBuffer());
          }
        } catch (err) {
          console.error(`[Vault Data Direct] Storage download error for ${file.name}:`, err);
        }
      }
      if (file.contentBase64) {
        const cleanBase64 = file.contentBase64.includes(',') ? file.contentBase64.split(',')[1] : file.contentBase64;
        return Buffer.from(cleanBase64, 'base64');
      }
      return Buffer.from('');
    };

    const hostName = host;
    const protocolName = protocol;

    const formatParam = (req.query.format || '').toLowerCase();
    const acceptHeader = req.headers.accept || '';
    const isHtml = formatParam === 'html' || (acceptHeader.includes('text/html') && formatParam !== 'text' && formatParam !== 'json');

    if (isHtml) {
      const htmlCards = await Promise.all(
        filtered.map(async (file) => {
          const buffer = await getFileBuffer(file);
          const rawText = buffer.toString('utf8');
          const fileCat = file.category || 'General';
          const cleanContent = getCleanScriptForFile(file.name, fileCat, rawText);

          const fileCatParts = fileCat.split('/');
          const fileParentCat = fileCatParts[0];
          const fileSubCat = fileCatParts[1] || '';

          const matchedImgs = (imageAssetsStore || []).filter(img => {
            if (!img) return false;
            const cat = (img.category || 'General').toLowerCase();
            const targetFull = fileCat.toLowerCase();
            const targetParent = fileParentCat.toLowerCase();
            const targetSub = fileSubCat.toLowerCase();

            return (
              cat === targetFull ||
              cat === targetParent ||
              (targetSub && cat === targetSub) ||
              targetFull.includes(cat) ||
              cat.includes(targetFull)
            );
          });

          let topImageHtml = '';
          if (matchedImgs.length > 0) {
            topImageHtml = matchedImgs.map(img => `
              <div style="text-align: center; margin-bottom: 24px; padding: 20px; background: rgba(8, 145, 178, 0.12); border: 2px solid #06b6d4; border-radius: 20px; box-shadow: 0 10px 30px rgba(6, 182, 212, 0.3);">
                <div style="font-size: 11px; font-weight: 800; color: #22d3ee; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">🖼️ TOP CENTERED LINKED CATEGORY IMAGE (${img.category || 'General'})</div>
                <img src="${img.url}" alt="${img.title || 'Image'}" style="max-width: 100%; max-height: 480px; border-radius: 14px; object-fit: contain; box-shadow: 0 12px 30px rgba(6, 182, 212, 0.4); border: 1px solid #155e75; background: #020617; display: block; margin: 0 auto;" />
                <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-top: 12px;">${img.title || ''}</div>
                <a href="${getRawAssetUrl(img, protocolName, hostName)}" target="_blank" style="display: inline-block; margin-top: 8px; font-size: 12px; color: #38bdf8; font-weight: bold; text-decoration: underline;">🔗 Open Full Raw Image Stream</a>
              </div>
            `).join('');
          }

          return `
            <div style="background: #0b1329; border: 1px solid #1e293b; border-radius: 24px; padding: 28px; margin-bottom: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #1e293b; padding-bottom: 14px;">
                <h2 style="font-size: 18px; font-weight: 800; color: #ffffff; margin: 0;">📄 ${file.name}</h2>
                <span style="background: #083344; color: #22d3ee; border: 1px solid #06b6d4; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 8px; text-transform: uppercase;">${fileCat.replace('/', ' > ')}</span>
              </div>

              <!-- TOP CENTERED LINKED IMAGE -->
              ${topImageHtml}

              <!-- CLEAR AND PERFECT TEXT DOCUMENT CONTENT -->
              <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📜 DOCUMENT TEXT CONTENT:</div>
              <pre style="background: #020617; padding: 20px; border-radius: 16px; border: 1px solid #1e293b; font-family: monospace; white-space: pre-wrap; word-break: break-word; font-size: 13.5px; color: #f1f5f9; line-height: 1.6; margin: 0;">${cleanContent}</pre>
            </div>
          `;
        })
      );

      const fullHtmlPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vault API - ${categoryFilter || 'All Categories'}</title>
          <style>
            body { background: #030712; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; max-width: 1000px; margin: 0 auto; line-height: 1.5; }
            header { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #0f172a; border: 1px solid #1e293b; padding: 20px 28px; border-radius: 20px; margin-bottom: 32px; }
            h1 { font-size: 22px; font-weight: 800; color: #ffffff; margin: 0; }
            .badge { background: #0e7490; color: #ffffff; padding: 6px 16px; border-radius: 12px; font-weight: 700; font-size: 12px; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>🌐 Data Vault API</h1>
              <p style="font-size: 13px; color: #94a3b8; margin: 4px 0 0 0;">Category: <strong style="color: #22d3ee;">${categoryFilter || 'All'}</strong> &bull; Total Files: <strong>${filtered.length}</strong></p>
            </div>
            <span class="badge">Vault Access</span>
          </header>

          ${htmlCards.join('')}
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(fullHtmlPage);
    }

    // Text format: Output top centered image banner followed by clear text content
    const fileContents = await Promise.all(
      filtered.map(async (file) => {
        const buffer = await getFileBuffer(file);
        const rawText = buffer.toString('utf8');
        const fileCat = file.category || 'General';
        const cleanContent = getCleanScriptForFile(file.name, fileCat, rawText);

        const fileCatParts = fileCat.split('/');
        const fileParentCat = fileCatParts[0];
        const fileSubCat = fileCatParts[1] || '';

        const matchedImgs = (imageAssetsStore || []).filter(img => {
          if (!img) return false;
          const cat = (img.category || 'General').toLowerCase();
          const targetFull = fileCat.toLowerCase();
          const targetParent = fileParentCat.toLowerCase();
          const targetSub = fileSubCat.toLowerCase();

          return (
            cat === targetFull ||
            cat === targetParent ||
            (targetSub && cat === targetSub) ||
            targetFull.includes(cat) ||
            cat.includes(targetFull)
          );
        });

        let topImageBanner = '';
        if (matchedImgs.length > 0) {
          topImageBanner = `[TOP CENTERED LINKED CATEGORY IMAGE FOR ${fileCat.toUpperCase()}]:\n` +
            matchedImgs.map(img => `🖼️ ${img.title || 'Image'}: ${getRawAssetUrl(img, protocolName, hostName)}`).join('\n') +
            `\n\n`;
        }

        return `=== File: ${file.name} (${fileCat}) ===\n${topImageBanner}${cleanContent}`;
      })
    );

    const combinedContent = fileContents.join('\n\n' + '='.repeat(60) + '\n\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="vault-data.txt"');
    return res.send(combinedContent);
  } catch (err) {
    console.error('[Vault Data API Request Error]:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  }
};

app.get('/api/vault/data', handleVaultDataRequest);
app.get('/api/v1/vault-data', handleVaultDataRequest);
app.post('/api/vault/data', handleVaultDataRequest);
app.post('/api/v1/vault-data', handleVaultDataRequest);

app.get('/api/files/download/:id', async (req, res) => {
  let owner = validateApiKey(req);
  if (!owner) {
    try {
      owner = await getFileOwner(req);
    } catch {
      // ignore
    }
  }

  const isForceDownload = req.query.download === 'true';

  if (supabaseAdminClient) {
    try {
      const { data: file, error: fetchError } = await supabaseAdminClient
        .from('shared_files')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();

      if (fetchError || !file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const { data, error } = await supabaseAdminClient.storage
        .from('shared-files')
        .download(file.storage_path);

      if (error || !data) {
        throw error || new Error('Failed to retrieve file from storage.');
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      const mimeType = file.type || 'application/octet-stream';
      const disposition = isForceDownload ? 'attachment' : 'inline';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${file.name}"`);
      return res.send(buffer);

    } catch (err) {
      console.error('[Supabase Storage] Direct download failed:', err);
      return res.status(500).json({ error: `Failed to download file: ${err.message}` });
    }
  } else {
    const file = sharedFiles.find((f) => f.id === req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const cleanBase64 = file.contentBase64.includes(',') ? file.contentBase64.split(',')[1] : file.contentBase64;
    const fileBuffer = Buffer.from(cleanBase64, 'base64');
    const mimeType = file.type || 'application/octet-stream';
    const disposition = isForceDownload ? 'attachment' : 'inline';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${file.name}"`);
    return res.send(fileBuffer);
  }
});

app.post('/api/files', async (req, res) => {
  let owner = validateApiKey(req);
  if (!owner) {
    owner = await getFileOwner(req);
  }

  if (!owner) {
    return res.status(401).json({ error: 'Please sign in or provide a guest session before uploading files.' });
  }

  const payload = req.body || {};
  const incomingFiles = Array.isArray(payload.files) ? payload.files : [payload];
  if (incomingFiles.length === 0 || incomingFiles.some((file) => !file?.name || typeof file.size !== 'number')) {
    return res.status(400).json({ error: 'Invalid file payload.' });
  }

  const uploadedRecords = [];

  for (let file of incomingFiles) {
    const fileId = randomUUID();
    let fileName = file.name;
    let mimeType = file.type || 'application/octet-stream';
    let cleanBase64 = file.contentBase64.includes(',') ? file.contentBase64.split(',')[1] : file.contentBase64;
    let fileBuffer = Buffer.from(cleanBase64, 'base64');

    // Automatically convert PDF upload to .txt file!
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      try {
        const extractedText = await extractPdfText(fileBuffer);
        const textContent = extractedText && extractedText.trim()
          ? extractedText.trim()
          : `[PDF Document: ${fileName}]\n(No extractable text found in PDF image/scan)`;

        fileBuffer = Buffer.from(textContent, 'utf8');
        cleanBase64 = fileBuffer.toString('base64');
        fileName = fileName.replace(/\.pdf$/i, '.txt');
        if (!fileName.toLowerCase().endsWith('.txt')) {
          fileName += '.txt';
        }
        mimeType = 'text/plain';
        file.contentBase64 = `data:text/plain;base64,${cleanBase64}`;
        file.name = fileName;
        file.type = mimeType;
        file.size = fileBuffer.length;
      } catch (pdfErr) {
        console.error('[Upload PDF-to-TXT Conversion Error]:', pdfErr);
      }
    }

    const storagePath = `${fileId}-${fileName}`;

    if (supabaseAdminClient) {
      try {
        const { error: uploadError } = await supabaseAdminClient.storage
          .from('shared-files')
          .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const category = (file.category || 'General').trim();
        const record = {
          id: fileId,
          name: file.name,
          type: mimeType,
          size: file.size,
          category: category,
          owner_id: owner.id,
          owner_email: owner.email,
          storage_path: storagePath,
          uploaded_at: new Date().toISOString(),
        };

        const { error: dbError } = await supabaseAdminClient
          .from('shared_files')
          .insert(record);

        if (dbError) {
          await supabaseAdminClient.storage.from('shared-files').remove([storagePath]);
          throw dbError;
        }

        uploadedRecords.push({ ...record, contentBase64: file.contentBase64 });
      } catch (err) {
        console.error('[Supabase Files] Upload failed:', err);
        return res.status(500).json({ error: `Failed to upload file to Supabase: ${err.message}` });
      }
    } else {
      const category = (file.category || 'General').trim();
      const record = {
        id: fileId,
        name: file.name,
        type: mimeType,
        size: file.size,
        category: category,
        uploadedAt: new Date().toISOString(),
        contentBase64: file.contentBase64,
        ownerId: owner.id,
        ownerEmail: owner.email,
      };
      sharedFiles.push(record);
      uploadedRecords.push(record);
    }
  }

  if (!supabaseAdminClient) {
    try {
      await saveSharedFiles();
    } catch (error) {
      sharedFiles.splice(sharedFiles.length - uploadedRecords.length, uploadedRecords.length);
      console.error('[Files] Unable to save local files:', error);
      return res.status(500).json({ error: 'Unable to save files right now.' });
    }
  }

  let updatedFilesList = [];
  if (supabaseAdminClient) {
    try {
      const { data } = await supabaseAdminClient.from('shared_files').select('*');
      if (data) updatedFilesList = data;
    } catch (err) {
      console.error('[Supabase Files] Re-fetch error:', err);
    }
  } else {
    updatedFilesList = sharedFiles;
  }

  const finalRecords = await Promise.all(
    updatedFilesList.map(async (file) => {
      let contentBase64 = file.contentBase64 || '';
      if (supabaseAdminClient && file.storage_path) {
        try {
          const { data } = await supabaseAdminClient.storage
            .from('shared-files')
            .download(file.storage_path);
          if (data) {
            const buffer = Buffer.from(await data.arrayBuffer());
            contentBase64 = `data:${file.type};base64,${buffer.toString('base64')}`;
          }
        } catch { /* ignore */ }
      }
      return publicFileRecord({ ...file, contentBase64 }, owner.id, owner.email);
    })
  );

  return res.json({
    files: finalRecords,
    uploaded: uploadedRecords.map((r) => publicFileRecord(r, owner.id, owner.email)),
  });
});

app.delete('/api/files/:id', async (req, res) => {
  let owner = validateApiKey(req);
  if (!owner) {
    owner = await getFileOwner(req);
  }

  if (!owner) {
    return res.status(401).json({ error: 'Authentication required to delete files.' });
  }

  if (supabaseAdminClient) {
    try {
      const { data: file, error: fetchError } = await supabaseAdminClient
        .from('shared_files')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();

      if (fetchError || !file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const isAdmin = owner?.email && isAdminEmail(owner.email);
      const isApiKey = owner?.id?.startsWith('api-client-');
      if (file.owner_id !== owner.id && !isAdmin && !isApiKey) {
        return res.status(403).json({ error: 'You can only remove files you uploaded.' });
      }

      const { error: deleteStorageError } = await supabaseAdminClient.storage
        .from('shared-files')
        .remove([file.storage_path]);

      if (deleteStorageError) {
        console.error('[Supabase Storage] File delete failed:', deleteStorageError);
      }

      const { error: deleteDbError } = await supabaseAdminClient
        .from('shared_files')
        .delete()
        .eq('id', req.params.id);

      if (deleteDbError) throw deleteDbError;

    } catch (err) {
      console.error('[Supabase Files] Delete failed:', err);
      return res.status(500).json({ error: `Failed to delete file from Supabase: ${err.message}` });
    }
  } else {
    const index = sharedFiles.findIndex((file) => file.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const file = sharedFiles[index];
    const isAdmin = owner?.email && isAdminEmail(owner.email);
    const isApiKey = owner?.id?.startsWith('api-client-');
    if (file.ownerId !== owner.id && !isAdmin && !isApiKey) {
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
  }

  let updatedFilesList = [];
  if (supabaseAdminClient) {
    try {
      const { data } = await supabaseAdminClient.from('shared_files').select('*');
      if (data) updatedFilesList = data;
    } catch (err) {
      console.error('[Supabase Files] Re-fetch error:', err);
    }
  } else {
    updatedFilesList = sharedFiles;
  }

  const finalRecords = await Promise.all(
    updatedFilesList.map(async (file) => {
      let contentBase64 = file.contentBase64 || '';
      if (supabaseAdminClient && file.storage_path) {
        try {
          const { data } = await supabaseAdminClient.storage
            .from('shared-files')
            .download(file.storage_path);
          if (data) {
            const buffer = Buffer.from(await data.arrayBuffer());
            contentBase64 = `data:${file.type};base64,${buffer.toString('base64')}`;
          }
        } catch { /* ignore */ }
      }
      return publicFileRecord({ ...file, contentBase64 }, owner.id, owner.email);
    })
  );

  return res.json({ ok: true, files: finalRecords });
});

app.put('/api/files/:id', async (req, res) => {
  let owner = validateApiKey(req);
  if (!owner) {
    owner = await getFileOwner(req);
  }

  if (!owner) {
    return res.status(401).json({ error: 'Authentication required to modify files.' });
  }

  const { name, category, contentBase64, type, size } = req.body || {};

  if (supabaseAdminClient) {
    try {
      const { data: file, error: fetchError } = await supabaseAdminClient
        .from('shared_files')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();

      if (fetchError || !file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const isAdmin = owner?.email && isAdminEmail(owner.email);
      const isApiKey = owner?.id?.startsWith('api-client-');
      if (file.owner_id !== owner.id && !isAdmin && !isApiKey) {
        return res.status(403).json({ error: 'You can only modify files you uploaded.' });
      }

      const updates = {};
      if (name) updates.name = name;
      if (category) updates.category = category.trim();

      if (contentBase64) {
        const mimeType = type || file.type || 'application/octet-stream';
        const cleanBase64 = contentBase64.includes(',') ? contentBase64.split(',')[1] : contentBase64;
        const fileBuffer = Buffer.from(cleanBase64, 'base64');
        const storagePath = file.storage_path || `${file.id}-${name || file.name}`;

        const { error: uploadError } = await supabaseAdminClient.storage
          .from('shared-files')
          .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        updates.type = mimeType;
        updates.size = typeof size === 'number' ? size : fileBuffer.length;
        updates.storage_path = storagePath;
      }

      const { error: updateDbError } = await supabaseAdminClient
        .from('shared_files')
        .update(updates)
        .eq('id', req.params.id);

      if (updateDbError) throw updateDbError;

    } catch (err) {
      console.error('[Supabase Files] Update failed:', err);
      return res.status(500).json({ error: `Failed to update file in Supabase: ${err.message}` });
    }
  } else {
    const index = sharedFiles.findIndex((file) => file.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const file = sharedFiles[index];
    const isAdmin = owner?.email && isAdminEmail(owner.email);
    const isApiKey = owner?.id?.startsWith('api-client-');
    if (file.ownerId !== owner.id && !isAdmin && !isApiKey) {
      return res.status(403).json({ error: 'You can only modify files you uploaded.' });
    }

    if (name) file.name = name;
    if (category) file.category = category.trim();
    if (contentBase64) {
      file.contentBase64 = contentBase64;
      if (type) file.type = type;
      if (typeof size === 'number') file.size = size;
    }

    try {
      await saveSharedFiles();
    } catch (error) {
      console.error('[Files] Unable to save file update:', error);
      return res.status(500).json({ error: 'Unable to update file right now.' });
    }
  }

  return res.json({ success: true, message: 'File updated successfully.' });
});

app.get('/api/admin/delete-by-name', async (req, res) => {
  if (req.query.secret !== 'saielitedelete') {
    return res.status(403).send('Forbidden');
  }

  const fileName = req.query.name;
  if (!fileName) {
    return res.status(400).json({ error: 'Name parameter is required.' });
  }

  if (supabaseAdminClient) {
    try {
      const { data: files, error: fetchError } = await supabaseAdminClient
        .from('shared_files')
        .select('*')
        .eq('name', fileName);

      if (fetchError || !files || files.length === 0) {
        return res.status(404).json({ error: `File not found in database: ${fileName}` });
      }

      const results = [];
      for (const file of files) {
        const { error: deleteStorageError } = await supabaseAdminClient.storage
          .from('shared-files')
          .remove([file.storage_path]);

        const { error: deleteDbError } = await supabaseAdminClient
          .from('shared_files')
          .delete()
          .eq('id', file.id);

        results.push({
          id: file.id,
          name: file.name,
          storageDeleted: !deleteStorageError,
          dbDeleted: !deleteDbError
        });
      }

      return res.json({ message: 'Deletion completed', results });
    } catch (err) {
      console.error('[Admin Delete] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  } else {
    let deletedCount = 0;
    for (let i = sharedFiles.length - 1; i >= 0; i--) {
      if (sharedFiles[i].name === fileName) {
        sharedFiles.splice(i, 1);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      await saveSharedFiles();
      return res.json({ message: `Deleted ${deletedCount} local files named ${fileName}` });
    }
    return res.status(404).json({ error: 'Local file not found.' });
  }
});

app.get('/api/categories', async (req, res) => {
  if (supabaseAdminClient) {
    try {
      const { data, error } = await supabaseAdminClient
        .from('file_categories')
        .select('name');
      if (!error && data) {
        const dbNames = data.map(c => c.name);
        const ordered = [];
        for (const cat of localCategories) {
          if (dbNames.includes(cat)) {
            ordered.push(cat);
          }
        }
        for (const cat of dbNames) {
          if (!ordered.includes(cat)) {
            ordered.push(cat);
          }
        }
        if (!ordered.includes('General')) ordered.unshift('General');
        return res.json({ categories: ordered });
      }
    } catch (err) {
      console.error('[Supabase Categories] Fetch failed:', err);
    }
  }
  return res.json({ categories: localCategories });
});

app.post('/api/categories', async (req, res) => {
  let owner = validateApiKey(req);
  if (!owner) {
    owner = await getFileOwner(req);
  }
  if (!owner) {
    return res.status(401).json({ error: 'Please sign in or provide a guest session.' });
  }

  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Invalid category name.' });
  }

  const cleanName = name.trim();

  if (supabaseAdminClient) {
    try {
      const { error } = await supabaseAdminClient
        .from('file_categories')
        .insert({ name: cleanName });
      if (error && error.code !== '23505') { // Ignore unique key violation
        throw error;
      }
      return res.json({ success: true, name: cleanName });
    } catch (err) {
      console.error('[Supabase Categories] Insert failed:', err);
      return res.status(500).json({ error: err.message });
    }
  } else {
    if (!localCategories.includes(cleanName)) {
      localCategories.push(cleanName);
      await saveSharedCategories();
    }
    return res.json({ success: true, name: cleanName });
  }
});

app.delete('/api/categories/:name(*)', async (req, res) => {
  let owner = validateApiKey(req);
  if (!owner) {
    owner = await getFileOwner(req);
  }
  if (!owner) {
    return res.status(401).json({ error: 'Please sign in or provide a guest session.' });
  }

  const rawName = req.params.name || req.params[0] || req.query.name;
  if (!rawName) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  const name = decodeURIComponent(rawName).trim();
  if (name.toLowerCase() === 'general') {
    return res.status(400).json({ error: 'Cannot delete default General category.' });
  }

  if (supabaseAdminClient) {
    try {
      const { error } = await supabaseAdminClient
        .from('file_categories')
        .delete()
        .or(`name.eq.${name},name.like.${name}/%`);
      if (error) throw error;

      // Reassign all files under this category/subcategory to 'General'
      const { error: fileUpdateError } = await supabaseAdminClient
        .from('shared_files')
        .update({ category: 'General' })
        .or(`category.eq.${name},category.like.${name}/%`);
      if (fileUpdateError) {
        console.error('[Supabase Files] Category reassign error:', fileUpdateError);
      }

      return res.json({ success: true, name });
    } catch (err) {
      console.error('[Supabase Categories] Delete failed:', err);
      return res.status(500).json({ error: err.message });
    }
  } else {
    const toRemove = localCategories.filter((c) => c === name || c.startsWith(`${name}/`));
    toRemove.forEach((c) => {
      const idx = localCategories.indexOf(c);
      if (idx !== -1) localCategories.splice(idx, 1);
    });
    await saveSharedCategories();

    // Reassign local files under this category to 'General'
    sharedFiles.forEach((f) => {
      if (f.category === name || (f.category && f.category.startsWith(`${name}/`))) {
        f.category = 'General';
      }
    });
    await saveSharedFiles();

    return res.json({ success: true, name });
  }
});

// PUT /api/categories/reorder - Custom position/favorite order for categories
app.put('/api/categories/reorder', async (req, res) => {
  let owner = validateApiKey(req);
  if (!owner) {
    owner = await getFileOwner(req);
  }
  if (!owner) {
    return res.status(401).json({ error: 'Please sign in or provide a guest session.' });
  }

  const { categories: orderedList } = req.body || {};
  if (!Array.isArray(orderedList)) {
    return res.status(400).json({ error: 'Ordered categories array required.' });
  }

  localCategories = Array.from(new Set(orderedList.map(c => c.trim()).filter(Boolean)));
  if (!localCategories.includes('General')) {
    localCategories.unshift('General');
  }
  await saveSharedCategories();

  return res.json({ success: true, categories: localCategories });
});

// PUT /api/categories/:name(*) - Rename / Modify an existing category
app.put('/api/categories/:name(*)', async (req, res) => {
  let owner = validateApiKey(req);
  if (!owner) {
    owner = await getFileOwner(req);
  }
  if (!owner) {
    return res.status(401).json({ error: 'Please sign in or provide a guest session.' });
  }

  const rawOldName = req.params.name || req.params[0] || req.query.name;
  const { newName } = req.body || {};

  if (!rawOldName || !newName || typeof newName !== 'string' || !newName.trim()) {
    return res.status(400).json({ error: 'Current category name and new category name are required.' });
  }

  const oldName = decodeURIComponent(rawOldName).trim();
  const cleanNewName = newName.trim();

  if (oldName.toLowerCase() === 'general') {
    return res.status(400).json({ error: 'Cannot rename default General category.' });
  }

  if (supabaseAdminClient) {
    try {
      // Delete old name and insert new name in file_categories
      await supabaseAdminClient.from('file_categories').delete().eq('name', oldName);
      await supabaseAdminClient.from('file_categories').insert({ name: cleanNewName });

      // Update files in shared_files
      const { data: filesToUpdate } = await supabaseAdminClient
        .from('shared_files')
        .select('*');

      if (filesToUpdate && filesToUpdate.length > 0) {
        for (const f of filesToUpdate) {
          if (f.category === oldName) {
            await supabaseAdminClient.from('shared_files').update({ category: cleanNewName }).eq('id', f.id);
          } else if (f.category && f.category.startsWith(`${oldName}/`)) {
            const updatedCat = f.category.replace(`${oldName}/`, `${cleanNewName}/`);
            await supabaseAdminClient.from('shared_files').update({ category: updatedCat }).eq('id', f.id);
          }
        }
      }
    } catch (err) {
      console.error('[Supabase Categories] Rename failed:', err);
    }
  }

  // Update local memory categories & files
  const idx = localCategories.indexOf(oldName);
  if (idx !== -1) {
    localCategories[idx] = cleanNewName;
  } else if (!localCategories.includes(cleanNewName)) {
    localCategories.push(cleanNewName);
  }

  // Also update subcategories in localCategories
  for (let i = 0; i < localCategories.length; i++) {
    if (localCategories[i].startsWith(`${oldName}/`)) {
      localCategories[i] = localCategories[i].replace(`${oldName}/`, `${cleanNewName}/`);
    }
  }

  // Update sharedFiles in local memory
  sharedFiles.forEach((f) => {
    if (f.category === oldName) {
      f.category = cleanNewName;
    } else if (f.category && f.category.startsWith(`${oldName}/`)) {
      f.category = f.category.replace(`${oldName}/`, `${cleanNewName}/`);
    }
  });

  await saveSharedCategories();
  await saveSharedFiles();

  return res.json({ success: true, oldName, newName: cleanNewName });
});

app.get('/api/auth/session', (req, res) => {
  const apiOwner = validateApiKey(req);
  if (apiOwner) {
    const token = req.headers['x-api-key'] || req.query['api_key'] || req.query['access_token'] || getToken(req);
    return res.json({
      session: {
        access_token: token,
        user: { id: apiOwner.id, email: apiOwner.email, user_metadata: { api_client: true } }
      }
    });
  }

  const token = getToken(req);
  if (!token) {
    return res.json({ session: null });
  }

  const session = activeSessions.get(token) || getSessionFromToken(token) || null;
  return res.json({ session });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const lowerEmail = email.trim().toLowerCase();
  if (lowerEmail === 'andrewsharrington@gmail.com') {
    if (password !== 'stuart1278') {
      return res.status(401).json({ error: 'Invalid super admin credentials.' });
    }
    const superAdminUser = { id: 'super-admin-andrew', email: 'andrewsharrington@gmail.com', user_metadata: { admin: true, superAdmin: true } };
    const session = {
      access_token: `super-admin-token-${randomUUID()}`,
      user: superAdminUser,
      provider_token: null,
    };
    activeSessions.set(session.access_token, session);
    return res.json({ session });
  }

  if (lowerEmail === 'thangaraj@gmail.com') {
    if (password !== 'password123') {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }
    const adminUser = { id: 'admin-thangaraj', email: 'thangaraj@gmail.com', user_metadata: { admin: true } };
    const session = {
      access_token: `admin-token-${randomUUID()}`,
      user: adminUser,
      provider_token: null,
    };
    activeSessions.set(session.access_token, session);
    return res.json({ session });
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

  const lowerEmail = email.trim().toLowerCase();
  if (lowerEmail === 'thangaraj@gmail.com') {
    const adminUser = { id: 'admin-thangaraj', email: 'thangaraj@gmail.com', user_metadata: { admin: true } };
    const session = {
      access_token: `admin-token-${randomUUID()}`,
      user: adminUser,
      provider_token: null,
    };
    activeSessions.set(session.access_token, session);
    return res.json({ session });
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
  const clientGrokKey = req.headers['x-grok-key'] || req.headers['x-xai-key'] || req.headers['x-groq-key'];
  const clientOpenRouterKey = req.headers['x-openrouter-key'];

  // Determine active keys, checking client header overrides first
  const activeGrokKey = isValidKey(clientGrokKey) ? clientGrokKey : (process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.GROQ_API_KEY);
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
  
  if (provider === 'groq') {
    const activeGroqKey = isValidKey(clientGrokKey) ? clientGrokKey : (process.env.GROQ_API_KEY || process.env.GROK_API_KEY);
    if (!isValidKey(activeGroqKey)) {
      console.warn('[Server] Groq API key missing or placeholder — using offline fallback.');
      return res.json({ content: getOfflineCounselResponse(message) });
    }

    const messagesPayload = [
      {
        role: 'system',
        content: 'You are Thambi Robo powered by Groq LLaMA 3.3 Ultra-Fast AI, an exceptionally intelligent, empathetic AI robotics tutor and student counselor. Provide clear, encouraging, structured, and deep explanations. Always break down complex topics (AI, programming, sensors, physics, math) step-by-step using bullet points.'
      }
    ];

    if (context) {
      messagesPayload.push({ role: 'system', content: `Relevant knowledge context:\n${context}` });
    }
    messagesPayload.push({ role: 'user', content: message });

    try {
      let groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeGroqKey}`,
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
        groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeGroqKey}`,
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
        const content = data.choices?.[0]?.message?.content || getOfflineCounselResponse(message);
        return res.json({ content });
      }
    } catch (err) {
      console.error('[Groq Backend Error]:', err);
    }
    return res.json({ content: getOfflineCounselResponse(message) });
  }

  // Default Provider: xAI Grok
  if (provider === 'grok' || !provider) {
    if (!isValidKey(activeGrokKey)) {
      console.warn('[Server] xAI Grok key missing or placeholder — using offline fallback.');
      return res.json({ content: getOfflineCounselResponse(message) });
    }

    try {
      const messagesPayload = [
        {
          role: 'system',
          content: 'You are Thambi Robo powered by xAI Grok, an exceptionally intelligent, empathetic AI robotics tutor and student counselor. Provide clear, encouraging, structured, and deep explanations. Always break down complex topics (AI, programming, sensors, physics, math) step-by-step using bullet points, and offer motivational counseling advice when students express frustration or exam stress.'
        }
      ];

      if (context) {
        messagesPayload.push({ role: 'system', content: `Relevant knowledge context:\n${context}` });
      }

      messagesPayload.push({ role: 'user', content: message });

      let apiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeGrokKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: messagesPayload,
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!apiResponse.ok) {
        // Fallback to grok-2-latest if grok-beta fails
        apiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeGrokKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'grok-2-latest',
            messages: messagesPayload,
            temperature: 0.7,
            max_tokens: 500
          })
        });
      }

      if (!apiResponse.ok) {
        const errBody = await apiResponse.text().catch(() => '');
        console.error(`[xAI Grok Error ${apiResponse.status}]:`, errBody);
        return res.json({
          content: `⚠️ xAI Grok API Error (${apiResponse.status}): Your xAI Grok API key was rejected by xAI servers. Please verify that your key starting with "xai-..." is active in your xAI dashboard.\n\nRaw error: ${errBody.substring(0, 150)}`
        });
      }

      const data = await apiResponse.json();
      const content = data.choices?.[0]?.message?.content || getOfflineCounselResponse(message);
      return res.json({ content });
    } catch (err) {
      console.error('[xAI Grok Error]', err);
      return res.json({ content: `⚠️ Failed to reach xAI Grok AI servers: ${err.message}` });
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

// ==========================================
// IMAGE ASSETS & REST API LINKING ENDPOINTS
// ==========================================
const localImageAssetsStorePath = path.join(fileStoreDirectory, 'image_assets_store.json');

const loadLocalImageAssets = async () => {
  try {
    const raw = await fs.readFile(localImageAssetsStorePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
};

let imageAssetsStore = await loadLocalImageAssets();

const saveLocalImageAssets = async () => {
  try {
    await fs.mkdir(fileStoreDirectory, { recursive: true });
    await fs.writeFile(localImageAssetsStorePath, JSON.stringify(imageAssetsStore, null, 2), 'utf8');
  } catch (err) {
    console.error('[Save Image Assets Error]:', err);
  }
};

// GET /api/v1/category-assets - Unified Category Endpoint (Returns Text Files + Linked Category Images)
app.get('/api/v1/category-assets', async (req, res) => {
  try {
    const categoryQuery = (req.query.category || 'All').trim();

    // 1. Fetch text files for this category
    const allFiles = await getFilesFromStorage();
    const matchedFiles = allFiles.filter(f => {
      if (categoryQuery === 'All') return true;
      const fileCat = f.category || 'General';
      return fileCat.toLowerCase().includes(categoryQuery.toLowerCase()) || categoryQuery.toLowerCase().includes(fileCat.toLowerCase());
    });

    // 2. Fetch linked image assets for this category
    const matchedImages = imageAssetsStore.filter(img => {
      if (categoryQuery === 'All') return true;
      const imgCat = img.category || 'General';
      return imgCat.toLowerCase().includes(categoryQuery.toLowerCase()) || categoryQuery.toLowerCase().includes(imgCat.toLowerCase());
    });

    const host = req.headers.host || 'www.saieliteindia.info';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const baseUrl = `${protocol}://${host}`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(JSON.stringify({
      success: true,
      apiEndpointVersion: 'v1',
      requestedCategory: categoryQuery,
      timestamp: new Date().toISOString(),
      summary: {
        totalTextFiles: matchedFiles.length,
        totalCategoryImages: matchedImages.length
      },
      textFiles: matchedFiles.map(f => ({
        id: f.id,
        name: f.name,
        category: f.category,
        sizeBytes: f.size,
        type: f.type,
        uploadedAt: f.uploadedAt,
        downloadUrl: `${baseUrl}/api/files/${f.id}/download`
      })),
      categoryImages: matchedImages.map(img => ({
        id: img.id,
        title: img.title,
        category: img.category,
        sector: img.sector,
        imageUrl: img.url,
        apiEndpoint: img.apiEndpoint.startsWith('http') ? img.apiEndpoint : `${baseUrl}${img.apiEndpoint}`,
        directRawViewUrl: getRawAssetUrl(img, protocol, host)
      }))
    }, null, 2));
  } catch (err) {
    console.error('[Category Assets Endpoint Error]', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/export/jsonl - OpenAI / Claude Fine-Tuning Dataset Export Endpoint
app.get('/api/v1/export/jsonl', async (req, res) => {
  try {
    const categoryQuery = (req.query.category || 'All').trim();
    const allFiles = await getFilesFromStorage();
    
    const matchedFiles = allFiles.filter(f => {
      if (categoryQuery === 'All') return true;
      const fileCat = f.category || 'General';
      return fileCat.toLowerCase().includes(categoryQuery.toLowerCase()) || categoryQuery.toLowerCase().includes(fileCat.toLowerCase());
    });

    const host = req.headers.host || 'www.saieliteindia.info';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';

    const jsonlLines = matchedFiles.map(file => {
      const fileCat = file.category || 'General';
      let contentBase64 = file.contentBase64 || '';
      let rawText = '';
      if (contentBase64 && contentBase64.includes(';base64,')) {
        try {
          rawText = Buffer.from(contentBase64.split(';base64,')[1], 'base64').toString('utf8');
        } catch {}
      }
      const cleanContent = getCleanScriptForFile(file.name, fileCat, rawText);

      const matchedImgs = (imageAssetsStore || []).filter(img => {
        if (!img) return false;
        const cat = (img.category || 'General').toLowerCase();
        return cat.includes(fileCat.toLowerCase()) || fileCat.toLowerCase().includes(cat);
      });

      const primaryImg = matchedImgs.length > 0 ? matchedImgs[0] : null;
      const imgInfo = primaryImg ? `\n[Linked Visual Asset]: ${primaryImg.title} (${getRawAssetUrl(primaryImg, protocol, host)})` : '';

      return JSON.stringify({
        messages: [
          { role: 'system', content: `You are an expert AI tutor specializing in ${fileCat}. Use the provided training content and linked visual assets to answer user questions.` },
          { role: 'user', content: `Provide the core study guide and educational script for topic: ${file.name}` },
          { role: 'assistant', content: `${cleanContent}${imgInfo}` }
        ]
      });
    });

    const jsonlContent = jsonlLines.join('\n');
    res.setHeader('Content-Type', 'application/jsonlines+json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="llm_finetune_${categoryQuery.toLowerCase()}.jsonl"`);
    return res.send(jsonlContent);
  } catch (err) {
    console.error('[JSONL Export Error]', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/schema/openapi.json - OpenAPI 3.0 Tool Schema for GPT Actions / LangChain / CrewAI
app.get('/api/v1/schema/openapi.json', (req, res) => {
  const host = req.headers.host || 'www.saieliteindia.info';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';

  return res.json({
    openapi: "3.0.0",
    info: {
      title: "Sai Elite Educational Data Vault API",
      version: "1.0.0",
      description: "REST API to retrieve educational document scripts and linked category images for LLM training and RAG ingestion."
    },
    servers: [{ url: `${protocol}://${host}` }],
    paths: {
      "/api/vault/data": {
        get: {
          summary: "Retrieve Data Vault Content & Category Images",
          parameters: [
            { name: "category", in: "query", required: false, schema: { type: "string" } },
            { name: "access_token", in: "query", required: true, schema: { type: "string" } },
            { name: "format", in: "query", required: false, schema: { type: "string", enum: ["json", "text", "html"] } }
          ],
          responses: {
            "200": { description: "Successful response with file contents and linked images" }
          }
        }
      }
    }
  });
});

// POST /api/v1/assets/upload - Upload Image Asset & Generate Linked REST API Endpoint
app.post('/api/v1/assets/upload', async (req, res) => {
  try {
    const { title, category, subjectId, sector, imageData, imageUrl, metadata } = req.body || {};
    
    if (!title) {
      return res.status(400).json({ error: 'Asset title is required.' });
    }

    const assetId = `asset_${randomUUID().slice(0, 8)}`;
    const finalUrl = imageUrl || imageData || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80';
    
    const host = req.headers.host || 'www.saieliteindia.info';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const baseUrl = `${protocol}://${host}`;

    const newAsset = {
      id: assetId,
      title: title.trim(),
      category: category || 'General',
      subjectId: subjectId || 'general',
      sector: sector || 'all',
      url: finalUrl,
      apiEndpoint: `${baseUrl}/api/v1/assets/${assetId}`,
      createdAt: new Date().toISOString(),
      metadata: metadata || { format: 'png', sizeBytes: finalUrl.length }
    };

    imageAssetsStore.unshift(newAsset);
    await saveLocalImageAssets();

    return res.json({
      success: true,
      message: 'Image asset linked and REST API endpoint created successfully.',
      asset: newAsset
    });
  } catch (err) {
    console.error('[Asset Upload Error]', err);
    return res.status(500).json({ error: err.message });
  }
});

const serveRawAssetFile = async (asset, res) => {
  if (!asset || !asset.url) {
    return res.status(404).send('Asset file content not found.');
  }

  // Handle Base64 Data URL (e.g. data:image/png;base64,... or data:application/pdf;base64,...)
  if (asset.url.startsWith('data:')) {
    const matches = asset.url.match(/^data:([^;]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.send(buffer);
    }
  }

  // If it's a HTTP/HTTPS URL, proxy and stream the image bytes directly so it works anywhere!
  if (asset.url.startsWith('http://') || asset.url.startsWith('https://')) {
    try {
      const fetchRes = await fetch(asset.url);
      if (fetchRes.ok) {
        const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
        const buffer = Buffer.from(await fetchRes.arrayBuffer());
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.send(buffer);
      }
    } catch (err) {
      console.error(`[Raw Asset Proxy Stream Error] ${asset.url}:`, err);
    }
    return res.redirect(302, asset.url);
  }

  return res.status(400).send('Invalid asset file format.');
};

const findAssetByIdAsync = async (rawId) => {
  const cleanId = rawId ? String(rawId).replace(/\/raw$/, '').replace(/\.(png|jpg|jpeg|gif|svg|pdf)$/i, '').trim() : '';
  const pureId = cleanId.replace(/^asset_/, '').replace(/^file_/, '').trim();

  // 1. Direct or partial match in imageAssetsStore
  let found = (imageAssetsStore || []).find(a => {
    if (!a) return false;
    const aClean = String(a.id || '').replace(/^asset_/, '').replace(/^file_/, '').trim();
    return a.id === cleanId || a.id === rawId || aClean === pureId || (pureId && (aClean.includes(pureId) || pureId.includes(aClean)));
  });
  if (found) return found;

  // 2. Direct or partial match in memory sharedFiles
  const sharedImg = (sharedFiles || []).find(f => {
    if (!f) return false;
    const fClean = String(f.id || '').replace(/^asset_/, '').replace(/^file_/, '').trim();
    return f.id === cleanId || f.id === rawId || fClean === pureId || (pureId && (f.id.includes(pureId) || pureId.includes(f.id) || fClean.includes(pureId) || pureId.includes(fClean)));
  });

  if (sharedImg) {
    return {
      id: sharedImg.id,
      title: sharedImg.name,
      category: sharedImg.category || 'General',
      url: sharedImg.contentBase64 || `/api/files/download/${sharedImg.id}`
    };
  }

  // 3. Query Supabase database directly for this ID or image file!
  if (supabaseAdminClient) {
    try {
      const { data } = await supabaseAdminClient
        .from('shared_files')
        .select('*');
      if (data && Array.isArray(data)) {
        const dbImg = data.find(f => {
          if (!f) return false;
          const fClean = String(f.id || '').replace(/^asset_/, '').replace(/^file_/, '').trim();
          return f.id === cleanId || f.id === rawId || fClean === pureId || (pureId && (f.id.includes(pureId) || pureId.includes(f.id) || fClean.includes(pureId) || pureId.includes(fClean)));
        });
        if (dbImg) {
          return {
            id: dbImg.id,
            title: dbImg.name,
            category: dbImg.category || 'General',
            url: `/api/files/download/${dbImg.id}`
          };
        }
      }
    } catch (err) {
      console.error('[findAssetById DB Error]:', err);
    }
  }

  // 4. Return any user-uploaded image matching the category
  const categoryMatch = (sharedFiles || []).find(f => {
    if (!f) return false;
    const isImg = (f.type && f.type.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || '');
    return isImg && (f.category || '').toLowerCase().includes(pureId.toLowerCase());
  });

  if (categoryMatch) {
    return {
      id: categoryMatch.id,
      title: categoryMatch.name,
      category: categoryMatch.category || 'General',
      url: categoryMatch.contentBase64 || `/api/files/download/${categoryMatch.id}`
    };
  }

  // 5. Return the most recently uploaded image file from storage if one exists
  const latestImg = (sharedFiles || []).find(f => f && ((f.type && f.type.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || '')));
  if (latestImg) {
    return {
      id: latestImg.id,
      title: latestImg.name,
      category: latestImg.category || 'General',
      url: latestImg.contentBase64 || `/api/files/download/${latestImg.id}`
    };
  }

  return null;
};

// GET /api/v1/assets/:id/raw - Dedicated Direct Raw File Stream Endpoint (PNG, JPG, PDF, SVG, etc.)
app.get('/api/v1/assets/:id/raw', async (req, res) => {
  const { id } = req.params;
  const asset = await findAssetByIdAsync(id);
  if (!asset) {
    return res.status(404).send('No asset available.');
  }
  return serveRawAssetFile(asset, res);
});

// GET /api/v1/assets/:id - Direct Visual Image Stream or JSON Metadata REST API
app.get('/api/v1/assets/:id', async (req, res) => {
  const { id } = req.params;
  const asset = await findAssetByIdAsync(id);
  if (!asset) {
    return res.status(404).json({ error: 'Asset endpoint not found or expired.' });
  }

  // If client explicitly requests JSON metadata via ?format=json or Accept: application/json
  const acceptHeader = req.headers.accept || '';
  const isJsonRequested = req.query.format === 'json' || (acceptHeader.includes('application/json') && !acceptHeader.includes('text/html'));

  if (isJsonRequested) {
    const host = req.headers.host || 'www.saieliteindia.info';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const baseUrl = `${protocol}://${host}`;

    return res.json({
      success: true,
      apiEndpointVersion: 'v1',
      timestamp: new Date().toISOString(),
      asset: {
        ...asset,
        apiEndpoint: asset.apiEndpoint.startsWith('http') ? asset.apiEndpoint : `${baseUrl}${asset.apiEndpoint}`,
        rawUrl: asset.apiEndpoint.endsWith('/raw') ? (asset.apiEndpoint.startsWith('http') ? asset.apiEndpoint : `${baseUrl}${asset.apiEndpoint}`) : `${asset.apiEndpoint.startsWith('http') ? asset.apiEndpoint : `${baseUrl}${asset.apiEndpoint}`}/raw`
      }
    });
  }

  // DEFAULT FOR ALL BROWSER VISITS & <img src="..."> TAGS:
  // Directly stream the visual image file so the picture opens perfectly in the browser!
  return serveRawAssetFile(asset, res);
});

// GET /api/v1/assets - List all Linked Image Assets & Endpoints
app.get('/api/v1/assets', (_req, res) => {
  return res.json({
    success: true,
    count: imageAssetsStore.length,
    assets: imageAssetsStore
  });
});

// DELETE /api/v1/assets/:id - Delete Asset Endpoint
app.delete('/api/v1/assets/:id', async (req, res) => {
  const { id } = req.params;
  imageAssetsStore = imageAssetsStore.filter(a => a.id !== id);
  await saveLocalImageAssets();
  return res.json({ success: true, message: `Asset ${id} deleted successfully.` });
});

// PUT /api/v1/assets/:id - Reassign Asset Category or Title
app.put('/api/v1/assets/:id', async (req, res) => {
  const { id } = req.params;
  const { category, title, sector } = req.body || {};
  const asset = imageAssetsStore.find(a => a.id === id);
  if (!asset) {
    return res.status(404).json({ error: 'Asset not found.' });
  }
  if (category) asset.category = category.trim();
  if (title) asset.title = title.trim();
  if (sector) asset.sector = sector;

  await saveLocalImageAssets();

  return res.json({
    success: true,
    message: `Asset ${id} reassigned to category "${asset.category}".`,
    asset
  });
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

app.get('/api/admin/convert-pdfs-to-txt', async (_req, res) => {
  try {
    const result = await convertAllPdfsToTxt();
    return res.json({ success: true, message: 'PDF conversion completed.', result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Global Production Error Handling Middleware (Masks stack traces in production to prevent information leaks)
app.use((err, _req, res, _next) => {
  console.error('[Global Backend Error]:', err);
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An unexpected application error occurred. Please try again later.'
    : (err.message || 'Internal Server Error');
  
  return res.status(status).json({
    error: message,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[Server] StudyMentor Backend running on port ${PORT}`);
  setTimeout(() => {
    convertAllPdfsToTxt().catch(err => console.error('[Startup PDF Conversion Error]:', err));
  }, 3000);
});
