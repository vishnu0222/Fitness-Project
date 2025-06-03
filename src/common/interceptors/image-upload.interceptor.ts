import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuid } from 'uuid';
import { extname } from 'path';

// export a function that returns the configured interceptor
export function ImageUploadInterceptor(fieldName = 'image') {
  return FileInterceptor(fieldName, {
    storage: diskStorage({
      destination: './uploads',
      filename: (_req, file, cb) => {
        const name = `${uuid()}${extname(file.originalname)}`;
        cb(null, name);
      },
    }),
    fileFilter: (_req, file, cb) => {
      const allowedFile = /jpeg|jpg|png|gif/;
      const verified = allowedFile.test(file.mimetype) && allowedFile.test(extname(file.originalname));
      if (!verified) {
        return cb(new Error('Only image files are allowed!'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  });
}