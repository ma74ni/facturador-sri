import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const MB = 1024 * 1024;

/**
 * Tope de multer por tipo de subida. Los archivos se cargan en memoria, así que
 * sin tope un archivo grande tumba el proceso. Queda por encima de las
 * validaciones de cada servicio para que el usuario vea su mensaje y no un 413.
 */
const uploadLimit = (fileSize: number): MulterOptions => ({ limits: { fileSize, files: 1 } });

export const CERTIFICATE_UPLOAD = uploadLimit(1 * MB);
export const LOGO_UPLOAD = uploadLimit(5 * MB);
export const IMPORT_UPLOAD = uploadLimit(10 * MB);
/** Listados del SRI: uno por mes (unos 20 KB por 100 facturas), varios a la vez (C3 de compras). */
export const REPORTS_UPLOAD: MulterOptions = { limits: { fileSize: 2 * MB, files: 12 } };
