const express = require('express');
const { z } = require('zod');
const { uploadDocument, getUserDocuments, getDocument, downloadDocumentFile, deleteDocument, chatWithDocument } = require('../controllers/document.controller');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const router = express.Router();

const documentChatSchema = z.object({
    body: z.object({
        message: z.string().trim().min(1, 'Message is required').max(4000),
        history: z.array(z.any()).optional(),
    }),
});

// POST /api/documents/upload
router.post('/upload', authenticate, uploadLimiter, upload.single('pdf'), uploadDocument);

// GET /api/documents
router.get('/', authenticate, getUserDocuments);

// GET /api/documents/:id/file
router.get('/:id/file', authenticate, downloadDocumentFile);

// GET /api/documents/:id
router.get('/:id', authenticate, getDocument);

// POST /api/documents/:id/chat
router.post('/:id/chat', authenticate, validate(documentChatSchema), chatWithDocument);

// DELETE /api/documents/:id
router.delete('/:id', authenticate, deleteDocument);

module.exports = router;
