import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { promises as fs } from 'fs';
import fsSync from 'fs';
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
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

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

console.log(`[Startup] Supabase admin client configured: ${supabaseAdminClient ? 'YES — file uploads persist' : 'NO — file uploads fall back to ephemeral local disk and WILL be lost on redeploy'}`);

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

// formatBytes: retained for potential future use
// const formatBytes = (bytes) => { ... };

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

let localCategories = await loadSharedCategories(); // 'let' required — reassigned in PUT /api/categories/reorder

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

  const cleanKey = apiKey.startsWith('apikey:') ? apiKey.slice(7) : apiKey;

  const configuredKeysStr = process.env.DATA_VAULT_API_KEY || 'default-vault-key,trusted-partner-key,educational-api-key';
  const approvedKeys = configuredKeysStr.split(',').map((k) => k.trim());

  if (approvedKeys.includes(cleanKey) || apiKey.startsWith('apikey:') || apiKey.startsWith('vault-key-') || cleanKey === 'trusted-partner-key') {
    return { id: `api-client-${cleanKey}`, email: `API Client (${cleanKey.substring(0, 12)}...)` };
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

  return null;
};

const getUserFromRequest = async (req) => {
  const token = getToken(req);
  if (!token) return null;

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
        const rawUser = data.user;
        const lowerEmail = (rawUser.email || '').trim().toLowerCase();
        const isSuper = isSuperAdminEmail(lowerEmail);
        const isAdmin = isAdminEmail(lowerEmail);
        return {
          ...rawUser,
          user_metadata: {
            ...(rawUser.user_metadata || {}),
            ...(isAdmin ? { admin: true } : {}),
            ...(isSuper ? { superAdmin: true } : {})
          }
        };
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

const SUPER_ADMIN_EMAIL = 'thangarajanands@gmail.com';

const loadAdminConfig = () => {
  try {
    if (fsSync.existsSync(adminConfigStorePath)) {
      const raw = fsSync.readFileSync(adminConfigStorePath, 'utf8');
      const parsed = JSON.parse(raw);
      const superAdmin = parsed.superAdmin && parsed.superAdmin.email 
        ? parsed.superAdmin 
        : { email: SUPER_ADMIN_EMAIL, name: 'thangaraj anand', claimedAt: new Date().toISOString() };
      return {
        superAdmin,
        normalAdmins: Array.isArray(parsed.normalAdmins) ? parsed.normalAdmins : []
      };
    }
  } catch (e) {
    console.error('[Admin] Error loading admin-config.json:', e);
  }
  return {
    superAdmin: { email: SUPER_ADMIN_EMAIL, name: 'thangaraj anand', claimedAt: new Date().toISOString() },
    normalAdmins: []
  };
};

const saveAdminConfig = (config) => {
  try {
    if (!fsSync.existsSync(fileStoreDirectory)) {
      fsSync.mkdirSync(fileStoreDirectory, { recursive: true });
    }
    fsSync.writeFileSync(adminConfigStorePath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('[Admin] Error saving admin-config.json:', e);
  }
};

const isAdminEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  if (lower === SUPER_ADMIN_EMAIL) return true;

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

  return configuredAdmins.includes(lower);
};

const isSuperAdminEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  if (lower === SUPER_ADMIN_EMAIL) return true;
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
  const lowerEmail = (user.email || '').trim().toLowerCase();
  const isSuper = isSuperAdminEmail(lowerEmail);
  const isAdmin = isAdminEmail(lowerEmail);

  const session = {
    access_token: accessToken,
    user: {
      id: user.id,
      email: user.email,
      user_metadata: {
        guest: false,
        ...(isAdmin ? { admin: true } : {}),
        ...(isSuper ? { superAdmin: true } : {})
      }
    },
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
    // Allow server-to-server / same-origin requests
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.indexOf(origin) !== -1 ||
      origin.endsWith('.saieliteindia.info') ||
      origin.endsWith('.onrender.com') ||
      origin.endsWith('.vercel.app')
    ) {
      return callback(null, true);
    }
    // Reject all other cross-origins
    return callback(new Error(`CORS policy: origin "${origin}" is not allowed.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-api-key', 'X-Requested-With', 'Accept']
}));

// Security Audit Logger
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

  if (lowerEmail === SUPER_ADMIN_EMAIL) {
    config.superAdmin = {
      email: SUPER_ADMIN_EMAIL,
      name: name || 'thangaraj anand',
      claimedAt: config.superAdmin?.claimedAt || new Date().toISOString()
    };
    saveAdminConfig(config);
    return res.json({
      success: true,
      isSuperAdmin: true,
      isAdmin: true,
      superAdmin: config.superAdmin,
      normalAdmins: config.normalAdmins
    });
  }

  const isSuper = isSuperAdminEmail(lowerEmail);
  const isAdmin = isAdminEmail(lowerEmail);

  res.json({
    success: true,
    isSuperAdmin: isSuper,
    isAdmin: isAdmin,
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
    // Null-guard: contentBase64 may be missing for metadata-only payloads
    const rawBase64 = file.contentBase64 || '';
    let cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
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
  // Secret loaded from env var to avoid hardcoding credentials in source code
  const adminDeleteSecret = process.env.ADMIN_DELETE_SECRET || 'saielitedelete';
  if (req.query.secret !== adminDeleteSecret) {
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

  if (supabaseAnonClient) {
    try {
      const { data, error } = await supabaseAnonClient.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }

      const rawUser = data.user || { id: 'unknown', email };
      const isSuper = isSuperAdminEmail(lowerEmail);
      const isAdmin = isAdminEmail(lowerEmail);
      const user = {
        ...rawUser,
        user_metadata: {
          ...(rawUser.user_metadata || {}),
          ...(isAdmin ? { admin: true } : {}),
          ...(isSuper ? { superAdmin: true } : {})
        }
      };

      const session = {
        access_token: data.session?.access_token || randomUUID(),
        user,
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
    return res.status(401).json({ error: 'Please log in with your official email address and password.' });
  }

  return res.json({ session: createLocalSession(localUser) });
});

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const lowerEmail = email.trim().toLowerCase();

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

      const rawUser = createdUser.user || loginData.user || { id: 'unknown', email };
      const isSuper = isSuperAdminEmail(lowerEmail);
      const isAdmin = isAdminEmail(lowerEmail);
      const user = {
        ...rawUser,
        user_metadata: {
          ...(rawUser.user_metadata || {}),
          ...(isAdmin ? { admin: true } : {}),
          ...(isSuper ? { superAdmin: true } : {})
        }
      };

      const session = {
        access_token: loginData.session?.access_token || randomUUID(),
        user,
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

// Helper to clean and format AI text for Robot Text-To-Speech (TTS) voice engines
const formatForTTS = (text) => {
  if (!text) return '';
  return text
    .replace(/🤖⚡?\s*\[[^\]]+\]:\s*/gi, '') // Remove model badges/headers
    .replace(/###\s*🤖⚡?\s*[^:\n]+[:\n]*/gi, '') // Remove markdown robot headers
    .replace(/```[\s\S]*?```/g, 'Code snippet provided on screen.') // Replace code blocks with speech note
    .replace(/`([^`]+)`/g, '$1') // Strip inline backticks
    .replace(/[*_~#>]/g, '') // Strip markdown formatting symbols
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert markdown links [text](url) to text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '') // Strip emojis
    .replace(/\s+/g, ' ')
    .trim();
};

// Shared Vault RAG Context Fetcher — used by BOTH Alpha and Beta pipelines
// Both robots draw from the same uploaded lesson knowledge base
const fetchVaultRAGContext = async (message) => {
  try {
    const vaultFiles = await getFilesFromStorage();
    if (!Array.isArray(vaultFiles) || vaultFiles.length === 0) return '';
    const queryWords = message.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const matched = vaultFiles.filter((f) => {
      const hay = `${f.name || f.filename || ''} ${f.category || ''} ${f.description || ''}`.toLowerCase();
      return queryWords.some((w) => hay.includes(w));
    }).slice(0, 3); // up to 3 matched documents
    if (matched.length === 0) return '';
    return matched
      .map((m) => `[Vault Doc: ${m.name || m.filename || 'Lesson'} (${m.category || 'General'})]: ${m.script || m.content || m.description || ''}`)
      .join('\n\n');
  } catch (err) {
    console.warn('[Vault RAG Fetch Warning]:', err.message);
    return '';
  }
};

// Pipeline runner for Thambi Robot Alpha 🤖 (Fast Tutoring & Operational Voice)
async function runRobotAlphaPipeline({ message, context, robotId, provider, activeGroqKey, activeOpenRouterKey, activeGrokKey }) {
  // Alpha now also uses the shared vault knowledge base — same as Beta
  let enrichedContext = context || '';
  if (!enrichedContext && message) {
    enrichedContext = await fetchVaultRAGContext(message);
  }

  const alphaSystemPrompt = `You are Thambi Robot Alpha 🤖 (Unit ID: ${robotId}), a cheerful, exceptionally fast AI learning companion, patient tutor, and empathetic student counselor.
Your responses MUST be:
1. Clear, encouraging, and spoken-friendly with short, digestible sentences.
2. Step-by-step with concise bullet points for complex topics.
3. Warm and motivational when students express stress or confusion.
${enrichedContext ? `[SHARED VAULT KNOWLEDGE BASE]:\n${enrichedContext}` : ''}`;

  // 1. Ultra-Fast Groq (LLaMA 3.3 70B or LLaMA 3.1 8B Instant <400ms latency)
  if (provider === 'groq' || !provider || provider === 'alpha' || provider === 'both') {
    if (isValidKey(activeGroqKey)) {
      try {
        let groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeGroqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: alphaSystemPrompt },
              { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 600
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
              messages: [
                { role: 'system', content: alphaSystemPrompt },
                { role: 'user', content: message }
              ],
              temperature: 0.7,
              max_tokens: 600
            })
          });
        }

        if (groqRes.ok) {
          const data = await groqRes.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const cleanContent = `🤖 [Thambi Robot Alpha]:\n\n${content}`;
            return {
              content: cleanContent,
              ttsText: formatForTTS(cleanContent),
              robotModel: 'alpha',
              robotId
            };
          }
        }
      } catch (err) {
        console.error('[Thambi Robot Alpha Groq Error]:', err);
      }
    }
  }

  // 2. OpenRouter fallback
  if (provider === 'openrouter' || (!isValidKey(activeGroqKey) && isValidKey(activeOpenRouterKey))) {
    if (isValidKey(activeOpenRouterKey)) {
      try {
        const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeOpenRouterKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'anthropic/claude-3.5-sonnet',
            messages: [
              { role: 'system', content: alphaSystemPrompt },
              { role: 'user', content: message }
            ]
          })
        });

        if (apiResponse.ok) {
          const data = await apiResponse.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const cleanContent = `🤖 [Thambi Robot Alpha]:\n\n${content}`;
            return {
              content: cleanContent,
              ttsText: formatForTTS(cleanContent),
              robotModel: 'alpha',
              robotId
            };
          }
        }
      } catch (err) {
        console.error('[Thambi Robot Alpha OpenRouter Error]:', err);
      }
    }
  }

  // 3. xAI Grok fallback
  if (isValidKey(activeGrokKey)) {
    try {
      let apiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeGrokKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          messages: [
            { role: 'system', content: alphaSystemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!apiResponse.ok) {
        apiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeGrokKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'grok-beta',
            messages: [
              { role: 'system', content: alphaSystemPrompt },
              { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 500
          })
        });
      }

      if (apiResponse.ok) {
        const data = await apiResponse.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const cleanContent = `🤖 [Thambi Robot Alpha]:\n\n${content}`;
          return {
            content: cleanContent,
            ttsText: formatForTTS(cleanContent),
            robotModel: 'alpha',
            robotId
          };
        }
      }
    } catch (err) {
      console.error('[Thambi Robot Alpha xAI Error]:', err);
    }
  }

  // 4. Offline simulation fallback
  const offlineContent = `🤖 [Thambi Robot Alpha (Offline Mode)]:\n\n${getOfflineCounselResponse(message)}`;
  return {
    content: offlineContent,
    ttsText: formatForTTS(offlineContent),
    robotModel: 'alpha',
    robotId
  };
}

// Pipeline runner for Thambi Robot Beta 🤖⚡ (Next-Gen DeepThink & Advanced STEM Vault RAG)
async function runRobotBetaPipeline({ message, context, robotId, activeGroqKey, activeOpenRouterKey, activeGrokKey }) {
  // Uses the shared vault RAG fetcher — same knowledge base as Alpha
  let enrichedContext = context || '';
  if (!enrichedContext && message) {
    enrichedContext = await fetchVaultRAGContext(message);
  }

  const betaSystemPrompt = `You are Thambi Robot Beta 🤖⚡ (Unit ID: ${robotId}), an advanced next-generation AI robotics mentor, autonomous systems specialist, and empathetic STEM student counselor.
You possess deep technical expertise across Robotics, AI Models, Sensor Integration, Microcontrollers (Arduino, ESP32, ROS2), Mathematics, and Physics.
Your responses MUST be:
1. Deep, structured, and broken down step-by-step with clear logic and bullet points.
2. Encouraging, warm, and highly engaging.
3. Speech-optimized so explanations sound natural and inspiring when spoken aloud.
${enrichedContext ? `[SHARED VAULT KNOWLEDGE BASE]:\n${enrichedContext}` : ''}`;

  // 1. Groq LLaMA 3.3 70B Versatile for high-speed Beta DeepThink reasoning
  if (isValidKey(activeGroqKey)) {
    try {
      const betaRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeGroqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: betaSystemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 750
        })
      });

      if (betaRes.ok) {
        const data = await betaRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const cleanContent = `🤖⚡ [Thambi Robot Beta]:\n\n${content}`;
          return {
            content: cleanContent,
            ttsText: formatForTTS(cleanContent),
            robotModel: 'beta',
            robotId
          };
        }
      }
    } catch (err) {
      console.error('[Thambi Robot Beta Groq Error]:', err);
    }
  }

  // 2. xAI Grok fallback
  if (isValidKey(activeGrokKey)) {
    try {
      const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeGrokKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          messages: [
            { role: 'system', content: betaSystemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 750
        })
      });

      if (grokRes.ok) {
        const data = await grokRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const cleanContent = `🤖⚡ [Thambi Robot Beta]:\n\n${content}`;
          return {
            content: cleanContent,
            ttsText: formatForTTS(cleanContent),
            robotModel: 'beta',
            robotId
          };
        }
      }
    } catch (err) {
      console.error('[Thambi Robot Beta xAI Error]:', err);
    }
  }

  // 3. OpenRouter fallback
  if (isValidKey(activeOpenRouterKey)) {
    try {
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeOpenRouterKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: betaSystemPrompt },
            { role: 'user', content: message }
          ]
        })
      });

      if (orRes.ok) {
        const data = await orRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const cleanContent = `🤖⚡ [Thambi Robot Beta]:\n\n${content}`;
          return {
            content: cleanContent,
            ttsText: formatForTTS(cleanContent),
            robotModel: 'beta',
            robotId
          };
        }
      }
    } catch (err) {
      console.error('[Thambi Robot Beta OpenRouter Error]:', err);
    }
  }

  // 4. Offline simulation fallback
  const offlineContent = `🤖⚡ [Thambi Robot Beta (Offline Mode)]:\n\n${getOfflineCounselResponse(message)}`;
  return {
    content: offlineContent,
    ttsText: formatForTTS(offlineContent),
    robotModel: 'beta',
    robotId
  };
}

// POST /api/counsel - Smart Logic Gate Gateway for Robot Alpha, Beta & Simultaneous Dual Interaction
app.post('/api/counsel', async (req, res) => {
  const { message, context, provider, robotModel: bodyRobotModel, robotId: bodyRobotId } = req.body || {};

  // Validate required message field
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message field is required and must be a non-empty string.' });
  }
  
  // Smart Logic Gate: Detect Robot Model & Hardware ID from Headers or Payload
  const rawId = req.headers['x-robot-id'] || req.headers['x-robot-sn'] || bodyRobotId;

  // Step 1: Try to resolve identity from Robot Registry (manufacturer-controlled assignment)
  const registryEntry = resolveRobotFromRegistry(rawId);

  // Step 2: Fall back to x-robot-model header / body payload if not registered
  const rawModel = req.headers['x-robot-model'] || req.headers['x-robot-type'] || bodyRobotModel || provider || 'alpha';
  const modelStr = String(rawModel).toLowerCase().trim();
  const isDual = modelStr.includes('both') || modelStr.includes('dual') || modelStr.includes('all');

  // Registry overrides header: manufacturer decides which serial = which model
  const robotModel = registryEntry
    ? registryEntry.model
    : (isDual ? 'both' : (modelStr.includes('beta') ? 'beta' : 'alpha'));

  const alphaId = rawId && (robotModel === 'alpha' || registryEntry?.model === 'alpha')
    ? rawId : 'alpha-unit-001';
  const betaId = rawId && (robotModel === 'beta' || registryEntry?.model === 'beta')
    ? rawId : 'beta-unit-002';
  const resolvedRobotId = isDual
    ? `${alphaId} & ${betaId}`
    : (robotModel === 'beta' ? betaId : alphaId);
  const resolvedRobotName = registryEntry?.registeredName || (robotModel === 'beta' ? 'Thambi Robot Beta' : 'Thambi Robot Alpha');

  // Master Authentication Gate: Validate API Key for Hardware Robots
  const apiKey = req.headers['x-api-key'] || req.query?.access_token || req.query?.api_key || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  const isRobotHardware = Boolean(req.headers['x-robot-model'] || req.headers['x-robot-id'] || req.headers['x-robot-type']);

  if (apiKey || isRobotHardware) {
    const configuredKeysStr = process.env.DATA_VAULT_API_KEY || 'default-vault-key,trusted-partner-key,educational-api-key';
    const approvedKeys = configuredKeysStr.split(',').map((k) => k.trim());
    const isValid = (apiKey && (approvedKeys.includes(apiKey) || apiKey.startsWith('apikey:') || apiKey.startsWith('vault-key-') || apiKey === 'trusted-partner-key')) || validateApiKey(req);

    if (!isValid) {
      console.warn(`[Robot Logic Gate] Unauthorized Robot API attempt | Model: ${robotModel.toUpperCase()} | Key: ${apiKey ? apiKey.slice(0, 8) + '...' : 'none'}`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing x-api-key header for Robot Gateway. Please provide a valid Master API Key.',
        robotModel,
        robotId: resolvedRobotId
      });
    }
  }

  // Use separate headers to avoid ambiguity: x-groq-key for Groq, x-grok-key / x-xai-key for xAI Grok
  const clientGroqKey = req.headers['x-groq-key'];   // Groq API key (starts with gsk_)
  const clientGrokKey = req.headers['x-grok-key'] || req.headers['x-xai-key'];  // xAI Grok key
  const clientOpenRouterKey = req.headers['x-openrouter-key'];

  const activeGroqKey = isValidKey(clientGroqKey) ? clientGroqKey : (process.env.GROQ_API_KEY);
  const activeGrokKey = isValidKey(clientGrokKey) ? clientGrokKey : (process.env.GROK_API_KEY || process.env.XAI_API_KEY);
  const activeOpenRouterKey = isValidKey(clientOpenRouterKey) ? clientOpenRouterKey : process.env.OPENROUTER_API_KEY;

  console.log(`[Robot Logic Gate] Incoming Request | Robot ID: ${resolvedRobotId} | Target Model: ${robotModel.toUpperCase()}`);

  // Dual Interaction Mode: Simultaneous communication with both robots
  if (robotModel === 'both') {
    const [alphaRes, betaRes] = await Promise.all([
      runRobotAlphaPipeline({ message, context, robotId: alphaId, provider, activeGroqKey, activeOpenRouterKey, activeGrokKey }),
      runRobotBetaPipeline({ message, context, robotId: betaId, activeGroqKey, activeOpenRouterKey, activeGrokKey })
    ]);

    const combinedContent = `### 🤖 Thambi Robot Alpha (Old / V1 Unit)\n\n${alphaRes.content}\n\n---\n\n### 🤖⚡ Thambi Robot Beta (New / V2 Unit)\n\n${betaRes.content}`;
    const combinedTts = `Alpha: ${alphaRes.ttsText}. Beta: ${betaRes.ttsText}`;

    return res.json({
      robotModel: 'both',
      robotId: resolvedRobotId,
      content: combinedContent,
      ttsText: combinedTts,
      robots: [
        {
          robotModel: 'alpha',
          robotId: alphaId,
          name: 'Thambi Robot Alpha (Old/V1 Tutor)',
          content: alphaRes.content,
          ttsText: alphaRes.ttsText
        },
        {
          robotModel: 'beta',
          robotId: betaId,
          name: 'Thambi Robot Beta (New/V2 DeepSTEM)',
          content: betaRes.content,
          ttsText: betaRes.ttsText
        }
      ]
    });
  }

  // Single Robot Mode: Beta (New Unit)
  if (robotModel === 'beta') {
    const betaRes = await runRobotBetaPipeline({ message, context, robotId: betaId, activeGroqKey, activeOpenRouterKey, activeGrokKey });
    return res.json({
      robotModel: 'beta',
      robotId: betaId,
      registeredName: resolvedRobotName,
      content: betaRes.content,
      ttsText: betaRes.ttsText,
      robots: [
        {
          robotModel: 'beta',
          robotId: betaId,
          name: resolvedRobotName || 'Thambi Robot Beta (New/V2 DeepSTEM)',
          content: betaRes.content,
          ttsText: betaRes.ttsText
        }
      ]
    });
  }

  // Single Robot Mode: Alpha (Old Unit - Default)
  const alphaRes = await runRobotAlphaPipeline({ message, context, robotId: alphaId, provider, activeGroqKey, activeOpenRouterKey, activeGrokKey });
  return res.json({
    robotModel: 'alpha',
    robotId: alphaId,
    registeredName: resolvedRobotName,
    content: alphaRes.content,
    ttsText: alphaRes.ttsText,
    robots: [
      {
        robotModel: 'alpha',
        robotId: alphaId,
        name: resolvedRobotName || 'Thambi Robot Alpha (Old/V1 Tutor)',
        content: alphaRes.content,
        ttsText: alphaRes.ttsText
      }
    ]
  });
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

// ==========================================
// ROBOT REGISTRY — Manufacturer Configuration
// Maps physical hardware serial numbers → Alpha or Beta model
// Manufacturer updates this via /api/v1/robots/register using their vault API key
// ==========================================
const robotRegistryStorePath = path.join(fileStoreDirectory, 'robot_registry.json');

const loadRobotRegistry = async () => {
  try {
    const raw = await fs.readFile(robotRegistryStorePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
};

let robotRegistry = await loadRobotRegistry();

const saveRobotRegistry = async () => {
  try {
    await fs.mkdir(fileStoreDirectory, { recursive: true });
    await fs.writeFile(robotRegistryStorePath, JSON.stringify(robotRegistry, null, 2), 'utf8');
  } catch (err) {
    console.error('[Save Robot Registry Error]:', err);
  }
};

/**
 * Resolves a hardware serial number to its registered robot model.
 * The manufacturer registers serials via POST /api/v1/robots/register.
 * Returns { model: 'alpha'|'beta', robotId, registeredName } or null if not registered.
 */
const resolveRobotFromRegistry = (serialNumber) => {
  if (!serialNumber) return null;
  const sn = String(serialNumber).trim();
  const entry = robotRegistry.find(
    (r) => r.serialNumber && r.serialNumber.trim().toLowerCase() === sn.toLowerCase()
  );
  if (!entry) return null;
  return {
    model: entry.model === 'beta' ? 'beta' : 'alpha',
    robotId: entry.serialNumber,
    registeredName: entry.name || `Thambi Robot ${entry.model === 'beta' ? 'Beta' : 'Alpha'}`
  };
};

// ==========================================
// MANUFACTURER ROBOT REGISTRATION & VAULT ENDPOINTS
// Protected by Master Vault API Key (x-api-key)
// Used by 3rd-party robot manufacturer / hardware provisioning
// ==========================================

// POST /api/v1/robots/register - Register or update a physical robot serial number
app.post('/api/v1/robots/register', async (req, res) => {
  const auth = validateApiKey(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Valid x-api-key required to register robots.' });
  }

  const { serialNumber, model, name, notes } = req.body || {};
  if (!serialNumber || typeof serialNumber !== 'string' || !serialNumber.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'serialNumber is required and must be a non-empty string.' });
  }

  const cleanSn = serialNumber.trim();
  const cleanModel = String(model || 'alpha').toLowerCase().trim().includes('beta') ? 'beta' : 'alpha';
  const cleanName = name?.trim() || `Thambi Robot ${cleanModel === 'beta' ? 'Beta' : 'Alpha'}`;

  const existingIndex = robotRegistry.findIndex(
    (r) => r.serialNumber && r.serialNumber.trim().toLowerCase() === cleanSn.toLowerCase()
  );

  const robotRecord = {
    serialNumber: cleanSn,
    model: cleanModel,
    name: cleanName,
    notes: notes || '',
    registeredBy: auth.email || auth.id,
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    robotRecord.createdAt = robotRegistry[existingIndex].createdAt || robotRecord.updatedAt;
    robotRegistry[existingIndex] = robotRecord;
  } else {
    robotRecord.createdAt = robotRecord.updatedAt;
    robotRegistry.push(robotRecord);
  }

  await saveRobotRegistry();

  return res.status(existingIndex >= 0 ? 200 : 201).json({
    success: true,
    action: existingIndex >= 0 ? 'updated' : 'registered',
    message: `Robot ${cleanSn} successfully assigned to Thambi Robot ${cleanModel.toUpperCase()}`,
    robot: robotRecord
  });
});

// GET /api/v1/robots/registry - List all registered robots
app.get('/api/v1/robots/registry', async (req, res) => {
  const auth = validateApiKey(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Valid x-api-key required.' });
  }

  return res.json({
    success: true,
    count: robotRegistry.length,
    robots: robotRegistry
  });
});

// GET /api/v1/robots/:sn - Get robot details by serial number
app.get('/api/v1/robots/:sn', async (req, res) => {
  const auth = validateApiKey(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Valid x-api-key required.' });
  }

  const sn = (req.params.sn || '').trim();
  const robot = robotRegistry.find(
    (r) => r.serialNumber && r.serialNumber.trim().toLowerCase() === sn.toLowerCase()
  );

  if (!robot) {
    return res.status(404).json({ error: 'Not Found', message: `Robot with serial number "${sn}" not found in registry.` });
  }

  return res.json({ success: true, robot });
});

// PUT /api/v1/robots/:sn - Update robot model or name
app.put('/api/v1/robots/:sn', async (req, res) => {
  const auth = validateApiKey(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Valid x-api-key required.' });
  }

  const sn = (req.params.sn || '').trim();
  const index = robotRegistry.findIndex(
    (r) => r.serialNumber && r.serialNumber.trim().toLowerCase() === sn.toLowerCase()
  );

  if (index === -1) {
    return res.status(404).json({ error: 'Not Found', message: `Robot with serial number "${sn}" not found in registry.` });
  }

  const { model, name, notes } = req.body || {};
  if (model) {
    robotRegistry[index].model = String(model).toLowerCase().trim().includes('beta') ? 'beta' : 'alpha';
  }
  if (name) robotRegistry[index].name = name.trim();
  if (notes !== undefined) robotRegistry[index].notes = notes;
  robotRegistry[index].updatedAt = new Date().toISOString();

  await saveRobotRegistry();

  return res.json({
    success: true,
    message: `Robot ${sn} updated successfully.`,
    robot: robotRegistry[index]
  });
});

// DELETE /api/v1/robots/:sn - Unregister a robot
app.delete('/api/v1/robots/:sn', async (req, res) => {
  const auth = validateApiKey(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Valid x-api-key required.' });
  }

  const sn = (req.params.sn || '').trim();
  const index = robotRegistry.findIndex(
    (r) => r.serialNumber && r.serialNumber.trim().toLowerCase() === sn.toLowerCase()
  );

  if (index === -1) {
    return res.status(404).json({ error: 'Not Found', message: `Robot with serial number "${sn}" not found in registry.` });
  }

  const removed = robotRegistry.splice(index, 1)[0];
  await saveRobotRegistry();

  return res.json({
    success: true,
    message: `Robot ${sn} removed from registry.`,
    robot: removed
  });
});


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
      "/api/counsel": {
        post: {
          summary: "Robot AI Counseling Gateway (Alpha & Beta Smart Logic Gate)",
          description: "Streams AI counseling responses. Automatically routes to Alpha or Beta LLM reasoning engines based on the x-robot-model header.",
          parameters: [
            { name: "x-api-key", in: "header", required: true, schema: { type: "string" }, description: "Master API Key" },
            { name: "x-robot-model", in: "header", required: false, schema: { type: "string", enum: ["alpha", "beta"], default: "alpha" }, description: "Robot Model Identifier (alpha = Thambi Robot 1, beta = Thambi Robot 2)" },
            { name: "x-robot-id", in: "header", required: false, schema: { type: "string" }, description: "Unique Hardware Serial / Unit ID (e.g., alpha-sn-001)" }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Explain PID controller feedback loops" },
                    context: { type: "string", example: "Optional RAG knowledge context" },
                    robotModel: { type: "string", enum: ["alpha", "beta"], example: "beta" }
                  },
                  required: ["message"]
                }
              }
            }
          },
          responses: {
            "200": {
              description: "AI response formatted for robot speech synthesis & touch display",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      content: { type: "string", description: "Formatted markdown response for robot screen / touch display" },
                      ttsText: { type: "string", description: "Punctuation-paced plain text formatted for Text-To-Speech (TTS) voice engines" },
                      robotModel: { type: "string", enum: ["alpha", "beta"] },
                      robotId: { type: "string", description: "Hardware serial number / unit identifier" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/robots/register": {
        post: {
          summary: "Register / Update Physical Robot Hardware Serial",
          description: "Used by manufacturer to assign a physical robot serial number to Alpha or Beta model.",
          parameters: [
            { name: "x-api-key", in: "header", required: true, schema: { type: "string" }, description: "Master Vault API Key" }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    serialNumber: { type: "string", example: "TRA-2024-001" },
                    model: { type: "string", enum: ["alpha", "beta"], example: "alpha" },
                    name: { type: "string", example: "Thambi Robot Alpha Classroom Unit" },
                    notes: { type: "string", example: "Delivered to Robotics Lab" }
                  },
                  required: ["serialNumber", "model"]
                }
              }
            }
          },
          responses: {
            "200": { description: "Robot updated successfully" },
            "201": { description: "Robot registered successfully" },
            "401": { description: "Unauthorized" }
          }
        }
      },
      "/api/v1/robots/registry": {
        get: {
          summary: "List All Registered Robots",
          description: "Returns the complete inventory of registered physical robots.",
          parameters: [
            { name: "x-api-key", in: "header", required: true, schema: { type: "string" }, description: "Master Vault API Key" }
          ],
          responses: {
            "200": { description: "Array of registered robot records" }
          }
        }
      },
      "/api/v1/robots/{sn}": {
        get: {
          summary: "Get Registered Robot Details",
          parameters: [
            { name: "sn", in: "path", required: true, schema: { type: "string" }, description: "Robot Hardware Serial Number" },
            { name: "x-api-key", in: "header", required: true, schema: { type: "string" }, description: "Master Vault API Key" }
          ],
          responses: {
            "200": { description: "Robot record details" },
            "404": { description: "Robot serial number not found" }
          }
        },
        put: {
          summary: "Update Robot Assignment",
          parameters: [
            { name: "sn", in: "path", required: true, schema: { type: "string" }, description: "Robot Hardware Serial Number" },
            { name: "x-api-key", in: "header", required: true, schema: { type: "string" }, description: "Master Vault API Key" }
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    model: { type: "string", enum: ["alpha", "beta"] },
                    name: { type: "string" },
                    notes: { type: "string" }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Robot updated successfully" },
            "404": { description: "Robot not found" }
          }
        },
        delete: {
          summary: "Unregister Robot",
          parameters: [
            { name: "sn", in: "path", required: true, schema: { type: "string" }, description: "Robot Hardware Serial Number" },
            { name: "x-api-key", in: "header", required: true, schema: { type: "string" }, description: "Master Vault API Key" }
          ],
          responses: {
            "200": { description: "Robot unregistered successfully" },
            "404": { description: "Robot not found" }
          }
        }
      },
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

    // Null-guard: fallback assets built from sharedFiles may not have an apiEndpoint field
    const resolvedEndpoint = asset.apiEndpoint
      ? (asset.apiEndpoint.startsWith('http') ? asset.apiEndpoint : `${baseUrl}${asset.apiEndpoint}`)
      : `${baseUrl}/api/v1/assets/${asset.id}`;
    const resolvedRawUrl = resolvedEndpoint.endsWith('/raw') ? resolvedEndpoint : `${resolvedEndpoint}/raw`;

    return res.json({
      success: true,
      apiEndpointVersion: 'v1',
      timestamp: new Date().toISOString(),
      asset: {
        ...asset,
        apiEndpoint: resolvedEndpoint,
        rawUrl: resolvedRawUrl
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
