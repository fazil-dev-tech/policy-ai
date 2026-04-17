const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Policy = require('../models/Policy');
const geminiService = require('../services/gemini.service');
const fraudService = require('../services/fraud.service');
const logger = require('../utils/logger');

/**
 * POST /api/policy/upload
 */
const uploadPolicy = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const filePath = req.file.path;
        const pdfUrl = `/uploads/${req.file.filename}`;

        // Parse PDF
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        const pdfText = pdfData.text;

        if (!pdfText || pdfText.trim().length < 50) {
            return res.status(400).json({
                error: 'Could not extract text from PDF. The file may be scanned or empty.',
            });
        }

        // Extract policy info using Gemini AI
        const extracted = await geminiService.extractPolicyInfo(pdfText);

        // Create policy record
        const policy = await Policy.create({
            userId: req.user._id,
            policyNumber: extracted.policyNumber || `POL-${Date.now()}`,
            providerName: extracted.providerName || req.body.providerName || 'Unknown',
            policyType: extracted.policyType || req.body.policyType || 'other',
            coverageAmount: parseFloat(extracted.coverageAmount) || 0,
            startDate: extracted.startDate || new Date(),
            endDate: extracted.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            pdfUrl,
            aiSummary: {
                overview: extracted.overview || '',
                coverage: extracted.coverage || '',
                exclusions: extracted.exclusions || '',
                claimProcedure: extracted.claimProcedure || '',
                requiredDocuments: extracted.requiredDocuments || '',
                fraudIndicators: extracted.fraudIndicators || '',
                simpleSummary: extracted.simpleSummary || '',
            },
            verificationScore: extracted.verificationScore || 50,
        });

        // Run async fraud analysis
        fraudService.analyzePolicyFraud(policy.toObject()).then((result) => {
            if (result.overallScore > 0) {
                Policy.findByIdAndUpdate(policy._id, {
                    verificationScore: 100 - result.overallScore,
                }).catch((err) => logger.error('Failed to update fraud score:', err));
            }
        });

        logger.info(`Policy uploaded: ${policy.policyNumber} by user ${req.user._id}`);

        res.status(201).json({
            message: 'Policy uploaded and analyzed successfully',
            policy,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/policy/:id
 */
const getPolicy = async (req, res, next) => {
    try {
        const policy = await Policy.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        res.json({ policy });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/policy
 */
const getUserPolicies = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, type } = req.query;
        const query = { userId: req.user._id };

        if (status) query.status = status;
        if (type) query.policyType = type;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [policies, total] = await Promise.all([
            Policy.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Policy.countDocuments(query),
        ]);

        res.json({
            policies,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/policy/:id
 */
const deletePolicy = async (req, res, next) => {
    try {
        const policy = await Policy.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        // Delete PDF file
        const fullPath = path.join(process.cwd(), policy.pdfUrl);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        logger.info(`Policy deleted: ${policy.policyNumber}`);

        res.json({ message: 'Policy deleted successfully' });
    } catch (error) {
        next(error);
    }
};

module.exports = { uploadPolicy, getPolicy, getUserPolicies, deletePolicy };
