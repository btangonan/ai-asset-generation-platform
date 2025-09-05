import { Storage } from '@google-cloud/storage';

export interface UploadResult {
  gcsUri: string;
  signedUrl: string;
}

export interface SignedUrlOptions {
  expirationDays?: number;
  action?: 'read' | 'write' | 'delete';
}

export class GCSClient {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(bucketName: string, projectId?: string) {
    this.bucketName = bucketName;
    this.storage = new Storage({
      ...(projectId && { projectId }),
    });
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    contentType?: string
  ): Promise<UploadResult> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    await file.save(buffer, {
      metadata: {
        contentType: contentType || 'application/octet-stream',
      },
    });

    const gcsUri = `gs://${this.bucketName}/${fileName}`;
    const signedUrl = await this.getSignedUrl(fileName);

    return { gcsUri, signedUrl };
  }

  async getSignedUrl(
    fileName: string, 
    options: SignedUrlOptions = {}
  ): Promise<string> {
    const { expirationDays = 7, action = 'read' } = options;
    
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action,
      expires: Date.now() + expirationDays * 24 * 60 * 60 * 1000,
    });

    return signedUrl;
  }

  async copyFile(sourceFileName: string, destFileName: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const sourceFile = bucket.file(sourceFileName);
    const destFile = bucket.file(destFileName);

    await sourceFile.copy(destFile);
  }

  async deleteFile(fileName: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fileName);
    await file.delete();
  }

  async fileExists(fileName: string): Promise<boolean> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fileName);
    const [exists] = await file.exists();
    return exists;
  }

  // Generate deterministic file paths
  static generateImagePath(
    campaign: string, 
    sceneId: string, 
    jobId: string, 
    variantIndex: number
  ): string {
    return `images/${campaign}/${sceneId}/${jobId}/var_${variantIndex}.png`;
  }

  static generateThumbnailPath(
    campaign: string, 
    sceneId: string, 
    jobId: string, 
    variantIndex: number
  ): string {
    return `images/${campaign}/${sceneId}/${jobId}/thumb_${variantIndex}.png`;
  }

  static generateApprovedImagePath(
    campaign: string, 
    sceneId: string
  ): string {
    return `images/${campaign}/${sceneId}/approved/seed.png`;
  }

  static generateVideoPath(
    campaign: string, 
    sceneId: string, 
    jobId: string
  ): string {
    return `videos/${campaign}/${sceneId}/${jobId}/clip_1.mp4`;
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      await bucket.getMetadata();
      return true;
    } catch (error) {
      console.error('GCS client health check failed:', error);
      return false;
    }
  }
}