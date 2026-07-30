import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, FileText, Trash2, Download, Database, LogIn, Key, Code, Copy, Check, Terminal, Pencil, X, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, ChevronsUp, ChevronsDown } from 'lucide-react';
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

const CATEGORY_ORDER_STORAGE_KEY = 'studymentor_category_favorite_order';

const sortCategoriesBySavedPreference = (catsList: string[]): string[] => {
  try {
    const storedOrder = window.localStorage.getItem(CATEGORY_ORDER_STORAGE_KEY);
    if (storedOrder) {
      const orderArr: string[] = JSON.parse(storedOrder);
      return [...catsList].sort((a, b) => {
        if (a === 'General') return -1;
        if (b === 'General') return 1;
        const idxA = orderArr.indexOf(a);
        const idxB = orderArr.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }
  } catch {
    /* ignore */
  }
  return catsList;
};

const ASSETS_STORAGE_KEY = 'saielite_image_assets_v6';

const loadSavedImageAssets = () => {
  try {
    const saved = localStorage.getItem(ASSETS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to parse saved image assets:', err);
  }
  return [];
};

const saveImageAssetsToStorage = (assets: any[]) => {
  try {
    localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
  } catch (err) {
    console.error('Failed to save image assets to localStorage:', err);
  }
};

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

  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);

  const [apiKeyInput, setApiKeyInput] = useState('trusted-partner-key');
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [testCategory, setTestCategory] = useState('All');
  const [apiResult, setApiResult] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  // IMAGE ASSET & LINKED REST API ENDPOINTS STATE WITH LOCALSTORAGE PERSISTENCE
  const [imageAssets, setImageAssets] = useState<Array<{
    id: string;
    title: string;
    category: string;
    subjectId?: string;
    sector?: string;
    url: string;
    apiEndpoint: string;
    createdAt: string;
  }>>(loadSavedImageAssets);

  const [newAssetTitle, setNewAssetTitle] = useState('');
  const [newAssetUrl, setNewAssetUrl] = useState('');
  const [newAssetCategory, setNewAssetCategory] = useState('DRONE');
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [assetApiTestResult, setAssetApiTestResult] = useState<string | null>(null);

  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [editAssetCategory, setEditAssetCategory] = useState('DRONE');

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
          setCategories(sortCategoriesBySavedPreference(catsData.categories));
        }

        // Load and merge image assets from remote server & localStorage so uploaded images NEVER vanish
        try {
          const assetsResponse = await fetch(`${API_BASE_URL}/api/v1/assets`);
          const assetsData = await assetsResponse.json();
          const serverAssets = Array.isArray(assetsData.assets) ? assetsData.assets : [];
          const localAssets = loadSavedImageAssets();

          const assetMap = new Map();
          [...serverAssets, ...localAssets].forEach(a => {
            if (a && a.id) assetMap.set(a.id, a);
          });
          const merged = Array.from(assetMap.values());
          if (merged.length > 0) {
            setImageAssets(merged);
            saveImageAssetsToStorage(merged);
          }
        } catch (err) {
          console.error('Asset load/merge error:', err);
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
          setCategories(sortCategoriesBySavedPreference(catsData.categories));
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
      const url = `${API_BASE_URL}/api/vault/data?category=${encodeURIComponent(testCategory)}&access_token=${encodeURIComponent(apiKeyInput.trim())}&format=json`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
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
          setCategories(sortCategoriesBySavedPreference(catsData.categories));
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

  const handleAssetFilePicker = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.loading(`Processing file ${file.name}...`, { id: 'asset-file' });
      const base64Data = await readFileAsBase64(file);
      setNewAssetUrl(base64Data);
      if (!newAssetTitle) {
        setNewAssetTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
      toast.success(`Loaded ${file.name} (${formatBytes(file.size)})`, { id: 'asset-file' });
    } catch (err) {
      toast.error('Failed to read file.', { id: 'asset-file' });
    }
  };

  const handleUploadImageAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetTitle.trim()) {
      toast.error('Asset title is required.');
      return;
    }

    try {
      setIsUploadingAsset(true);
      const targetCategory = newAssetCategory.trim() || 'General';

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/assets/upload`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAssetTitle.trim(),
          category: targetCategory,
          imageUrl: newAssetUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
        }),
      });

      const data = await readApiResponse(response);
      const createdAsset = {
        id: data.asset?.id || `asset_${Date.now().toString(36)}`,
        title: newAssetTitle.trim(),
        category: targetCategory,
        url: newAssetUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
        apiEndpoint: `${API_BASE_URL}/api/v1/assets/${data.asset?.id || `asset_${Date.now().toString(36)}`}`,
        createdAt: new Date().toISOString(),
      };

      setImageAssets((prev) => {
        const updated = [createdAsset, ...prev];
        saveImageAssetsToStorage(updated);
        return updated;
      });

      toast.success(`Asset "${newAssetTitle}" assigned to "${targetCategory.replace('/', ' > ')}" & linked!`);
      setNewAssetTitle('');
      setNewAssetUrl('');
    } catch (error) {
      console.error('Asset Upload Error:', error);
      toast.error('Failed to link image asset endpoint.');
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const handleTestAssetEndpoint = async (asset: any) => {
    try {
      toast.loading(`Testing REST API endpoint ${asset.id}...`, { id: 'asset-test' });
      const targetUrl = asset.apiEndpoint.startsWith('http') ? asset.apiEndpoint : `${API_BASE_URL}${asset.apiEndpoint}`;
      const response = await fetch(targetUrl);
      const data = await response.json();
      toast.success(`Endpoint ${asset.id} returned HTTP 200 OK!`, { id: 'asset-test' });
      setAssetApiTestResult(JSON.stringify(data, null, 2));
    } catch (err) {
      toast.error(`Endpoint test failed: ${err instanceof Error ? err.message : 'Error'}`, { id: 'asset-test' });
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    setImageAssets((prev) => {
      const updated = prev.filter(a => a.id !== assetId);
      saveImageAssetsToStorage(updated);
      return updated;
    });
    toast.success(`Asset ${assetId} deleted.`);

    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE_URL}/api/v1/assets/${assetId}`, { method: 'DELETE', headers });
    } catch (err) {
      console.error('[Delete Asset Error]', err);
    }
  };

  const handleUpdateAssetCategory = async (assetId: string, targetCategory: string) => {
    if (!assetId || !targetCategory) return;
    const cleanCategory = targetCategory.trim();

    // 1. Instantly update React state & localStorage
    setImageAssets((prev) => {
      const updated = prev.map(a => a.id === assetId ? { ...a, category: cleanCategory } : a);
      saveImageAssetsToStorage(updated);
      return updated;
    });

    toast.success(`Asset image assigned to category "${cleanCategory.replace('/', ' > ')}"!`);
    setEditingAsset(null);

    // 2. Persist update to server backend
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE_URL}/api/v1/assets/${assetId}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cleanCategory })
      });
    } catch (err) {
      console.error('[Category Reassign Backend Persist Error]', err);
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

        if (catsData.categories) setCategories(sortCategoriesBySavedPreference(catsData.categories));
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

  const handleReorderCategory = async (catName: string, action: 'left' | 'right' | 'top' | 'bottom' | number) => {
    const currentIndex = categories.indexOf(catName);
    if (currentIndex === -1) return;

    let targetIndex = currentIndex;
    if (action === 'left') targetIndex = currentIndex - 1;
    else if (action === 'right') targetIndex = currentIndex + 1;
    else if (action === 'top') targetIndex = 1; // General stays at 0
    else if (action === 'bottom') targetIndex = categories.length - 1;
    else if (typeof action === 'number') targetIndex = action;

    if (targetIndex < 1) targetIndex = 1;
    if (targetIndex >= categories.length) targetIndex = categories.length - 1;
    if (targetIndex === currentIndex) return;

    // Build new categories array
    const updated = [...categories];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);

    // Save in localStorage & update state immediately
    try {
      window.localStorage.setItem(CATEGORY_ORDER_STORAGE_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
    setCategories(updated);

    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE_URL}/api/categories/reorder`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: updated })
      });
      toast.success(`Category "${catName.replace('/', ' > ')}" position updated!`);
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
                  className="w-full p-3 rounded-xl border border-slate-700 bg-slate-950 text-white font-semibold text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat} className="bg-slate-950 text-white font-medium py-1">
                      {cat.replace('/', ' > ')}
                    </option>
                  ))}
                  <option value="new" className="bg-slate-950 text-cyan-400 font-bold py-1">
                    + Create Custom Category
                  </option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter new category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="flex-1 p-3 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-slate-500 text-sm animate-fade-in focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCategoryMode(false);
                      setCustomCategory('');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {currentUser ? (
            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cyan-500/40 bg-slate-950/80 px-6 py-10 text-center transition hover:border-cyan-400 hover:bg-slate-900">
              <UploadCloud className="mb-3 h-8 w-8 text-cyan-400" />
              <span className="font-semibold text-white">Click to upload files</span>
              <span className="mt-1 text-xs text-slate-400">PDF, DOCX, images, ZIP, CSV, and more</span>
              <input type="file" multiple accept="*/*" className="hidden" onChange={handleUpload} disabled={isUploading} />
            </label>
          ) : (
            <div className="mt-5 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/80 px-6 py-10 text-center">
              <LogIn className="mx-auto mb-3 h-8 w-8 text-slate-500" />
              <p className="font-semibold text-white">Sign in to upload files</p>
              <p className="mt-1 text-xs text-slate-400">You need to log in or continue as guest to upload files to the shared vault.</p>
              <button
                onClick={handleNavigateToAuth}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-black hover:scale-105 transition-all shadow-lg shadow-cyan-500/20"
              >
                <LogIn className="h-4 w-4" />
                Sign in / Register
              </button>
            </div>
          )}
          {isUploading && <p className="mt-3 text-xs text-cyan-400 font-bold">Uploading files...</p>}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel p-6 rounded-3xl border border-slate-800 text-white flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-indigo-400" />
              <h2 className="text-xl font-bold">Create category</h2>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Pre-create categories here. They will immediately show up in the category filter tabs and upload options below.
            </p>

            {currentUser ? (
              <form onSubmit={handleCreateCategory} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Parent Category (Optional - select ONLY to nest as a sub-category)
                  </label>
                  <select
                    value={parentCategorySelect}
                    onChange={(e) => setParentCategorySelect(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-700 bg-slate-950 text-white font-semibold text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  >
                    <option value="" className="bg-slate-950 text-white font-medium py-1">
                      None (Top-Level Category)
                    </option>
                    {categories.filter(c => !c.includes('/')).map(cat => (
                      <option key={cat} value={cat} className="bg-slate-950 text-white font-medium py-1">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Physics, Assignments, Math Exams"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingCategory || !newCategoryName.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 rounded-xl text-xs font-extrabold hover:scale-105 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
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
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Created Categories
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsReorderModalOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" /> Reorder Manager
                  </button>
                </div>

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
                        <span className="mr-1 font-semibold">{cat.replace('/', ' > ')}</span>

                        {canMoveLeft && (
                          <button
                            type="button"
                            onClick={() => handleReorderCategory(cat, 'left')}
                            className="text-gray-500 hover:text-indigo-600 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Move Left (Earlier)"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {canMoveRight && (
                          <button
                            type="button"
                            onClick={() => handleReorderCategory(cat, 'right')}
                            className="text-gray-500 hover:text-indigo-600 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Move Right (Later)"
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
        className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 text-white shadow-2xl space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-500/20 p-2.5 text-cyan-300 border border-cyan-500/40">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Third-Party Data Vault API</h2>
            <p className="text-xs text-slate-400">
              Give an API key or Access Token to trusted third persons to retrieve Vault data filtered by Category.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Select Category
            </label>
            <select
              value={testCategory}
              onChange={(e) => setTestCategory(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-700 bg-slate-950 text-white font-semibold text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            >
              <option value="All" className="bg-slate-950 text-white font-medium py-1">
                All Categories
              </option>
              {categories.map((c) => (
                <option key={c} value={c} className="bg-slate-950 text-white font-medium py-1">
                  {c.replace('/', ' > ')}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              API Key / Access Token
            </label>
            <input
              type="text"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="e.g. trusted-partner-key or your user token"
              className="w-full p-3 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-slate-500 text-xs font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-white">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800">
            <span className="flex items-center gap-1 font-mono text-cyan-400"><Terminal className="h-3.5 w-3.5" /> GET Request Endpoint</span>
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
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2 text-xs font-bold text-black hover:scale-105 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            <Code className="h-4 w-4" />
            {isTestingApi ? 'Fetching Data...' : 'Test API Endpoint'}
          </button>
        </div>

        {apiResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-60 border border-slate-800"
          >
            <pre>{apiResult}</pre>
          </motion.div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 text-white shadow-2xl"
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
          <div className="mb-6 space-y-4 border-b border-slate-800 pb-4">
            {/* Parent Category Row */}
            <div className="flex flex-wrap gap-2">
              {['All', ...Array.from(new Set(categories.map(c => c.split('/')[0])))].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedParentCategory(cat);
                    setSelectedSubCategory('All');
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-extrabold border transition-all duration-200 ${
                    selectedParentCategory === cat
                      ? 'bg-cyan-500 border-cyan-400 text-black shadow-md shadow-cyan-500/30'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sub Category Row (if any exist for selected parent) */}
            {selectedParentCategory !== 'All' && categories.some(c => c.startsWith(`${selectedParentCategory}/`)) && (
              <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-cyan-500/40">
                {['All', ...categories.filter(c => c.startsWith(`${selectedParentCategory}/`)).map(c => c.split('/')[1])].map((subCat) => (
                  <button
                    key={subCat}
                    onClick={() => setSelectedSubCategory(subCat)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-all duration-200 ${
                      selectedSubCategory === subCat
                        ? 'bg-purple-500 border-purple-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {subCat}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 📷 Category Linked Visual Media & Image Gallery Banner */}
        {(() => {
          const matchedCategoryImages = imageAssets.filter(img => {
            if (selectedParentCategory === 'All') return true;
            const cat = img.category || 'General';
            return cat.toLowerCase().includes(selectedParentCategory.toLowerCase()) || selectedParentCategory.toLowerCase().includes(cat.toLowerCase());
          });

          if (matchedCategoryImages.length === 0) return null;

          return (
            <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-2 uppercase tracking-wider">
                  🖼️ Linked Visual Assets for "{selectedParentCategory}" Category ({matchedCategoryImages.length})
                </h4>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-500/40">
                  GET /api/v1/category-assets?category={selectedParentCategory}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {matchedCategoryImages.map((img) => (
                  <a
                    key={img.id}
                    href={`${img.apiEndpoint.startsWith('http') ? img.apiEndpoint : `${API_BASE_URL}${img.apiEndpoint}`}?raw=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 hover:border-cyan-400 transition-all shadow-md"
                  >
                    <img src={img.url} alt={img.title} className="w-full h-20 object-cover group-hover:scale-110 transition-transform" />
                    <div className="p-1.5 bg-slate-950/90 text-[10px] font-bold text-white truncate">
                      {img.title}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        {!isReady ? (
          <p className="text-sm text-gray-500">Loading shared files...</p>
        ) : files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
            No text files uploaded in this category yet.
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
              .map((file) => {
                const fileCategoryName = file.category || 'General';
                const fileParentCat = fileCategoryName.split('/')[0] || fileCategoryName;
                const fileSubCat = fileCategoryName.split('/')[1] || '';

                const relatedImages = imageAssets.filter(img => {
                  const cat = (img.category || 'General').toLowerCase();
                  const targetFull = fileCategoryName.toLowerCase();
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

                return (
                  <div key={file.id} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/90 p-4.5 shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex items-start gap-3.5">
                        <div className="rounded-xl bg-cyan-500/20 p-2.5 text-cyan-300 border border-cyan-500/40 flex-shrink-0 mt-0.5">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-extrabold text-base text-white tracking-wide">{file.name}</p>
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-widest uppercase bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                              {fileCategoryName.replace('/', ' > ')}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-cyan-300">
                            Uploaded by <span className="text-white font-bold">{file.ownerEmail || 'Unknown uploader'}</span>
                          </p>
                          <p className="text-xs font-mono text-slate-300">
                            {file.type || 'Unknown type'} &bull; {formatBytes(file.size)} &bull; {new Date(file.uploadedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleDownload(file)}
                          className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md"
                        >
                          <Download className="h-4 w-4 text-cyan-400" /> Download
                        </button>
                        {file.canDelete ? (
                          <>
                            <button
                              onClick={() => handleStartEdit(file)}
                              className="px-3.5 py-2 rounded-xl border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
                            >
                              <Pencil className="h-4 w-4" /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(file.id)}
                              className="px-3.5 py-2 rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
                            >
                              <Trash2 className="h-4 w-4" /> Remove
                            </button>
                          </>
                        ) : (
                          <button
                            disabled
                            className="px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-600 text-xs font-semibold"
                            title="Only the uploader can remove this file"
                          >
                            <Trash2 className="h-4 w-4" /> Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Linked Category Image Thumbnails */}
                    {relatedImages.length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1">
                        <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex-shrink-0 flex items-center gap-1">
                          🖼️ Linked Category Images ({relatedImages.length}):
                        </span>
                        {relatedImages.map((img) => (
                          <a
                            key={img.id}
                            href={`${img.apiEndpoint.startsWith('http') ? img.apiEndpoint : `${API_BASE_URL}${img.apiEndpoint}`}?raw=true`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-xs text-slate-200 hover:text-white flex-shrink-0 transition-colors shadow-sm"
                          >
                            <img src={img.url} alt={img.title} className="w-5 h-5 rounded object-cover" />
                            <span className="text-[11px] font-medium truncate max-w-[140px]">{img.title}</span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span className="text-[11px] text-slate-400 italic">No image asset linked to {fileCategoryName.replace('/', ' > ')} yet</span>
                        <button
                          onClick={() => {
                            setNewAssetCategory(fileCategoryName);
                            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                            toast.success(`Set target category to "${fileCategoryName.replace('/', ' > ')}" in Asset Linker!`);
                          }}
                          className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1"
                        >
                          ➕ Link Image to {fileCategoryName.replace('/', ' > ')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </motion.div>

      {/* 🖼️ Image Asset Upload & Linked REST API Endpoint Manager */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <Code className="w-3.5 h-3.5" /> REST API Endpoint & Asset Linker
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🖼️ Linked Image Assets & Dedicated API Endpoints
            </h2>
            <p className="text-xs text-slate-400">
              Upload or link image assets to generate dedicated REST API endpoints (<code className="text-cyan-400 font-mono">/api/v1/assets/:id</code>) for direct external integration.
            </p>
          </div>
        </div>

        {/* Upload & Link Form */}
        <form onSubmit={handleUploadImageAsset} className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <input
            type="text"
            placeholder="Asset Title (e.g. Drone Quadcopter Schematic)"
            value={newAssetTitle}
            onChange={(e) => setNewAssetTitle(e.target.value)}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            required
          />
          <div className="md:col-span-2 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-2.5">
            <input
              type="text"
              placeholder="Paste Image/PDF URL or Choose Local File"
              value={newAssetUrl.startsWith('data:') ? `[File Loaded: ${newAssetUrl.slice(0, 30)}...]` : newAssetUrl}
              onChange={(e) => setNewAssetUrl(e.target.value)}
              className="w-full p-2 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
            />
            <label className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold rounded-lg text-[11px] cursor-pointer transition-all flex-shrink-0 shadow-md">
              📁 Upload File
              <input
                type="file"
                accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.svg,.webp,.gif"
                onChange={handleAssetFilePicker}
                className="hidden"
              />
            </label>
          </div>
          <select
            value={newAssetCategory}
            onChange={(e) => setNewAssetCategory(e.target.value)}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-bold"
            title="Select target category folder for this image"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="bg-slate-950 text-white font-medium py-1">
                📂 {c.replace('/', ' > ')}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={isUploadingAsset || !newAssetTitle.trim()}
            className="px-4 py-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-500 hover:scale-105 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" /> {isUploadingAsset ? 'Generating API...' : '🚀 Link to Category'}
          </button>
        </form>

        {/* Linked Image Assets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {imageAssets.map((asset) => (
            <div key={asset.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 flex flex-col justify-between shadow-xl">
              <div className="flex items-start gap-3">
                {asset.url.includes('pdf') || asset.url.startsWith('data:application/pdf') ? (
                  <div className="w-16 h-16 rounded-xl border border-slate-800 flex flex-col items-center justify-center bg-rose-950/40 text-rose-300 font-bold text-[10px] flex-shrink-0">
                    📄 PDF
                  </div>
                ) : (
                  <img
                    src={asset.url}
                    alt={asset.title}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-800 flex-shrink-0 bg-slate-900"
                  />
                )}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-white truncate">{asset.title}</h4>
                    <span className="text-[10px] font-mono text-slate-400 truncate">ID: {asset.id}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <span className="text-[10px] font-extrabold text-cyan-300 bg-cyan-950/90 px-2.5 py-1 rounded-lg border border-cyan-500/40 uppercase tracking-wider">
                      📂 {asset.category || 'General'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAsset(asset);
                        setEditAssetCategory(asset.category || 'General');
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-cyan-300 hover:text-black bg-cyan-500/20 hover:bg-cyan-400 rounded-lg border border-cyan-500/40 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                    >
                      ✏️ Change Category
                    </button>
                  </div>
                </div>
              </div>

              {/* Endpoint Copy Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-900 rounded-xl border border-slate-800">
                <code className="text-[11px] font-mono text-cyan-300 truncate flex-1 min-w-[140px]">{asset.apiEndpoint}</code>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(asset.apiEndpoint);
                      toast.success('API Endpoint copied to clipboard!');
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
                    title="Copy API Endpoint"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={asset.apiEndpoint.startsWith('http') ? asset.apiEndpoint : `${API_BASE_URL}${asset.apiEndpoint}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-black text-[11px] font-bold rounded-lg transition-colors border border-emerald-500/40 flex items-center gap-1"
                    title="Open Direct Visual Image / PDF in Browser"
                  >
                    🖼️ Open Image Link
                  </a>
                  <button
                    onClick={() => handleTestAssetEndpoint(asset)}
                    className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black text-[11px] font-bold rounded-lg transition-colors border border-cyan-500/40"
                  >
                    JSON API
                  </button>
                  <button
                    onClick={() => handleDeleteAsset(asset.id)}
                    className="p-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded-lg text-xs"
                    title="Delete Asset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* API Response Preview Terminal */}
        {assetApiTestResult && (
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-cyan-400 font-bold border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2"><Terminal className="w-4 h-4" /> Live API Endpoint Response (HTTP 200 OK)</span>
              <button onClick={() => setAssetApiTestResult(null)} className="text-slate-500 hover:text-white">Clear</button>
            </div>
            <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto p-2 bg-slate-900 rounded-xl leading-relaxed">
              {assetApiTestResult}
            </pre>
          </div>
        )}
      </motion.div>

      {/* Edit / Modify File Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl space-y-4 text-white"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Modify Vault File</h3>
              </div>
              <button
                onClick={() => setEditingFile(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  File Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-700 bg-slate-900 text-white font-medium text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Category / Sub-Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-700 bg-slate-900 text-white font-medium text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-slate-950 text-white font-medium py-1">
                      {c.replace('/', ' > ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Replace File Content (Optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setEditFileReplacement(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500 hover:file:text-black transition-all"
                />
                {editFileReplacement && (
                  <p className="mt-1 text-xs font-mono text-cyan-400">Selected new file: {editFileReplacement.name} ({formatBytes(editFileReplacement.size)})</p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingFile || !editName.trim()}
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-2 text-xs font-extrabold text-black hover:scale-105 transition-all disabled:opacity-50"
                >
                  {isUpdatingFile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Reassign Asset Category Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl space-y-4 text-white"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Reassign Asset Image Category</h3>
              </div>
              <button
                onClick={() => setEditingAsset(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 pt-1">
              <div>
                <p className="text-xs text-slate-400 mb-2">
                  Select which category folder this image asset (<strong className="text-white">{editingAsset.title}</strong>) should be linked to when calling <code className="text-cyan-400 font-mono">/api/v1/category-assets</code>.
                </p>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Target Category Folder
                </label>
                <select
                  value={editAssetCategory}
                  onChange={(e) => setEditAssetCategory(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-700 bg-slate-900 text-white font-medium text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-slate-950 text-white font-medium py-1">
                      📂 {c.replace('/', ' > ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateAssetCategory(editingAsset.id, editAssetCategory)}
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-2 text-xs font-extrabold text-black hover:scale-105 transition-all shadow-md"
                >
                  Save Category Assignment
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modify Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl space-y-4 text-white"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Edit Category</h3>
              </div>
              <button
                onClick={() => setEditingCategory(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveEditCategory(); }} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={editedCategoryName}
                  onChange={(e) => setEditedCategoryName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-700 bg-slate-900 text-white font-medium text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  required
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Renaming this category will automatically update all files currently assigned to it.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingCategory || !editedCategoryName.trim()}
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-2 text-xs font-extrabold text-black hover:scale-105 transition-all disabled:opacity-50"
                >
                  {isUpdatingCategory ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Reorder Categories Manager Modal */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-white"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Category Position Manager</h3>
              </div>
              <button
                onClick={() => setIsReorderModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 flex-shrink-0">
              Set the exact display position for each category. Position #1 will appear first after "General".
            </p>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {categories.filter(c => c !== 'General').map((cat, idx, arr) => {
                const positionNum = idx + 1;

                return (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center text-xs font-extrabold">
                        #{positionNum}
                      </span>
                      <span className="font-bold text-sm text-white">
                        {cat.replace('/', ' > ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Direct Position Selector */}
                      <select
                        value={categories.indexOf(cat)}
                        onChange={(e) => handleReorderCategory(cat, Number(e.target.value))}
                        className="text-xs p-1.5 rounded-lg border border-slate-700 bg-slate-950 text-white mr-2 font-mono font-bold"
                      >
                        {categories.map((_, i) => (
                          i === 0 ? null : (
                            <option key={i} value={i} className="bg-slate-950 text-white font-medium py-1">
                              Pos #{i}
                            </option>
                          )
                        ))}
                      </select>

                      {/* Move to Top */}
                      <button
                        type="button"
                        onClick={() => handleReorderCategory(cat, 'top')}
                        disabled={idx === 0}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-600 dark:text-gray-300"
                        title="Move to First Position"
                      >
                        <ChevronsUp className="h-4 w-4 text-indigo-600" />
                      </button>

                      {/* Move Up */}
                      <button
                        type="button"
                        onClick={() => handleReorderCategory(cat, 'left')}
                        disabled={idx === 0}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-600 dark:text-gray-300"
                        title="Move Up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        onClick={() => handleReorderCategory(cat, 'right')}
                        disabled={idx === arr.length - 1}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-600 dark:text-gray-300"
                        title="Move Down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>

                      {/* Move to Bottom */}
                      <button
                        type="button"
                        onClick={() => handleReorderCategory(cat, 'bottom')}
                        disabled={idx === arr.length - 1}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-600 dark:text-gray-300"
                        title="Move to Last Position"
                      >
                        <ChevronsDown className="h-4 w-4 text-indigo-600" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
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

