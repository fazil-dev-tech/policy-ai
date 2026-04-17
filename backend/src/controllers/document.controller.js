const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Document = require('../models/Document');
const documentService = require('../services/document.service');
const logger = require('../utils/logger');

/**
 * POST /api/documents/upload
 */
const uploadDocument = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const filePath = req.file.path;
        const pdfUrl = `/uploads/${req.file.filename}`;
        const originalName = req.file.originalname;
        const fileSize = req.file.size;

        // Parse PDF
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        const pdfText = pdfData.text;

        if (!pdfText || pdfText.trim().length < 20) {
            return res.status(400).json({
                error: 'Could not extract sufficient text from PDF. The file may be scanned or empty.',
            });
        }

        // Extract using independent generic document AI service
        const extracted = await documentService.extractDocumentInfo(pdfText);

        // Map document types safely
        const validTypes = ['contract', 'invoice', 'report', 'letter', 'legal', 'general'];
        const docType = validTypes.includes(extracted.documentType?.toLowerCase())
            ? extracted.documentType.toLowerCase()
            : 'general';

        // Save new generic Document
        const documentRecord = await Document.create({
            userId: req.user._id,
            documentName: originalName || extracted.documentName || 'Untitled Document',
            documentType: docType,
            pdfUrl,
            fileSize,
            aiSummary: {
                simpleSummary: extracted.simpleSummary || 'Analysis complete.',
                keyPoints: extracted.keyPoints || [],
                actionItems: extracted.actionItems || [],
                riskFactors: extracted.riskFactors || [],
                entities: extracted.entities || {},
            },
            status: 'analyzed',
        });

        logger.info(`Generic Document uploaded: ${documentRecord.documentName} by user ${req.user._id}`);

        res.status(201).json({
            message: 'Document uploaded and analyzed successfully',
            document: documentRecord,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/documents
 */
const getUserDocuments = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, type } = req.query;
        const query = { userId: req.user._id };

        if (type && type !== 'all') {
            query.documentType = type;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [documents, total] = await Promise.all([
            Document.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Document.countDocuments(query),
        ]);

        res.json({
            documents,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/documents/:id
 */
const getDocument = async (req, res, next) => {
    try {
        const documentRecord = await Document.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!documentRecord) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ document: documentRecord });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/documents/:id
 */
const deleteDocument = async (req, res, next) => {
    try {
        const documentRecord = await Document.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!documentRecord) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Clean up file storage - use try-catch so file errors don't block DB delete
        try {
            if (documentRecord.pdfUrl) {
                const fullPath = path.join(__dirname, '..', '..', documentRecord.pdfUrl);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    logger.info(`File deleted: ${fullPath}`);
                }
            }
        } catch (fileErr) {
            logger.warn(`Could not delete file for document ${documentRecord._id}: ${fileErr.message}`);
        }

        logger.info(`Document deleted: ${documentRecord._id}`);

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/documents/:id/chat
 */
const chatWithDocument = async (req, res, next) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const documentRecord = await Document.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!documentRecord) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Build context from the document's AI summary
        const documentContext = {
            documentName: documentRecord.documentName,
            documentType: documentRecord.documentType,
            ...documentRecord.aiSummary,
        };

        const conversationHistory = req.body.history || [];

        const result = await documentService.chatAboutDocument(
            message.trim(),
            documentContext,
            conversationHistory
        );

        res.json({
            response: result.response,
            responseTimeMs: result.responseTimeMs,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { uploadDocument, getUserDocuments, getDocument, deleteDocument, chatWithDocument };
