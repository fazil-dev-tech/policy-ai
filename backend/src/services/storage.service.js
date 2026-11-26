const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

const BUCKET = env.SUPABASE_STORAGE_BUCKET || 'policy-files';

const ALLOWED_MIMES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
];

const sanitizeFilename = (originalname = 'document.pdf') => {
    const ext = path.extname(originalname).toLowerCase() || '.pdf';
    const base = path
        .basename(originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 48);
    return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${base}${ext}`;
};

const validateMagicBytes = (buffer, mimeType = '') => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
        return { valid: false, detectedMime: null, reason: 'File is empty or truncated' };
    }
    const headerHex = buffer.subarray(0, 12).toString('hex').toLowerCase();
    const ascii4 = buffer.subarray(0, 4).toString('ascii');

    if (ascii4 === '%PDF') {
        return { valid: !mimeType || mimeType === 'application/pdf', detectedMime: 'application/pdf' };
    }
    if (headerHex.startsWith('ffd8ff')) {
        return { valid: !mimeType || mimeType === 'image/jpeg' || mimeType === 'image/jpg', detectedMime: 'image/jpeg' };
    }
    if (headerHex.startsWith('89504e470d0a1a0a')) {
        return { valid: !mimeType || mimeType === 'image/png', detectedMime: 'image/png' };
    }
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        return { valid: !mimeType || mimeType === 'image/webp', detectedMime: 'image/webp' };
    }

    return { valid: false, detectedMime: null, reason: 'Unsupported file signature (only PDF, JPG, PNG, WEBP allowed)' };
};

const uploadFileBuffer = async ({ userId, folder, originalname, buffer, mimeType = 'application/pdf' }) => {
    const magic = validateMagicBytes(buffer, mimeType);
    if (!magic.valid) {
        throw new Error(magic.reason || 'File failed magic-byte validation');
    }

    const finalMime = magic.detectedMime || mimeType;
    if (!ALLOWED_MIMES.includes(finalMime)) {
        throw new Error(`Unsupported MIME type: ${finalMime}`);
    }

    const filename = sanitizeFilename(originalname);
    const storagePath = `${userId}/${folder}/${filename}`;

    const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
            contentType: finalMime,
            upsert: false,
        });

    if (error) {
        logger.error('Supabase storage upload failed:', error.message);
        throw new Error(`File upload to storage failed: ${error.message}`);
    }

    return { storagePath, mimeType: finalMime };
};

const uploadPdfBuffer = async ({ userId, folder, originalname, buffer }) => {
    const { storagePath } = await uploadFileBuffer({
        userId,
        folder,
        originalname,
        buffer,
        mimeType: 'application/pdf',
    });
    return storagePath;
};

const createSignedUploadUrl = async ({ userId, folder = 'incidents', originalname, mimeType = 'application/pdf' }) => {
    if (!ALLOWED_MIMES.includes(mimeType)) {
        throw new Error(`Unsupported MIME type for signed upload: ${mimeType}`);
    }
    const filename = sanitizeFilename(originalname);
    const storagePath = `${userId}/${folder}/${filename}`;

    const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath);

    if (error) {
        throw new Error(`Failed to create signed upload URL: ${error.message}`);
    }

    return {
        storagePath,
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path,
    };
};

const downloadBuffer = async (storagePath) => {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(storagePath);
    if (error) {
        throw new Error(`Failed to download storage file: ${error.message}`);
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
};

const createSignedUrl = async (storagePath, expiresInSeconds = 3600) => {
    if (!storagePath) return null;

    const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
        logger.warn('Failed to create signed URL:', error.message);
        return null;
    }

    return data?.signedUrl || null;
};

const attachSignedUrls = async (rows, mapper) => {
    return Promise.all(
        (rows || []).map(async (row) => {
            const signedUrl = row.storage_path
                ? await createSignedUrl(row.storage_path)
                : null;
            return mapper(row, signedUrl);
        })
    );
};

const deleteStorageFile = async (storagePath) => {
    if (!storagePath) return;

    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    if (error) {
        logger.warn(`Failed to delete storage object ${storagePath}: ${error.message}`);
    }
};

module.exports = {
    BUCKET,
    ALLOWED_MIMES,
    validateMagicBytes,
    uploadFileBuffer,
    uploadPdfBuffer,
    createSignedUploadUrl,
    downloadBuffer,
    createSignedUrl,
    attachSignedUrls,
    deleteStorageFile,
};
