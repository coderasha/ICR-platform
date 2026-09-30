import { IsIn, IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class UploadExceptionAttachmentDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  originalFilename!: string;
  @IsIn(['application/pdf', 'image/jpeg', 'image/png', 'text/plain'])
  contentType!: 'application/pdf' | 'image/jpeg' | 'image/png' | 'text/plain';
  @IsString() @IsNotEmpty() @MaxLength(6_990_508) @Matches(/^[A-Za-z0-9+/]+={0,2}$/)
  contentBase64!: string;
}
