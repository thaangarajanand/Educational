import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, FileText, Trash2, Download, Database, LogIn, Key, Code, Copy, Check, Terminal, Pencil, X, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabaseClient, getAccessToken, API_BASE_URL } from '../lib/supabase';

interface StoredFileRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  category?: string;
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

  const [uploadCategory, setUploadCategory] = useState('General');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);

  const [selectedParentCategory, setSelectedParentCategory] = useState('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState('All');

  const [categories, setCategories] = useState<string[]>(['General']);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [parentCategorySelect, setParentCategorySelect] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);

  const [apiKeyInput, setApiKeyInput] = useState('trusted-partner-key');
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [testCategory, setTestCategory] = useState('All');
  const [apiResult, setApiResult] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  const [editingFile, setEditingFile] = useState<StoredFileRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editFileReplacement, setEditFileReplacement] = useState<File | null>(null);
  const [isUpdatingFile, setIsUpdatingFile] = useState(false);

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

  // Load files and categories immediately on mount WITHOUT waiting for auth
  useEffect(() => {
    const loadFilesAndCategories = async () => {
      try {
        const filesResponse = await fetch(`${API_BASE_URL}/api/files`);
        const filesData = await readApiResponse(filesResponse);
        setFiles((filesData.files || []).map((file: StoredFileRecord) => ({ ...file })));

        const catsResponse = await fetch(`${API_BASE_URL}/api/categories`);
        const catsData = await catsResponse.json();
        if (catsData.categories) {
          setCategories(catsData.categories);
        }
      } catch (error) {
        console.error('Failed to load stored files/categories:', error);
        toast.error('Unable to load shared vault data right now.');
      } finally {
        setIsReady(true);
      }
    };

    loadFilesAndCategories();
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

      // If we have a guest ID or an auth token, also reload files with proper canDelete flags
      const token = await getAccessToken();
      if (activeGuestId || token) {
        try {
          const headers: Record<string, string> = {};
          if (token) {
            if (token.startsWith('apikey:')) {
              headers['x-api-key'] = token.replace('apikey:', '');
            } else {
              headers.Authorization = `Bearer ${token}`;
            }
          }
          if (activeGuestId) headers['x-guest-id'] = activeGuestId;

          const response = await fetch(`${API_BASE_URL}/api/files`, { headers });
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
      if (token.startsWith('apikey:')) {
        headers['x-api-key'] = token.replace('apikey:', '');
      } else {
        headers.Authorization = `Bearer ${token}`;
      }
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
      const finalCategory = isCustomCategoryMode ? (customCategory.trim() || 'General') : uploadCategory;
      const records = await Promise.all(selectedFiles.map(async (file) => ({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        category: finalCategory,
        uploadedAt: new Date().toISOString(),
        contentBase64: await readFileAsBase64(file),
      })));

      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/api/files`, {
        method: 'POST',
        headers,
        body: JSON.stringify(records[0] && records.length === 1 ? records[0] : { files: records }),
      });

      const data = await readApiResponse(response);

      setFiles((data.files || []).map((file: StoredFileRecord) => ({ ...file })));
      toast.success(`${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} uploaded successfully.`);
      
      // Reset upload category states
      setIsCustomCategoryMode(false);
      setCustomCategory('');
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

      const response = await fetch(`${API_BASE_URL}/api/files/${id}`, { method: 'DELETE', headers });
      const data = await readApiResponse(response);
      setFiles((data.files || []).map((file: StoredFileRecord) => ({ ...file })));
      toast.success('File removed.');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to delete file.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsCreatingCategory(true);
    try {
      const fullName = parentCategorySelect ? `${parentCategorySelect}/${newCategoryName.trim()}` : newCategoryName.trim();
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: fullName }),
      });

      const data = await readApiResponse(response);
      if (data.success) {
        toast.success(`Category "${fullName.replace('/', ' > ')}" created successfully!`);
        setNewCategoryName('');
        setParentCategorySelect('');
        // Reload category list
        const catsResponse = await fetch(`${API_BASE_URL}/api/categories`);
        const catsData = await catsResponse.json();
        if (catsData.categories) {
          setCategories(catsData.categories);
        }
      }
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to create category.');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleTestApi = async () => {
    setIsTestingApi(true);
    setApiResult(null);
    try {
      const url = `${API_BASE_URL}/api/vault/data?category=${encodeURIComponent(testCategory)}&access_token=${encodeURIComponent(apiKeyInput.trim())}`;
      const res = await fetch(url);
      const data = await res.json();
      setApiResult(JSON.stringify(data, null, 2));
      if (res.ok) {
        toast.success(`Retrieved ${data.totalFiles} records via API!`);
      } else {
        toast.error(data.message || data.error || 'API Request Failed');
      }
    } catch (err) {
      setApiResult(JSON.stringify({ error: err instanceof Error ? err.message : 'Request failed' }, null, 2));
      toast.error('Unable to connect to Vault Data API');
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleStartEdit = (file: StoredFileRecord) => {
    setEditingFile(file);
    setEditName(file.name);
    setEditCategory(file.category || 'General');
    setEditFileReplacement(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile) return;

    setIsUpdatingFile(true);
    try {
      let contentBase64: string | undefined = undefined;
      let type: string | undefined = undefined;
      let size: number | undefined = undefined;

      if (editFileReplacement) {
        contentBase64 = await readFileAsBase64(editFileReplacement);
        type = editFileReplacement.type || 'application/octet-stream';
        size = editFileReplacement.size;
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/files/${editingFile.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          category: editCategory,
          contentBase64,
          type,
          size,
        }),
      });

      const data = await readApiResponse(response);
      if (data.success) {
        toast.success(`File "${editName}" updated successfully!`);
        setEditingFile(null);

        // Reload files list
        const filesResponse = await fetch(`${API_BASE_URL}/api/files`, { headers });
        const filesData = await filesResponse.json();
        if (filesData.files) {
          setFiles(filesData.files);
        }
      }
    } catch (error) {
      console.error('Failed to update file:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to update file.');
    } finally {
      setIsUpdatingFile(false);
    }
  };

  const handleDeleteCategory = async (catName: string) => {
    if (catName === 'General') {
      toast.error('The default "General" category cannot be deleted.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete category "${catName.replace('/', ' > ')}"?`)) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/categories/${encodeURIComponent(catName)}`, {
        method: 'DELETE',
        headers,
      });

      const data = await readApiResponse(response);
      if (data.success) {
        toast.success(`Category "${catName.replace('/', ' > ')}" deleted successfully!`);
        
        // Reload category list and files list
        const [catsResponse, filesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/categories`),
          fetch(`${API_BASE_URL}/api/files`, { headers })
        ]);
        const catsData = await catsResponse.json();
        const filesData = await filesResponse.json();

        if (catsData.categories) {
          setCategories(catsData.categories);
        }
        if (filesData.files) {
          setFiles(filesData.files);
        }
        setSelectedParentCategory('All');
        setSelectedSubCategory('All');
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to delete category.');
    }
  };

  const handleStartEditCategory = (catName: string) => {
    setEditingCategory(catName);
    setEditedCategoryName(catName);
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategory || !editedCategoryName.trim()) return;

    if (editedCategoryName.trim() === editingCategory) {
      setEditingCategory(null);
      return;
    }

    setIsUpdatingCategory(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/categories/${encodeURIComponent(editingCategory)}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: editedCategoryName.trim() })
      });

      const data = await readApiResponse(response);
      if (data.success) {
        toast.success(`Category renamed to "${editedCategoryName.trim()}" successfully!`);
        
        // Reload categories & files list
        const [catsResponse, filesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/categories`),
          fetch(`${API_BASE_URL}/api/files`, { headers })
        ]);
        const catsData = await catsResponse.json();
        const filesData = await filesResponse.json();

        if (catsData.categories) setCategories(catsData.categories);
        if (filesData.files) setFiles(filesData.files);

        setEditingCategory(null);
      }
    } catch (error) {
      console.error('Failed to rename category:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rename category.');
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  const handleReorderCategory = async (catName: string, direction: 'left' | 'right') => {
    const currentIndex = categories.indexOf(catName);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    // Build new categories array
    const updated = [...categories];
    const temp = updated[currentIndex];
    updated[currentIndex] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Optimistically update local state for immediate feedback
    setCategories(updated);

    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE_URL}/api/categories/reorder`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: updated })
      });
      toast.success(`Position updated!`);
    } catch (error) {
      console.error('Failed to save category position:', error);
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          {currentUser && (
            <div className="mt-4 w-full">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                File Category
              </label>
              {!isCustomCategoryMode ? (
                <select
                  value={uploadCategory}
                  onChange={(e) => {
                    if (e.target.value === 'new') {
                      setIsCustomCategoryMode(true);
                    } else {
                      setUploadCategory(e.target.value);
                    }
                  }}
                  className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="new">+ Create Custom Category</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter new category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="flex-1 p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm animate-fade-in"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCategoryMode(false);
                      setCustomCategory('');
                    }}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-white rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

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
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold">Create category</h2>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Pre-create categories here. They will immediately show up in the category filter tabs and upload options below.
            </p>

            {currentUser ? (
              <form onSubmit={handleCreateCategory} className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Parent Category (Optional - select ONLY to nest as a sub-category)
                  </label>
                  <select
                    value={parentCategorySelect}
                    onChange={(e) => setParentCategorySelect(e.target.value)}
                    className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
                  >
                    <option value="">None (Top-Level Category)</option>
                    {categories.filter(c => !c.includes('/')).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Physics, Assignments, Math Exams"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingCategory || !newCategoryName.trim()}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isCreatingCategory ? 'Creating...' : 'Create Category'}
                </button>
              </form>
            ) : (
              <div className="mt-5 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center dark:border-gray-600 dark:bg-black/30">
                <LogIn className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                <p className="font-medium text-gray-800 dark:text-gray-100">Sign in to manage categories</p>
                <p className="mt-1 text-sm text-gray-500">You need to log in to create categories.</p>
              </div>
            )}

            {currentUser && categories.filter(c => c !== 'General').length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Created Categories (Edit ✏️ & Position ◀ ▶)
                </p>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                  {categories.filter(c => c !== 'General').map((cat) => {
                    const fullIdx = categories.indexOf(cat);
                    const canMoveLeft = fullIdx > 1; // General is index 0
                    const canMoveRight = fullIdx < categories.length - 1;

                    return (
                      <div
                        key={cat}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-sm"
                      >
                        <span className="mr-1">{cat.replace('/', ' > ')}</span>

                        {canMoveLeft && (
                          <button
                            type="button"
                            onClick={() => handleReorderCategory(cat, 'left')}
                            className="text-gray-500 hover:text-indigo-600 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Move Left"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {canMoveRight && (
                          <button
                            type="button"
                            onClick={() => handleReorderCategory(cat, 'right')}
                            className="text-gray-500 hover:text-indigo-600 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Move Right"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(cat)}
                          className="text-indigo-500 hover:text-indigo-700 p-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                          title={`Edit category "${cat}"`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          title={`Delete category "${cat}"`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Third-Party Data Vault API Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Third-Party Data Vault API</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Give an API key or Access Token to trusted third persons to retrieve Vault data filtered by Category.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Select Category
            </label>
            <select
              value={testCategory}
              onChange={(e) => setTestCategory(e.target.value)}
              className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              API Key / Access Token
            </label>
            <input
              type="text"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="e.g. trusted-partner-key or your user token"
              className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-xs font-mono"
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-900 p-3 text-white">
          <div className="flex items-center justify-between text-xs text-gray-400 pb-1 border-b border-gray-800">
            <span className="flex items-center gap-1 font-mono"><Terminal className="h-3.5 w-3.5" /> GET Request Endpoint</span>
            <button
              onClick={() => {
                const endpoint = `${API_BASE_URL}/api/vault/data?category=${encodeURIComponent(testCategory)}&access_token=${encodeURIComponent(apiKeyInput.trim())}`;
                navigator.clipboard.writeText(endpoint);
                setCopiedEndpoint(true);
                setTimeout(() => setCopiedEndpoint(false), 2000);
                toast.success('API Endpoint URL copied!');
              }}
              className="flex items-center gap-1 hover:text-white text-xs"
            >
              {copiedEndpoint ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedEndpoint ? 'Copied' : 'Copy Endpoint'}
            </button>
          </div>
          <code className="block mt-2 text-xs font-mono text-emerald-400 break-all">
            GET {API_BASE_URL}/api/vault/data?category={testCategory}&access_token={apiKeyInput.trim()}
          </code>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={handleTestApi}
            disabled={isTestingApi}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Code className="h-4 w-4" />
            {isTestingApi ? 'Fetching Data...' : 'Test API Endpoint'}
          </button>
        </div>

        {apiResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 rounded-lg bg-gray-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-60 border border-gray-800"
          >
            <pre>{apiResult}</pre>
          </motion.div>
        )}
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

        {files.length > 0 && (
          <div className="mb-6 space-y-4 border-b border-gray-100 dark:border-gray-800 pb-4">
            {/* Parent Category Row */}
            <div className="flex flex-wrap gap-2">
              {['All', ...Array.from(new Set(categories.map(c => c.split('/')[0])))].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedParentCategory(cat);
                    setSelectedSubCategory('All');
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                    selectedParentCategory === cat
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sub Category Row (if any exist for selected parent) */}
            {selectedParentCategory !== 'All' && categories.some(c => c.startsWith(`${selectedParentCategory}/`)) && (
              <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-blue-200 dark:border-blue-800/60">
                {['All', ...categories.filter(c => c.startsWith(`${selectedParentCategory}/`)).map(c => c.split('/')[1])].map((subCat) => (
                  <button
                    key={subCat}
                    onClick={() => setSelectedSubCategory(subCat)}
                    className={`px-3.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
                      selectedSubCategory === subCat
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    {subCat === 'All' ? `All ${selectedParentCategory}` : subCat}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isReady ? (
          <p className="text-sm text-gray-500">Loading shared files...</p>
        ) : files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
            No files yet. Upload something to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {files
              .filter((file) => {
                const fileCat = file.category || 'General';
                const [fileParent, fileSub] = fileCat.split('/');
                
                if (selectedParentCategory === 'All') {
                  return true;
                }
                
                if (fileParent !== selectedParentCategory) {
                  return false;
                }
                
                if (selectedSubCategory === 'All') {
                  return true;
                }
                
                return fileSub === selectedSubCategory;
              })
              .map((file) => (
                <div key={file.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {(file.category || 'General').replace('/', ' > ')}
                        </span>
                      </div>
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
                      <>
                        <button
                          onClick={() => handleStartEdit(file)}
                          className="rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                        >
                          <span className="flex items-center gap-2"><Pencil className="h-4 w-4" />Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(file.id)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" />Remove</span>
                        </button>
                      </>
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

      {/* Edit / Modify File Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Modify Vault File</h3>
              </div>
              <button
                onClick={() => setEditingFile(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  File Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Category / Sub-Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Replace File Content (Optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setEditFileReplacement(e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {editFileReplacement && (
                  <p className="mt-1 text-xs text-indigo-600">Selected new file: {editFileReplacement.name} ({formatBytes(editFileReplacement.size)})</p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingFile || !editName.trim()}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isUpdatingFile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modify Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Category</h3>
              </div>
              <button
                onClick={() => setEditingCategory(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveEditCategory(); }} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={editedCategoryName}
                  onChange={(e) => setEditedCategoryName(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
                  required
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Renaming this category will automatically update all files currently assigned to it.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingCategory || !editedCategoryName.trim()}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isUpdatingCategory ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
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

