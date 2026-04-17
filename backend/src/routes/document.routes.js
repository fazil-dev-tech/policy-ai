const express = require('express');
const { uploadDocument, getUserDocuments, getDocument, deleteDocument, chatWithDocument } = require('../controllers/document.controller');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/documents/upload
router.post('/upload', authenticate, uploadLimiter, upload.single('pdf'), uploadDocument);

// GET /api/documents
router.get('/', authenticate, getUserDocuments);

// GET /api/documents/:id
router.get('/:id', authenticate, getDocument);

// POST /api/documents/:id/chat
router.post('/:id/chat', authenticate, chatWithDocument);

// DELETE /api/documents/:id
router.delete('/:id', authenticate, deleteDocument);

module.exports = router;
