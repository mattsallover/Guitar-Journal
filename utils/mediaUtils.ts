interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

interface ThumbnailOptions {
  width?: number;
  height?: number;
  timeOffset?: number; // seconds into video
}

export const compressVideo = async (
  file: File,
  options: CompressionOptions = {}
): Promise<File> => {
  const {
    maxWidth = 1280,
    maxHeight = 720,
    quality = 0.7,
    maxSizeMB = 25
  } = options;

  // If file is already small enough, return as-is
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    video.onloadedmetadata = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { videoWidth, videoHeight } = video;
      const aspectRatio = videoWidth / videoHeight;

      if (videoWidth > maxWidth) {
        videoWidth = maxWidth;
        videoHeight = maxWidth / aspectRatio;
      }
      
      if (videoHeight > maxHeight) {
        videoHeight = maxHeight;
        videoWidth = maxHeight * aspectRatio;
      }

      canvas.width = videoWidth;
      canvas.height = videoHeight;

      // Create MediaRecorder to compress
      const stream = canvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 1000000 * quality // Adjust bitrate based on quality
      });

      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const compressedBlob = new Blob(chunks, { type: 'video/webm' });
        const compressedFile = new File(
          [compressedBlob],
          file.name.replace(/\.[^/.]+$/, '.webm'),
          { type: 'video/webm' }
        );
        resolve(compressedFile);
      };

      // Draw video frames to canvas
      const drawFrame = () => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
          requestAnimationFrame(drawFrame);
        }
      };

      video.onplay = () => {
        mediaRecorder.start();
        drawFrame();
      };

      video.onended = () => {
        mediaRecorder.stop();
      };

      video.play();
    };

    video.onerror = () => {
      reject(new Error('Failed to load video for compression'));
    };

    video.src = URL.createObjectURL(file);
  });
};

export const generateVideoThumbnail = async (
  file: File,
  options: ThumbnailOptions = {}
): Promise<File> => {
  const {
    width = 300,
    height = 200,
    timeOffset = 2
  } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    video.onloadedmetadata = () => {
      canvas.width = width;
      canvas.height = height;
      
      // Seek to the specified time offset
      video.currentTime = Math.min(timeOffset, video.duration * 0.1);
    };

    video.onseeked = () => {
      // Draw the current frame to canvas
      ctx.drawImage(video, 0, 0, width, height);
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const thumbnailFile = new File(
            [blob],
            file.name.replace(/\.[^/.]+$/, '_thumb.jpg'),
            { type: 'image/jpeg' }
          );
          resolve(thumbnailFile);
        } else {
          reject(new Error('Failed to generate thumbnail'));
        }
      }, 'image/jpeg', 0.8);
    };

    video.onerror = () => {
      reject(new Error('Failed to load video for thumbnail generation'));
    };

    video.src = URL.createObjectURL(file);
  });
};

export const compressImage = async (
  file: File,
  options: CompressionOptions = {}
): Promise<File> => {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    maxSizeMB = 5
  } = options;

  // If file is already small enough, return as-is
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      const aspectRatio = width / height;

      if (width > maxWidth) {
        width = maxWidth;
        height = maxWidth / aspectRatio;
      }
      
      if (height > maxHeight) {
        height = maxHeight;
        width = maxHeight * aspectRatio;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File(
            [blob],
            file.name,
            { type: 'image/jpeg' }
          );
          resolve(compressedFile);
        } else {
          reject(new Error('Failed to compress image'));
        }
      }, 'image/jpeg', quality);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    img.src = URL.createObjectURL(file);
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};