const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024;

// Strict PDF-only filter (preserves legacy /api/policy/upload & /api/documents/upload behavior)
const pdfOnlyFilter = (req, file, cb) => {
    const allowedMimes = ['application/pdf'];
    const allowedExts = ['.pdf'];
    const ext = path.extname(file.originalname || '').toLowerCase();

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'), false);
    }
};

// Mixed PDF + Image filter for 7-scenario incidents, cards, scripts, vehicle photos
const mixedEvidenceFilter = (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname || '').toLowerCase();

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, JPG, PNG, and WEBP files are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter: pdfOnlyFilter,
    limits: {
        fileSize: maxFileSize,
        files: 1,
    },
});

const uploadMultiEvidence = multer({
    storage,
    fileFilter: mixedEvidenceFilter,
    limits: {
        fileSize: maxFileSize,
        files: 8,
    },
});

const uploadSingleMixed = multer({
    storage,
    fileFilter: mixedEvidenceFilter,
    limits: {
        fileSize: maxFileSize,
        files: 1,
    },
});

// Keep default export identical for upload.single(...) while exposing mixed uploaders
upload.multiEvidence = uploadMultiEvidence;
upload.singleMixed = uploadSingleMixed;

module.exports = upload;
