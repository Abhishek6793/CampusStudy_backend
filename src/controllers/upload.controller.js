import Group from '../models/Group.model.js';
import cloudinary from '../config/cloudinary.js';
import https from 'https';
import http from 'http';

// @desc    Upload file to a group
// @route   POST /api/upload/group/:groupId
export const uploadGroupFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Validate Cloudinary credentials
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      return res.status(500).json({ message: 'File upload service not configured' });
    }

    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isMember = group.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) return res.status(403).json({ message: 'Not a member of this group' });

    // Ensure public_id exists (use filename if public_id not provided)
    const publicId = req.file.public_id || req.file.filename;
    
    if (!publicId) {
      return res.status(400).json({ 
        message: 'File upload to Cloudinary failed',
        details: 'No public_id received - check Cloudinary credentials in .env'
      });
    }

    const fileData = {
      name: req.file.originalname,
      url: req.file.secure_url || req.file.path,
      publicId: publicId,
      resourceType: req.file.resource_type || 'auto',
      deliveryType: req.file.type || 'upload',
      uploadedBy: req.user._id,
    };

    group.files.push(fileData);
    await group.save();

    res.status(201).json({ success: true, file: fileData });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a signed file URL for browser download/open
// @route   GET /api/upload/group/:groupId/files/:fileId/url
export const getGroupFileUrl = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isMember = group.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) return res.status(403).json({ message: 'Not a member of this group' });

    const file = group.files.id(req.params.fileId);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const url = cloudinary.url(file.publicId, {
      secure: true,
      resource_type: file.resourceType || 'auto',
      type: file.deliveryType || 'upload',
      sign_url: true,
      force_download: true,
    });

    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
};

// @desc    Proxy a file download through the backend
// @route   GET /api/upload/group/:groupId/files/:fileId/download
export const downloadGroupFile = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isMember = group.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) return res.status(403).json({ message: 'Not a member of this group' });

    const file = group.files.id(req.params.fileId);
    if (!file) return res.status(404).json({ message: 'File not found' });

    // Validate required file fields
    if (!file.publicId) {
      return res.status(400).json({ 
        message: 'File data is incomplete',
        details: `Missing publicId: ${!file.publicId}`
      });
    }

    let redirectUrl = file.url;
    if (process.env.CLOUDINARY_API_KEY) {
      // Force Cloudinary to serve this as a downloaded file (fl_attachment)
      // Specifying the original filename here ensures correct format!
      redirectUrl = cloudinary.url(file.publicId, {
        secure: true,
        resource_type: file.resourceType || 'auto',
        type: file.deliveryType || 'upload',
        flags: `attachment:${file.name}` // tells Cloudinary to add accurate Content-Disposition
      });
    }

    return res.status(200).json({ success: true, redirectUrl });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all files in a group
// @route   GET /api/upload/group/:groupId/files
export const getGroupFiles = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId).populate(
      'files.uploadedBy',
      'name avatar'
    );
    if (!group) return res.status(404).json({ message: 'Group not found' });

    res.json({ success: true, files: group.files });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a file from group
// @route   DELETE /api/upload/group/:groupId/files/:fileId
export const deleteGroupFile = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const file = group.files.id(req.params.fileId);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const isOwner = file.uploadedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(file.publicId, { resource_type: 'auto' });

    group.files.pull(req.params.fileId);
    await group.save();

    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    next(error);
  }
};