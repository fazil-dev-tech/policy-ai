const { supabaseAdmin } = require('../config/supabase');
const documentService = require('../services/document.service');
const storageService = require('../services/storage.service');
const pdfParser = require('../services/pdfParser.service');
const { mapDocument, normalizeEnum } = require('../utils/mappers');
const logger = require('../utils/logger');

const VALID_DOC_TYPES = ['contract', 'invoice', 'report', 'letter', 'legal', 'general'];

const uploadDocument = async (req, res, next) => {
    try {
        let buffer = req.file?.buffer;
        let originalName = req.file?.originalname || req.body?.fileName || 'document.pdf';
        let fileSize = req.file?.size || Number(req.body?.fileSize || 0);
        let preUploadedPath = null;

        if (!buffer && req.body?.storagePath) {
            preUploadedPath = String(req.body.storagePath);
            if (!preUploadedPath.startsWith(`${req.user.id}/`)) {
                return res.status(403).json({ error: 'Invalid storage path ownership' });
            }
            buffer = await storageService.downloadBuffer(preUploadedPath);
            fileSize = fileSize || buffer.length;
        }

        if (!buffer) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const parsed = await pdfParser.parsePdfWithLayout(buffer);
        const pdfText = parsed.fullText || '';

        if (pdfText.trim().length < 20) {
            return res.status(400).json({
                error: 'Could not extract sufficient text from PDF. The file may be scanned or empty.',
            });
        }

        const extracted = await documentService.extractDocumentInfo(pdfText);
        const storagePath =
            preUploadedPath ||
            (await storageService.uploadPdfBuffer({
                userId: req.user.id,
                folder: 'documents',
                originalname: originalName,
                buffer,
            }));

        const docType = normalizeEnum(extracted.documentType, VALID_DOC_TYPES, 'general');
        const resolvedName =
            extracted.documentName && extracted.documentName !== 'Unknown Document'
                ? extracted.documentName
                : originalName || 'Untitled Document';

        const { data: created, error } = await supabaseAdmin
            .from('documents')
            .insert({
                user_id: req.user.id,
                document_name: resolvedName,
                document_type: docType,
                pdf_url: '',
                storage_path: storagePath,
                file_size: fileSize,
                ai_summary: {
                    simpleSummary: extracted.simpleSummary || 'Analysis complete.',
                    keyPoints: extracted.keyPoints || [],
                    actionItems: extracted.actionItems || [],
                    riskFactors: extracted.riskFactors || [],
                    entities: extracted.entities || {},
                },
                status: 'analyzed',
            })
            .select()
            .single();

        if (error) {
            await storageService.deleteStorageFile(storagePath);
            throw new Error(`Failed to save document: ${error.message}`);
        }

        const signedUrl = await storageService.createSignedUrl(storagePath);
        logger.info(`Document uploaded: ${created.document_name} by user ${req.user.id}`);

        res.status(201).json({
            message: 'Document uploaded and analyzed successfully',
            document: mapDocument(created, signedUrl),
        });
    } catch (error) {
        next(error);
    }
};

const getUserDocuments = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const { type } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabaseAdmin
            .from('documents')
            .select('*', { count: 'exact' })
            .eq('user_id', req.user.id);

        if (type && type !== 'all') {
            query = query.eq('document_type', type);
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) return next(error);

        const documents = await storageService.attachSignedUrls(data, mapDocument);
        const total = count || 0;

        res.json({
            documents,
            total,
            page,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        next(error);
    }
};

const getDocument = async (req, res, next) => {
    try {
        const { data: documentRecord, error } = await supabaseAdmin
            .from('documents')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) return next(error);
        if (!documentRecord) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const signedUrl = await storageService.createSignedUrl(documentRecord.storage_path);
        res.json({ document: mapDocument(documentRecord, signedUrl) });
    } catch (error) {
        next(error);
    }
};

const deleteDocument = async (req, res, next) => {
    try {
        const { data: documentRecord, error } = await supabaseAdmin
            .from('documents')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .maybeSingle();

        if (error) return next(error);
        if (!documentRecord) {
            return res.status(404).json({ error: 'Document not found' });
        }

        await storageService.deleteStorageFile(documentRecord.storage_path);
        logger.info(`Document deleted: ${documentRecord.id}`);

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        next(error);
    }
};

const chatWithDocument = async (req, res, next) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const { data: documentRecord, error } = await supabaseAdmin
            .from('documents')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) return next(error);
        if (!documentRecord) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const documentContext = {
            documentName: documentRecord.document_name,
            documentType: documentRecord.document_type,
            ...(documentRecord.ai_summary || {}),
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
            model: result.model,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { uploadDocument, getUserDocuments, getDocument, deleteDocument, chatWithDocument };
