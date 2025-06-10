declare namespace Express {
  namespace Multer {
    /** Object containing file metadata and access information. */
    interface File {
      /** Name of the form field associated with this file. */
      fieldname: string;
      /** Name of the file on the uploader's computer. */
      originalname: string;
      /** Value of the `Content-Type` header for this file. */
      mimetype: string;
      /** Size of the file in bytes. */
      size: number;
      /** `DiskStorage` only: Directory to which this file has been uploaded. */
      destination?: string;
      /** `DiskStorage` only: Name of this file within `destination`. */
      filename?: string;
      /** `DiskStorage` only: Full path to the uploaded file. */
      path?: string;
      /** `MemoryStorage` only: A Buffer containing the entire file. */
      buffer?: Buffer;
    }
  }
}
