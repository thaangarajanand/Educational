import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, FileText, Trash2, Download, Database, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabaseClient, getAccessToken } from '../lib/supabase';

interface StoredFileRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  contentBase64?: string;
  ownerEmail: string;
  canDelete: boolean;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

async function readApiResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `The file service returned ${response.status}.`);
  }
  return data;
}

function uploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Failed to fetch' || message.includes('NetworkError')) {
    return 'File service is unavailable. Start the backend server and try again.';
  }
  return message || 'Unable to upload files right now.';
}

export function DataPage() {
  const [files, setFiles] = useState<StoredFileRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Generate or retrieve a persistent guest session ID from localStorage
  const getOrCreateGuestId = (): string => {
    try {
      let id = window.localStorage.getItem('studymentor-guest-id');
      if (!id) {
        id = crypto.randomUUID();
        window.localStorage.setItem('studymentor-guest-id', id);
      }
      return id;
    } catch {
      return crypto.randomUUID();
    }
  };

  // Load files immediately on mount WITHOUT waiting for auth
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const response = await fetch('/api/files');
        const data = await readApiResponse(response);
        setFiles((data.files || []).map((file: StoredFileRecord) => ({ ...file })));
      } catch (error) {
        console.error('Failed to load stored files:', error);
        toast.error('Unable to load shared files right now.');
      } finally {
        setIsReady(true);
      }
    };

    loadFiles();
  }, []);

  // Load auth state separately (does not block file listing)
  useEffect(() => {
    const loadSession = async () => {
      let activeGuestId: string | null = null;

      // Check if user is guest
      const isGuest = (() => {
        try {
          return window.localStorage.getItem('isGuest') === 'true';
        } catch {
          return false;
        }
      })();

      if (isGuest) {
        const gid = getOrCreateGuestId();
        activeGuestId = gid;
        setGuestId(gid);
        setCurrentUser({ id: `guest-${gid}`, email: 'Guest User' });
      } else {
        try {
          const sessionResult = await supabaseClient.auth.getSession();
          const session = sessionResult?.data?.session;
          if (session?.user?.id) {
            setCurrentUser({ id: session.user.id, email: session.user.email || '' });
          }
        } catch (error) {
          console.error('Failed to load user session:', error);
        }
      }

      // If we have a guest ID, also reload files with proper canDelete flags
      if (activeGuestId) {
        try {
          const headers: Record<string, string> = {};
          const token = await getAccessToken();
          if (token) headers.Authorization = `Bearer ${token}`;
          if (activeGuestId) headers['x-guest-id'] = activeGuestId;

          const response = await fetch('/api/files', { headers });
          const data = await readApiResponse(response);
          setFiles((data.files || []).map((file: StoredFileRecord) => ({ ...file })));
        } catch (error) {
          console.error('Failed to reload files with auth:', error);
        }
      }
    };

    loadSession();
  }, []);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (guestId) {
      headers['x-guest-id'] = guestId;
    }
    return headers;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    if (!currentUser) {
      toast.error('Please sign in or continue as guest before uploading files.');
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const records = await Promise.all(selectedFiles.map(async (file) => ({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: new Date().toISOString(),
        contentBase64: await readFileAsBase64(file),
      })));

      const headers = await getAuthHeaders();

      const response = await fetch('/api/files', {
        method: 'POST',
        headers,
        body: JSON.stringify(records[0] && records.length === 1 ? records[0] : { files: records }),
      });

      const data = await readApiResponse(response);

      setFiles((data.files || []).map((file: StoredFileRecord) => ({ ...file })));
      toast.success(`${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} uploaded successfully.`);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(uploadErrorMessage(error));
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDownload = (record: StoredFileRecord) => {
    if (!record.contentBase64) {
      toast.error('No file content available to download.');
      return;
    }

    const cleanedBase64 = record.contentBase64.includes(',') ? record.contentBase64.split(',')[1] : record.contentBase64;
    const binary = atob(cleanedBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: record.type || 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = record.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const handleDelete = async (id: string) => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`/api/files/${id}`, { method: 'DELETE', headers });
      const data = await readApiResponse(response);
      setFiles((data.files || []).map((file: StoredFileRecord) => ({ ...file })));
      toast.success('File removed.');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to delete file.');
    }
  };

  const handleNavigateToAuth = () => {
    // Trigger navigation back to auth by clearing any session tokens and reloading
    try {
      window.localStorage.removeItem('isGuest');
    } catch { /* ignore */ }
    window.location.href = '/';
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-white"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/20 p-3">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Data Vault</h1>
            <p className="text-sm text-indigo-100">
              Files uploaded here are visible to <strong>every visitor</strong> — logged-in users, guests, and unauthenticated viewers alike. 
              Only the uploader can remove a file.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex items-center gap-3">
          <UploadCloud className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Upload files</h2>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Any file type is supported. Share files with every visitor of this site — all uploaded files are publicly visible.
        </p>

        {currentUser ? (
          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center transition hover:border-blue-500 hover:bg-blue-50 dark:border-gray-600 dark:bg-black/30 dark:hover:border-blue-400">
            <UploadCloud className="mb-3 h-8 w-8 text-blue-500" />
            <span className="font-medium text-gray-800 dark:text-gray-100">Click to upload files</span>
            <span className="mt-1 text-sm text-gray-500">PDF, DOCX, images, ZIP, CSV, and more</span>
            <input type="file" multiple accept="*/*" className="hidden" onChange={handleUpload} disabled={isUploading} />
          </label>
        ) : (
          <div className="mt-5 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center dark:border-gray-600 dark:bg-black/30">
            <LogIn className="mx-auto mb-3 h-8 w-8 text-gray-400" />
            <p className="font-medium text-gray-800 dark:text-gray-100">Sign in to upload files</p>
            <p className="mt-1 text-sm text-gray-500">You need to log in or continue as guest to upload files to the shared vault.</p>
            <button
              onClick={handleNavigateToAuth}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Sign in / Register
            </button>
          </div>
        )}
        {isUploading && <p className="mt-3 text-sm text-blue-600">Uploading files...</p>}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Stored files</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {files.length} shared file{files.length === 1 ? '' : 's'} — visible to every visitor
            </p>
          </div>
        </div>

        {!isReady ? (
          <p className="text-sm text-gray-500">Loading shared files...</p>
        ) : files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
            No files yet. Upload something to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Uploaded by {file.ownerEmail || 'Unknown uploader'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {file.type || 'Unknown type'} &bull; {formatBytes(file.size)} &bull; {new Date(file.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(file)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <span className="flex items-center gap-2"><Download className="h-4 w-4" />Download</span>
                  </button>
                  {file.canDelete ? (
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" />Remove</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500"
                      title="Only the uploader can remove this file"
                    >
                      <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" />Remove</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string | ArrayBuffer | null;
      if (typeof result === 'string') {
        resolve(result);
      } else if (result) {
        const bytes = new Uint8Array(result);
        let binary = '';
        bytes.forEach((byte) => {
          binary += String.fromCharCode(byte);
        });
        resolve(btoa(binary));
      } else {
        reject(new Error('Unable to read file.'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

