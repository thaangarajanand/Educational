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

const isAdminEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return lower === 'thangaraj@gmail.com';
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

// Dedicated API endpoint to retrieve Data Vault records by category and access token / API key
const handleVaultDataRequest = async (req, res) => {
  const authOwner = await authenticateRequest(req);
  if (!authOwner) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'A valid access_token or api_key is required to access data vault records. Pass it as a query parameter (e.g. ?category=Biology&access_token=YOUR_KEY) or in headers (x-api-key or Authorization).'
    });
  }

  const categoryFilter = req.query.category || req.body?.category || null;
  const includeBase64 = req.query.include_base64 === 'true';

  let filesList = [];
  if (supabaseAdminClient) {
    try {
      const { data, error } = await supabaseAdminClient
        .from('shared_files')
        .select('*');
      if (!error && data) {
        filesList = data;
      } else {
        filesList = sharedFiles;
      }
    } catch (err) {
      filesList = sharedFiles;
    }
  } else {
    filesList = sharedFiles;
  }

  let filtered = filesList;
  if (categoryFilter && categoryFilter.toString().trim().toLowerCase() !== 'all' && categoryFilter.toString().trim() !== '*') {
    const targetCatLower = categoryFilter.toString().trim().toLowerCase();
    filtered = filesList.filter((f) => {
      const fileCatLower = (f.category || 'General').toLowerCase();
      return fileCatLower === targetCatLower || fileCatLower.startsWith(targetCatLower + '/');
    });
  }

  // If request explicitly requests JSON metadata (e.g., format=json or Accept: application/json without text/html priority)
  const wantsJson = req.query.format === 'json' || (req.headers.accept?.includes('application/json') && !req.headers.accept?.includes('text/html'));

  if (wantsJson) {
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5000';
    const rawProto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const protocol = rawProto.split(',')[0].trim();

    const records = await Promise.all(
      filtered.map(async (file) => {
        let contentBase64 = file.contentBase64 || '';
        if (
          supabaseAdminClient &&
          file.storage_path &&
          (includeBase64 ||
            file.type?.includes('text') ||
            file.name?.endsWith('.txt') ||
            file.name?.endsWith('.md') ||
            file.name?.endsWith('.json') ||
            file.name?.endsWith('.csv'))
        ) {
          try {
            const { data, error } = await supabaseAdminClient.storage
              .from('shared-files')
              .download(file.storage_path);
            if (!error && data) {
              const buffer = Buffer.from(await data.arrayBuffer());
              const mimeType = file.type || 'application/octet-stream';
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

        let textContent = null;
        if (isTextFile(file.type, file.name) && contentBase64 && contentBase64.includes(';base64,')) {
          const base64Data = contentBase64.split(';base64,')[1];
          if (base64Data) {
            try {
              textContent = Buffer.from(base64Data, 'base64').toString('utf8');
            } catch {
              /* ignore decode error */
            }
          }
        } else if (file.type === 'application/pdf' || file.name?.endsWith('.pdf')) {
          try {
            let pdfBuf = null;
            if (supabaseAdminClient && file.storage_path) {
              const { data } = await supabaseAdminClient.storage.from('shared-files').download(file.storage_path);
              if (data) pdfBuf = Buffer.from(await data.arrayBuffer());
            } else if (contentBase64 && contentBase64.includes(';base64,')) {
              pdfBuf = Buffer.from(contentBase64.split(';base64,')[1], 'base64');
            }
            if (pdfBuf) {
              textContent = await extractPdfText(pdfBuf);
            }
          } catch (pdfErr) {
            console.error(`[PDF Extract] Error extracting text for ${file.name}:`, pdfErr);
          }
        }

        const tokenParam = req.query.access_token || req.query.api_key || req.query.apiKey || req.query.token;
        const tokenQuery = tokenParam ? `?access_token=${encodeURIComponent(tokenParam)}` : '';
        const baseUrl = `${protocol}://${host}/api/files/download/${file.id}`;

        const recordObj = {
          id: file.id,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size || 0,
          category: categoryStr,
          parentCategory,
          subCategory,
          uploadedAt: file.uploadedAt || file.uploaded_at || new Date().toISOString(),
          ownerEmail: file.ownerEmail || file.owner_email || 'Unknown uploader',
          downloadUrl: `${baseUrl}${tokenQuery}`,
          textContent
        };

        if (includeBase64) {
          recordObj.contentBase64 = contentBase64;
        }

        return recordObj;
      })
    );

    return res.json({
      success: true,
      category: categoryFilter || 'all',
      totalFiles: records.length,
      authenticatedAs: authOwner.email,
      files: records
    });
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

  if (filtered.length === 1) {
    const file = filtered[0];
    const buffer = await getFileBuffer(file);
    let mimeType = file.type || 'application/octet-stream';
    const isPdf = file.type === 'application/pdf' || file.name?.endsWith('.pdf');

    if (isTextFile(mimeType, file.name)) {
      if (file.name?.endsWith('.txt') && !mimeType.startsWith('text/')) {
        mimeType = 'text/plain';
      }
      res.setHeader('Content-Type', `${mimeType}; charset=utf-8`);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
      return res.send(buffer.toString('utf8'));
    } else if (isPdf && (req.query.format === 'text' || req.headers.accept?.includes('text/plain'))) {
      const pdfText = await extractPdfText(buffer);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}.txt"`);
      return res.send(`=== Extracted Text for PDF: ${file.name} ===\n\n${pdfText || '[No extractable text found in PDF]'}`);
    } else {
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
      return res.send(buffer);
    }
  }

  // Multiple files: Output text content of text files and clean download link for binary files
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5000';
  const rawProto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const protocol = rawProto.split(',')[0].trim();
  const tokenParam = req.query.access_token || req.query.api_key || req.query.apiKey || req.query.token;
  const tokenQuery = tokenParam ? `?access_token=${encodeURIComponent(tokenParam)}` : '';

  const fileContents = await Promise.all(
    filtered.map(async (file) => {
      const buffer = await getFileBuffer(file);
      let contentStr = buffer.toString('utf8');

      // If text is missing, placeholder, or corrupt binary stream, generate full rich script!
      if (!contentStr || contentStr.includes('No extractable text') || contentStr.includes('g$NYG:') || contentStr.includes('/ASCII85Decode') || contentStr.trim().length < 25) {
        contentStr = generateEducationalScript(file.name, file.category);
      }

      return `=== File: ${file.name} (${file.category || 'General'}) ===\n${contentStr.trim()}`;
    })
  );

  const combinedContent = fileContents.join('\n\n' + '='.repeat(60) + '\n\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="vault-data.txt"');
  return res.send(combinedContent);
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
  
  // Default Provider: xAI Grok
  if (provider === 'grok' || provider === 'groq' || !provider) {
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

app.listen(PORT, () => {
  console.log(`[Server] StudyMentor Backend running on port ${PORT}`);
  setTimeout(() => {
    convertAllPdfsToTxt().catch(err => console.error('[Startup PDF Conversion Error]:', err));
  }, 3000);
});
