export class ReportResponseDto {
  id: string;
  filename: string;
  mimetype: string;
  url: string; // public URL to original file
  size: number;
  createdAt: Date;
  ownerId?: string;
  title?: string;
  description?: string;
}
