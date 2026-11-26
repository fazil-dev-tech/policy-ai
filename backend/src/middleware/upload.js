const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024;

const validationErr = (msg) => {
    const err = new Error(msg);
    err.statusCode = 400;
    return err;
};

// Strict PDF-only filter (preserves legacy /api/policy/upload & /api/documents/upload behavior)
const pdfOnlyFilter = (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'application/octet-stream', ''];
    const allowedExts = ['.pdf'];
    const ext = path.extname(file.originalname || '').toLowerCase();

    if (allowedMimes.includes(file.mimetype || '') && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(validationErr('Only PDF files are allowed'), false);
    }
};

// Mixed PDF + Image filter for 7-scenario incidents, cards, scripts, vehicle photos
const mixedEvidenceFilter = (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream', ''];
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname || '').toLowerCase();

    if (allowedMimes.includes(file.mimetype || '') && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(validationErr('Only PDF, JPG, PNG, and WEBP files are allowed'), false);
    }
};

// Image-only filter for /api/damage/analyze
const imageOnlyFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream', ''];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname || '').toLowerCase();

    if (allowedMimes.includes(file.mimetype || '') && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(validationErr('Only JPG, PNG, and WEBP image files are allowed'), false);
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

const uploadImagesOnly = multer({
    storage,
    fileFilter: imageOnlyFilter,
    limits: {
        fileSize: maxFileSize,
        files: 6,
    },
});

// Keep default export identical for upload.single(...) while exposing mixed/image uploaders
upload.multiEvidence = uploadMultiEvidence;
upload.singleMixed = uploadSingleMixed;
upload.imagesOnly = uploadImagesOnly;

module.exports = upload;
