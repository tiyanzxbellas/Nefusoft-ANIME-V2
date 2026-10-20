import { supabase } from './supabaseClient';

/**
 * Generates a unique file name.
 * @param {string} ext - The file extension (e.g. 'png', 'mp3')
 * @returns {string} - A unique file name
 */
function generateUniqueFileName(ext) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${randomStr}.${ext}`;
}

/**
 * Uploads a blob/file to the public 'chat_attachments' Supabase bucket.
 * @param {File|Blob} fileOrBlob - The file/blob to upload
 * @param {'image'|'audio'} type - The attachment type
 * @returns {Promise<string>} - The public URL of the uploaded attachment
 */
export async function uploadChatAttachment(fileOrBlob, type) {
  if (!fileOrBlob) throw new Error('File tidak valid.');

  const bucketName = 'chat_attachments';
  const folder = type === 'image' ? 'images' : 'voice';

  // Extract extension or use fallback
  let ext = 'bin';
  if (fileOrBlob.name) {
    ext = fileOrBlob.name.split('.').pop();
  } else if (fileOrBlob.type) {
    ext = fileOrBlob.type.split('/').pop().split(';')[0];
  }

  if (type === 'audio' && ext === 'octet-stream') {
    ext = 'webm';
  } else if (type === 'image' && ext === 'octet-stream') {
    ext = 'jpg';
  }

  const fileName = `${folder}/${generateUniqueFileName(ext)}`;

  // Upload the file to Supabase storage
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, fileOrBlob, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Failed to upload file to Supabase storage:', error);
    throw new Error(`Upload gagal: ${error.message}`);
  }

  // Retrieve public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  return publicUrl;
}
